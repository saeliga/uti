/**
 * Catálogos NANDA-I / NOC / NIC e ligações — entregues SOB DEMANDA.
 * Os dados ficam nos arquivos Dados_*.gs (comprimidos), que NÃO vão para o
 * GitHub (direitos autorais). O navegador recebe só o item pedido.
 *
 * Itens das listas recebem identificadores estáveis por diagnóstico
 * (CD1, CD2… características definidoras; FR fatores relacionados; RI fatores
 * de risco; PR populações em risco; CA condições associadas; A1… atividades
 * NIC). A IA e as telas usam esses identificadores, nunca texto livre.
 */

var CACHE_ITEM_SEG = 21600; // 6 h (máximo do CacheService)
var _catalogos = {};

function carregarCatalogo_(nome) {
  if (_catalogos[nome]) return _catalogos[nome];
  var partes = catalogoPartes_()[nome];
  if (!partes) throw erro_('catalogo_ausente');
  var b64 = partes.map(function (f) { return f(); }).join('');
  var blob = Utilities.newBlob(Utilities.base64Decode(b64), 'application/x-gzip');
  _catalogos[nome] = JSON.parse(Utilities.ungzip(blob).getDataAsString('UTF-8'));
  return _catalogos[nome];
}

/** Lê do cache; se não houver, calcula, guarda (se couber) e devolve. */
function comCache_(chave, fn) {
  var cache = CacheService.getScriptCache();
  var k = 'c' + catalogoInfo_().gerado + '_' + catalogoInfo_().ligacoes + '_' + chave;
  var v = cache.get(k);
  if (v) return JSON.parse(v);
  var r = fn();
  var txt = JSON.stringify(r);
  if (txt.length < 95000) cache.put(k, txt, CACHE_ITEM_SEG);
  return r;
}

function normalizar_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function codigo_(c, tamanho) {
  var s = String(c || '').replace(/\D/g, '');
  if (!s || s.length > tamanho) throw erro_('codigo_invalido');
  while (s.length < tamanho) s = '0' + s;
  return s;
}

/** Lista com subtítulos "§ " vira [{tipo:'subtitulo', texto} | {id, texto}]. */
function itensComId_(lista, prefixo) {
  var n = 0;
  return (lista || []).map(function (t) {
    if (/^§\s*/.test(t)) return { tipo: 'subtitulo', texto: t.replace(/^§\s*/, '') };
    n += 1;
    return { id: prefixo + n, texto: t };
  });
}

// ----------------------------------------------------------------------------- versão
function catalogoVersao_() {
  var info = catalogoInfo_();
  return { nanda: info.nanda, noc: info.noc, nic: info.nic, ligacoes: info.ligacoes, gerado: info.gerado };
}

// ----------------------------------------------------------------------------- NANDA
function indiceNanda_() {
  return comCache_('idx_nanda', function () {
    var lig = {};
    carregarCatalogo_('ligacoes').ligacoes.forEach(function (l) { lig[l.codigo_nanda] = l.prioridade_uti; });
    return carregarCatalogo_('nanda').map(function (d) {
      return {
        codigo: d.codigo, titulo: d.titulo, dominio: d.dominio, classe: d.classe, categoria: d.categoria,
        foco: [d.foco_primario, d.foco_secundario].filter(function (x) { return x && x !== '—'; }).join(' · '),
        temLigacoes: !!lig[d.codigo], prioridade: lig[d.codigo] || ''
      };
    });
  });
}

var CATEGORIAS = ['Com foco no problema', 'Potencial para deteriorar', 'Potencial para melhorar'];

/** Busca por código, título ou foco. Até 20 resultados, os com ligações primeiro. */
function catalogoBuscarNanda_(dados) {
  var texto = normalizar_(dados.texto).slice(0, 60);
  var categoria = CATEGORIAS.indexOf(dados.categoria) >= 0 ? dados.categoria : '';
  if (texto.length < 2) return [];
  var termos = texto.split(' ');
  var achados = indiceNanda_().filter(function (d) {
    if (categoria && d.categoria !== categoria) return false;
    if (/^\d+$/.test(texto)) return d.codigo.indexOf(texto) >= 0;
    var alvo = normalizar_(d.titulo + ' ' + d.foco);
    return termos.every(function (t) { return alvo.indexOf(t) >= 0; });
  });
  achados.sort(function (a, b) {
    var ia = normalizar_(a.titulo).indexOf(termos[0]) === 0 ? 0 : 1;
    var ib = normalizar_(b.titulo).indexOf(termos[0]) === 0 ? 0 : 1;
    return (b.temLigacoes - a.temLigacoes) || (ia - ib) || a.titulo.localeCompare(b.titulo);
  });
  return achados.slice(0, 20);
}

