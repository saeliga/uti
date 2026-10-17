/**
 * =============================================================================
 * Apps Script EXCLUSIVO da Liga — Sistema de Evolução/SAE UTI 1 e 2
 * =============================================================================
 * Funções: (1) conferir o login do Firebase em TODA chamada; (2) entregar os
 * catálogos NANDA-I/NOC/NIC sob demanda, item por item; (3) ponte com a Groq.
 *
 * Propriedades do script (Configurações do projeto → Propriedades do script):
 *   FIREBASE_PROJECT_ID   id do projeto Firebase da Liga (ex.: uti-liga-xxxx)
 *   GROQ_API_KEY          chave da Groq (nunca no navegador nem no GitHub)
 *   GROQ_MODELO           modelo principal (opcional; padrão abaixo)
 *   GROQ_MODELO_RESERVA   modelo de reserva (opcional; padrão abaixo)
 *
 * Segurança:
 * - Ação fora da lista acoes_() é recusada (não existe "caminho padrão").
 * - O token é verificado pelo próprio Firestore: o script lê o perfil do
 *   usuário usando o token dele; se o token for falso/expirado, o Firestore
 *   recusa. Perfil inativo ou sem permissão também é recusado.
 * - Os logs registram só ação, resultado e tempo. Nunca dados clínicos.
 * =============================================================================
 */

var LIMITE_POR_MINUTO = 60;
var LIMITE_POR_HORA = 600;
var CACHE_USUARIO_SEG = 300;

var CLINICOS = ['enfermeiro', 'admin'];
var TODOS = ['enfermeiro', 'leitura', 'admin'];
var ADMIN = ['admin'];

// Lista FECHADA de ações. É uma função (e não uma variável) porque o Apps
// Script carrega os arquivos em sequência: as funções de Catalogo.gs e Groq.gs
// ainda não existem quando Codigo.gs é lido.
function acoes_() {
  return {
    'ping': { fn: acaoPing_, perfis: TODOS },
    'catalogo.versao': { fn: catalogoVersao_, perfis: CLINICOS },
    'catalogo.nanda.buscar': { fn: catalogoBuscarNanda_, perfis: CLINICOS },
    'catalogo.nanda.detalhe': { fn: catalogoDetalheNanda_, perfis: CLINICOS },
    'catalogo.ligacoes': { fn: catalogoLigacoes_, perfis: CLINICOS },
    'catalogo.noc.detalhe': { fn: catalogoDetalheNoc_, perfis: CLINICOS },
    'catalogo.nic.detalhe': { fn: catalogoDetalheNic_, perfis: CLINICOS },
    'ia.teste': { fn: iaTeste_, perfis: ADMIN },
    'ia.sugerirSAE': { fn: iaSugerirSAE_, perfis: CLINICOS }
  };
}

// ----------------------------------------------------------------------------- entrada
function doPost(e) {
  var inicio = Date.now();
  var acao = '?';
  try {
    var corpo;
    try {
      corpo = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (err) {
      throw erro_('corpo_invalido');
    }
    acao = String(corpo.acao || '');
    var lista = acoes_();
    var def = Object.prototype.hasOwnProperty.call(lista, acao) ? lista[acao] : null;
    if (!def) throw erro_('acao_desconhecida');
    var usuario = autenticar_(corpo.token);
    if (def.perfis.indexOf(usuario.perfil) < 0) throw erro_('sem_permissao');
    limitar_(usuario.uid);
    var dados = def.fn(corpo.dados || {}, usuario);
    registrar_(acao, 'ok', inicio);
    return responder_({ ok: true, dados: dados });
  } catch (err) {
    var codigo = (err && err.codigo) || 'erro_interno';
    registrar_(acao, codigo, inicio, err && !err.codigo ? String(err.message || err).slice(0, 120) : '');
    return responder_({ ok: false, erro: codigo });
  }
}

function doGet() {
  return responder_({ ok: false, erro: 'use_post', servico: 'SAE UTI Liga' });
}

function responder_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function erro_(codigo) {
  var e = new Error(codigo);
  e.codigo = codigo;
  return e;
}

function registrar_(acao, resultado, inicio, detalhe) {
  // Sem dados clínicos: só ação, resultado, tempo e (em erro interno) a mensagem técnica.
  console.log(JSON.stringify({ acao: acao, resultado: resultado, ms: Date.now() - inicio, detalhe: detalhe || undefined }));
}

function prop_(nome, obrigatoria) {
  var v = PropertiesService.getScriptProperties().getProperty(nome);
  if (obrigatoria && !v) throw erro_('configuracao_incompleta');
  return v;
}

// ----------------------------------------------------------------------------- autenticação
function decodificarPayload_(token) {
  var partes = String(token).split('.');
  if (partes.length !== 3) throw erro_('token_invalido');
  var b64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  try {
    return JSON.parse(Utilities.newBlob(Utilities.base64Decode(b64)).getDataAsString('UTF-8'));
  } catch (e) {
    throw erro_('token_invalido');
  }
}

function hash_(texto) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes);
}