function catalogoDetalheNanda_(dados) {
  var codigo = codigo_(dados.codigo, 5);
  return comCache_('nanda_' + codigo, function () {
    var d = carregarCatalogo_('nanda').filter(function (x) { return x.codigo === codigo; })[0];
    if (!d) throw erro_('nao_encontrado');
    var temLig = carregarCatalogo_('ligacoes').ligacoes.some(function (l) { return l.codigo_nanda === codigo; });
    return {
      codigo: d.codigo, titulo: d.titulo, dominio: d.dominio, classe: d.classe, categoria: d.categoria,
      definicao: d.definicao, nota: d.nota || '', temLigacoes: temLig,
      caracteristicasDefinidoras: itensComId_(d.caracteristicas_definidoras, 'CD'),
      fatoresRelacionados: itensComId_(d.fatores_relacionados, 'FR'),
      fatoresRisco: itensComId_(d.fatores_de_risco, 'RI'),
      populacoesRisco: itensComId_(d.populacoes_em_risco, 'PR'),
      condicoesAssociadas: itensComId_(d.condicoes_associadas, 'CA')
    };
  });
}

// ----------------------------------------------------------------------------- ligações
function catalogoLigacoes_(dados) {
  var codigos = (Array.isArray(dados.codigos) ? dados.codigos : []).slice(0, 15).map(function (c) { return codigo_(c, 5); });
  if (!codigos.length) return { versao: catalogoInfo_().ligacoes, ligacoes: [] };
  var todas = carregarCatalogo_('ligacoes').ligacoes;
  return {
    versao: catalogoInfo_().ligacoes,
    ligacoes: codigos.map(function (c) {
      var l = todas.filter(function (x) { return x.codigo_nanda === c; })[0];
      if (!l) return { codigo_nanda: c, semLigacoes: true, noc: [], nic: [] };
      return {
        codigo_nanda: l.codigo_nanda, titulo: l.titulo, categoria: l.categoria, prioridade: l.prioridade_uti,
        justificativa: l.justificativa,
        noc: l.noc.map(function (n) {
          return { codigo: n.codigo, titulo: n.titulo, papel: n.papel, escala_principal: n.escala_principal,
            indicadores_sugeridos: (n.indicadores_sugeridos || []).map(function (i) { return i.codigo; }) };
        }),
        nic: l.nic.map(function (n) {
          return { codigo: n.codigo, titulo: n.titulo, papel: n.papel, nivel_formacao: n.nivel_formacao,
            essencial_terapia_intensiva: !!n.essencial_terapia_intensiva, essencial_oncologia: !!n.essencial_oncologia };
        })
      };
    })
  };
}

// ----------------------------------------------------------------------------- NOC e NIC
function catalogoDetalheNoc_(dados) {
  var codigo = codigo_(dados.codigo, 4);
  return comCache_('noc_' + codigo, function () {
    var cat = carregarCatalogo_('noc');
    var r = cat.resultados.filter(function (x) { return x.codigo === codigo; })[0];
    if (!r) throw erro_('nao_encontrado');
    var escalas = {};
    [r.escala_principal].concat(r.indicadores.map(function (i) { return i.escala; })).forEach(function (k) {
      if (k && cat.escalas[k]) escalas[k] = cat.escalas[k];
    });
    return {
      codigo: r.codigo, titulo: r.titulo, definicao: r.definicao, dominio: r.dominio || '', classe: r.classe || '',
      escala_principal: r.escala_principal, indicadores: r.indicadores, escalas: escalas
    };
  });
}

function catalogoDetalheNic_(dados) {
  var codigo = codigo_(dados.codigo, 4);
  return comCache_('nic_' + codigo, function () {
    var n = carregarCatalogo_('nic').filter(function (x) { return x.codigo === codigo; })[0];
    if (!n) throw erro_('nao_encontrado');
    return {
      codigo: n.codigo, titulo: n.titulo, definicao: n.definicao, nivel_formacao: n.nivel_formacao,
      tempo_estimado: n.tempo_estimado, atividades: itensComId_(n.atividades, 'A')
    };
  });
}