/**
 * Devolve { uid, email, perfil }. O conteúdo do token só é lido para saber
 * qual perfil pedir; quem VERIFICA a assinatura e a validade é o Firestore,
 * ao aceitar (ou recusar) a leitura feita com esse mesmo token.
 */
function autenticar_(token) {
  if (!token || typeof token !== 'string' || token.length > 4096) throw erro_('sem_token');
  var projeto = prop_('FIREBASE_PROJECT_ID', true);
  var p = decodificarPayload_(token);
  if (p.aud !== projeto || p.iss !== 'https://securetoken.google.com/' + projeto || !p.sub) throw erro_('token_invalido');
  // O sistema só aceita login com conta Google (as regras do Firestore conferem o mesmo).
  if (!p.firebase || p.firebase.sign_in_provider !== 'google.com' || p.email_verified !== true) throw erro_('sem_permissao');
  var restante = Math.floor(p.exp - Date.now() / 1000);
  if (!(restante > 0)) throw erro_('token_invalido');

  var cache = CacheService.getScriptCache();
  var chave = 'u_' + hash_(token);
  var guardado = cache.get(chave);
  if (guardado) return JSON.parse(guardado);

  var url = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(projeto) +
    '/databases/(default)/documents/usuarios/' + encodeURIComponent(p.sub);
  var r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  var status = r.getResponseCode();
  if (status === 401) throw erro_('token_invalido');
  if (status === 403 || status === 404) throw erro_('sem_permissao');
  if (status !== 200) throw erro_('falha_firestore');

  var f = JSON.parse(r.getContentText()).fields || {};
  var usuario = {
    uid: p.sub,
    email: p.email || '',
    perfil: f.perfil && f.perfil.stringValue,
    ativo: !!(f.ativo && f.ativo.booleanValue)
  };
  if (!usuario.ativo || TODOS.indexOf(usuario.perfil) < 0) throw erro_('sem_permissao');
  cache.put(chave, JSON.stringify(usuario), Math.max(1, Math.min(CACHE_USUARIO_SEG, restante)));
  return usuario;
}

/** Limite de consultas por usuário (dificulta a cópia do catálogo em massa). */
function limitar_(uid) {
  var cache = CacheService.getScriptCache();
  var agora = Date.now();
  var km = 'rm_' + uid + '_' + Math.floor(agora / 60000);
  var kh = 'rh_' + uid + '_' + Math.floor(agora / 3600000);
  var nm = Number(cache.get(km) || 0) + 1;
  var nh = Number(cache.get(kh) || 0) + 1;
  cache.put(km, String(nm), 120);
  cache.put(kh, String(nh), 3700);
  if (nm > LIMITE_POR_MINUTO || nh > LIMITE_POR_HORA) throw erro_('limite');
}

function acaoPing_(dados, usuario) {
  return { ok: true, usuario: usuario.email, perfil: usuario.perfil, servidor: new Date().toISOString() };
}

// ----------------------------------------------------------------------------- conferência manual
/**
 * Rode esta função pelo editor (botão Executar) depois de instalar.
 * Confere as propriedades e se os catálogos abrem. Não mostra dados de pacientes.
 */
function testarInstalacao() {
  var props = ['FIREBASE_PROJECT_ID', 'GROQ_API_KEY'];
  props.forEach(function (n) {
    console.log(n + ': ' + (prop_(n) ? 'configurada' : 'FALTANDO'));
  });
  try {
    var info = catalogoVersao_();
    console.log('Catálogos: ' + JSON.stringify(info));
  } catch (e) {
    console.log('Catálogos: FALHA — ' + (e.codigo || e.message));
  }
  try {
    var r = catalogoBuscarNanda_({ texto: 'infecção' });
    console.log('Busca "infecção": ' + r.length + ' resultado(s). Primeiro: ' + (r[0] ? r[0].codigo + ' ' + r[0].titulo : '—'));
  } catch (e) {
    console.log('Busca: FALHA — ' + (e.codigo || e.message));
  }
}
