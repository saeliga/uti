// Testa o Apps Script no Node, com simulações dos serviços do Google.
// Por padrão usa um catálogo FICTÍCIO gerado aqui. Para testar com o catálogo
// real (restrito), aponte CATALOGO_DIR para a pasta com os Dados_*.gs.
// Rodar com: node --test testes/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PROJETO = 'projeto-teste';

// ------------------------------------------------------------------ catálogo
function catalogoFicticio() {
  const gz = (o) => zlib.gzipSync(Buffer.from(JSON.stringify(o))).toString('base64');
  const nanda = [
    { codigo: '00004', titulo: 'Risco de infecção', dominio: 'D11', classe: 'C1', categoria: 'Potencial para deteriorar', foco_primario: 'Infecção', foco_secundario: '—',
      definicao: 'Def fictícia', fatores_de_risco: ['§ Grupo A', 'Fator 1', 'Fator 2'], populacoes_em_risco: ['Pop 1'] },
    { codigo: '00032', titulo: 'Padrão respiratório ineficaz', dominio: 'D4', classe: 'C4', categoria: 'Com foco no problema', foco_primario: 'Padrão respiratório', foco_secundario: '—',
      definicao: 'Def fictícia', caracteristicas_definidoras: ['Bradipneia', 'Taquipneia'], fatores_relacionados: ['Fadiga'] },
    { codigo: '00999', titulo: 'Diagnóstico sem ligação', dominio: 'D1', classe: 'C1', categoria: 'Potencial para melhorar', foco_primario: 'Teste', foco_secundario: '—', definicao: 'x' },
  ];
  const noc = { resultados: [{ codigo: '0703', titulo: 'Gravidade da infecção', definicao: 'x', escala_principal: 'grave_nenhum',
    indicadores: [{ codigo: '070307', texto: 'Febre', escala: 'grave_nenhum' }] }], escalas: { grave_nenhum: ['Grave', 'Substancial', 'Moderado', 'Leve', 'Nenhum'] } };
  const nic = [{ codigo: '6540', titulo: 'Controle de infecção', definicao: 'x', nivel_formacao: 'Enfermeiro registrado', tempo_estimado: '15 min', atividades: ['Atividade 1', 'Atividade 2'] }];
  const ligacoes = { meta: {}, ligacoes: [
    { codigo_nanda: '00004', titulo: 'Risco de infecção', categoria: 'Potencial para deteriorar', prioridade_uti: 'alta', justificativa: 'j',
      noc: [{ codigo: '0703', titulo: 'Gravidade da infecção', papel: 'principal', escala_principal: 'grave_nenhum', indicadores_sugeridos: [{ codigo: '070307' }] }],
      nic: [{ codigo: '6540', titulo: 'Controle de infecção', papel: 'principal', nivel_formacao: 'Enfermeiro registrado', essencial_terapia_intensiva: true }] },
    { codigo_nanda: '00032', titulo: 'Padrão respiratório ineficaz', categoria: 'Com foco no problema', prioridade_uti: 'alta', justificativa: 'j', noc: [], nic: [] },
  ] };
  const dados = { nanda, noc, nic, ligacoes };
  let codigo = '';
  for (const [nome, d] of Object.entries(dados)) {
    const b = gz(d);
    const meio = Math.ceil(b.length / 2);
    codigo += `function catDados_${nome}_1_(){return '${b.slice(0, meio)}';}\nfunction catDados_${nome}_2_(){return '${b.slice(meio)}';}\n`;
  }
  codigo += `function catalogoInfo_(){return {nanda:'n',noc:'o',nic:'i',ligacoes:'teste',gerado:'2026-10-16'};}
function catalogoPartes_(){return {nanda:[catDados_nanda_1_,catDados_nanda_2_],noc:[catDados_noc_1_,catDados_noc_2_],nic:[catDados_nic_1_,catDados_nic_2_],ligacoes:[catDados_ligacoes_1_,catDados_ligacoes_2_]};}`;
  return codigo;
}

function codigoCatalogo() {
  const dir = process.env.CATALOGO_DIR;
  if (!dir) return { codigo: catalogoFicticio(), real: false };
  return { codigo: fs.readdirSync(dir).filter((f) => f.startsWith('Dados_')).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n'), real: true };
}

// ------------------------------------------------------------------ simulações do Google
function criarAmbiente({ perfis = {}, groq = () => ({ status: 200, corpo: { choices: [{ message: { content: 'OK' } }] } }) } = {}) {
  const cache = new Map();
  const chamadas = { firestore: 0, groq: [] };
  const blob = (bytes) => ({ bytes: Buffer.from(bytes), getDataAsString: () => Buffer.from(bytes).toString('utf8') });
  const ctx = {
    console: { log: () => {} },
    Utilities: {
      base64Decode: (s) => Buffer.from(s, 'base64'),
      base64EncodeWebSafe: (b) => Buffer.from(b).toString('base64url'),
      newBlob: (bytes) => blob(bytes),
      ungzip: (b) => blob(zlib.gunzipSync(b.bytes)),
      computeDigest: (_a, t) => crypto.createHash('sha256').update(t).digest(),
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
    },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (n) => ({ FIREBASE_PROJECT_ID: PROJETO, GROQ_API_KEY: 'chave-teste' })[n] ?? null }) },
    UrlFetchApp: {
      fetch: (url, opt) => {
        if (url.startsWith('https://firestore.googleapis.com/')) {
          chamadas.firestore += 1;
          const token = opt.headers.Authorization.replace('Bearer ', '');
          const assinatura = token.split('.')[2];
          const uid = decodeURIComponent(url.split('/').pop());
          if (assinatura !== 'assinatura-valida') return resposta(401, {});
          if (!perfis[uid]) return resposta(404, {});
          const p = perfis[uid];
          return resposta(200, { fields: { perfil: { stringValue: p.perfil }, ativo: { booleanValue: p.ativo } } });
        }
        if (url.startsWith('https://api.groq.com/')) {
          const corpo = JSON.parse(opt.payload);
          chamadas.groq.push(corpo);
          const r = groq(corpo);
          return resposta(r.status, r.corpo);
        }
        throw new Error(`URL inesperada: ${url}`);
      },
    },
    ContentService: { createTextOutput: (t) => ({ texto: t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
  };
  function resposta(status, corpo) {
    return { getResponseCode: () => status, getContentText: () => JSON.stringify(corpo) };
  }
  vm.createContext(ctx);
  for (const f of ['Codigo.gs', 'Catalogo.gs', 'Groq.gs', 'SAE.gs']) vm.runInContext(fs.readFileSync(path.join(raiz, 'apps-script', f), 'utf8'), ctx, { filename: f });
  const cat = codigoCatalogo();
  vm.runInContext(cat.codigo, ctx, { filename: 'Dados.gs' });
  const chamar = (corpo) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(corpo) } }).texto);
  return { ctx, chamar, chamadas, real: cat.real };
}

function token({ sub = 'u1', aud = PROJETO, exp = Math.floor(Date.now() / 1000) + 3000, assinatura = 'assinatura-valida', provedor = 'google.com', email = '' } = {}) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b({ alg: 'RS256' })}.${b({ sub, aud, iss: `https://securetoken.google.com/${aud}`, exp, email: email || `${sub}@liga.org.br`, email_verified: true, firebase: { sign_in_provider: provedor } })}.${assinatura}`;
}

const PERFIS = {
  u1: { perfil: 'enfermeiro', ativo: true },
  adm: { perfil: 'admin', ativo: true },
  ler: { perfil: 'leitura', ativo: true },
  pend: { perfil: 'pendente', ativo: false },
  inat: { perfil: 'enfermeiro', ativo: false },
};

// ------------------------------------------------------------------ testes
test('recusa ação desconhecida (não cai em nenhum caminho padrão)', () => {
  const { chamar } = criarAmbiente({ perfis: PERFIS });
  assert.deepEqual(chamar({ acao: 'salvarPDF', token: token() }), { ok: false, erro: 'acao_desconhecida' });
  assert.deepEqual(chamar({ acao: 'toString', token: token() }), { ok: false, erro: 'acao_desconhecida' });
  assert.deepEqual(chamar({ acao: '__proto__', token: token() }), { ok: false, erro: 'acao_desconhecida' });
});

test('exige token válido, do projeto certo, não expirado', () => {
  const { chamar } = criarAmbiente({ perfis: PERFIS });
  assert.equal(chamar({ acao: 'ping' }).erro, 'sem_token');
  assert.equal(chamar({ acao: 'ping', token: 'abc' }).erro, 'token_invalido');
  assert.equal(chamar({ acao: 'ping', token: token({ aud: 'outro-projeto' }) }).erro, 'token_invalido');
  assert.equal(chamar({ acao: 'ping', token: token({ exp: 1000 }) }).erro, 'token_invalido');
  assert.equal(chamar({ acao: 'ping', token: token({ assinatura: 'falsificada' }) }).erro, 'token_invalido', 'Firestore recusa assinatura falsa');
  assert.equal(chamar({ acao: 'ping', token: token({ sub: 'naoexiste' }) }).erro, 'sem_permissao');
  assert.equal(chamar({ acao: 'ping', token: token({ provedor: 'password' }) }).erro, 'sem_permissao', 'só login Google');
});

test('perfil pendente/inativo é recusado; leitura não consulta catálogo; só admin testa Groq', () => {
  const { chamar } = criarAmbiente({ perfis: PERFIS });
  assert.equal(chamar({ acao: 'ping', token: token({ sub: 'pend' }) }).erro, 'sem_permissao');
  assert.equal(chamar({ acao: 'ping', token: token({ sub: 'inat' }) }).erro, 'sem_permissao');
  assert.equal(chamar({ acao: 'ping', token: token({ sub: 'ler' }) }).ok, true);
  assert.equal(chamar({ acao: 'catalogo.versao', token: token({ sub: 'ler' }) }).erro, 'sem_permissao');
  assert.equal(chamar({ acao: 'ia.teste', token: token({ sub: 'u1' }) }).erro, 'sem_permissao');
  const r = chamar({ acao: 'ia.teste', token: token({ sub: 'adm' }) });
  assert.equal(r.ok, true);
  assert.equal(r.dados.resposta, 'OK');
});

test('perfil fica em cache: uma consulta ao Firestore por token', () => {
  const { chamar, chamadas } = criarAmbiente({ perfis: PERFIS });
  const t = token();
  chamar({ acao: 'ping', token: t });
  chamar({ acao: 'ping', token: t });
  assert.equal(chamadas.firestore, 1);
});

test('limite de consultas por minuto', () => {
  const { chamar } = criarAmbiente({ perfis: PERFIS });
  const t = token();
  let ultimo;
  for (let i = 0; i < 61; i++) ultimo = chamar({ acao: 'ping', token: t });
  assert.equal(ultimo.erro, 'limite');
});

test('catálogo: busca, detalhe com identificadores, ligações, NOC e NIC', () => {
  const { chamar, real } = criarAmbiente({ perfis: PERFIS });
  const t = token();
  const busca = chamar({ acao: 'catalogo.nanda.buscar', token: t, dados: { texto: 'infeccao' } });
  assert.equal(busca.ok, true);
  assert.ok(busca.dados.some((d) => d.codigo === '00004'), 'busca sem acento encontra "infecção"');
  assert.ok(busca.dados.length <= 20);
  assert.equal(chamar({ acao: 'catalogo.nanda.buscar', token: t, dados: { texto: 'i' } }).dados.length, 0);
  assert.equal(chamar({ acao: 'catalogo.nanda.buscar', token: t, dados: { texto: '00032' } }).dados[0].codigo, '00032');

  const det = chamar({ acao: 'catalogo.nanda.detalhe', token: t, dados: { codigo: '4' } }).dados;
  assert.equal(det.codigo, '00004');
  assert.ok(det.fatoresRisco.length > 0);
  assert.ok(det.fatoresRisco.filter((x) => x.id).every((x) => /^RI\d+$/.test(x.id)));
  if (!real) assert.deepEqual(det.fatoresRisco[0], { tipo: 'subtitulo', texto: 'Grupo A' });
  assert.equal(chamar({ acao: 'catalogo.nanda.detalhe', token: t, dados: { codigo: 'abc' } }).erro, 'codigo_invalido');
  assert.equal(chamar({ acao: 'catalogo.nanda.detalhe', token: t, dados: { codigo: '99998' } }).erro, 'nao_encontrado');

  const lig = chamar({ acao: 'catalogo.ligacoes', token: t, dados: { codigos: ['00004', '00999'] } }).dados;
  assert.equal(lig.ligacoes[0].codigo_nanda, '00004');
  assert.ok(lig.ligacoes[0].noc.length && lig.ligacoes[0].nic.length);
  assert.equal(lig.ligacoes[1].semLigacoes, true);

  const noc = chamar({ acao: 'catalogo.noc.detalhe', token: t, dados: { codigo: '0703' } }).dados;
  assert.ok(noc.indicadores.length && Object.keys(noc.escalas).length);
  const nic = chamar({ acao: 'catalogo.nic.detalhe', token: t, dados: { codigo: '6540' } }).dados;
  assert.ok(nic.atividades.every((a) => /^A\d+$/.test(a.id)));
});

test('Groq: cai para o modelo de reserva em 429 e envia ajustes por modelo', () => {
  const { chamar, chamadas } = criarAmbiente({
    perfis: PERFIS,
    groq: (c) => (c.model.startsWith('qwen') ? { status: 429, corpo: {} } : { status: 200, corpo: { choices: [{ message: { content: 'OK' } }] } }),
  });
  const r = chamar({ acao: 'ia.teste', token: token({ sub: 'adm' }) });
  assert.equal(r.dados.modelo, 'openai/gpt-oss-20b');
  assert.equal(chamadas.groq[0].reasoning_effort, 'none');
  assert.equal(chamadas.groq[1].include_reasoning, false);
});

test('Groq: chave inválida vira erro claro', () => {
  const { chamar } = criarAmbiente({ perfis: PERFIS, groq: () => ({ status: 401, corpo: {} }) });
  assert.equal(chamar({ acao: 'ia.teste', token: token({ sub: 'adm' }) }).erro, 'ia_chave_invalida');
});

test('IA sugere PE: só códigos da lista e identificadores do catálogo; nada inventado passa', () => {
  let chamada = 0;
  const { chamar, chamadas } = criarAmbiente({
    perfis: PERFIS,
    groq: (c) => {
      chamada += 1;
      const txt = chamada === 1
        ? '<think>pensando</think>{"diagnosticos":[{"codigo":"00004","justificativa":"CVC e TOT"},{"codigo":"99999","justificativa":"inventado"},{"codigo":"32","justificativa":"taquipneia"},{"codigo":"00004","justificativa":"repetido"}]}'
        : '{"diagnosticos":[{"codigo":"00004","itens":["RI1","RI2","CD1","RI99"]},{"codigo":"00032","itens":["CD2","FR1","XX1"]}]}';
      return { status: 200, corpo: { choices: [{ message: { content: txt } }] } };
    },
  });
  const r = chamar({ acao: 'ia.sugerirSAE', token: token(), dados: { resumo: 'Paciente em ventilação mecânica por TOT, com CVC em jugular, febre e taquipneia, secreção moderada.' } });
  assert.equal(r.ok, true, JSON.stringify(r));
  const s = r.dados.sugestoes;
  assert.deepEqual(s.map((x) => x.codigo), ['00004', '00032'], 'descarta código inexistente e repetido; completa zeros');
  assert.deepEqual(s[0].evidencias.cd, [], 'risco não recebe característica definidora');
  assert.ok(s[0].evidencias.ri.every((i) => /^RI\d+$/.test(i.id) && i.texto), 'só fatores de risco que existem');
  assert.ok(!s[0].evidencias.ri.some((i) => i.id === 'RI99'));
  assert.ok(s[1].evidencias.cd.some((i) => i.id === 'CD2') && s[1].evidencias.fr.some((i) => i.id === 'FR1'));
  assert.equal(r.dados.versaoPrompt, 'sae-1.0');
  assert.equal(chamadas.groq.length, 2);
  assert.ok(!JSON.stringify(chamadas.groq[0]).includes('ANA'), 'o resumo enviado vem do navegador já sem identificação');
});

test('IA sugere atividades: só IDs da NIC ligada ao diagnóstico, no máximo 6', () => {
  const { chamar, chamadas } = criarAmbiente({
    perfis: PERFIS,
    groq: () => ({ status: 200, corpo: { choices: [{ message: { content: '{"atividades":["A2","A99","A1","A2","X"]}' } }] } }),
  });
  const resumo = 'Paciente em ventilação mecânica por TOT, com CVC em jugular, febre e taquipneia.';
  const lig = chamar({ acao: 'catalogo.ligacoes', token: token(), dados: { codigos: ['00004'] } }).dados.ligacoes[0];
  const nic = lig.nic.find((n) => n.papel === 'principal').codigo;
  const r = chamar({ acao: 'ia.sugerirAtividades', token: token(), dados: { resumo, codigoNanda: '4', codigoNic: nic } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.dados.atividades.map((a) => a.id), ['A2', 'A1'], 'descarta inexistente e repetido, mantém a ordem');
  assert.ok(r.dados.atividades.every((a) => a.texto));
  assert.equal(chamadas.groq.length, 1);
  assert.equal(chamar({ acao: 'ia.sugerirAtividades', token: token(), dados: { resumo, codigoNanda: '00004', codigoNic: '9999' } }).erro, 'fora_das_ligacoes');
});

test('IA sugere PE: resumo curto é recusado e leitura não pode pedir', () => {
  const { chamar } = criarAmbiente({ perfis: PERFIS });
  assert.equal(chamar({ acao: 'ia.sugerirSAE', token: token(), dados: { resumo: 'curto' } }).erro, 'resumo_insuficiente');
  assert.equal(chamar({ acao: 'ia.sugerirSAE', token: token({ sub: 'ler' }), dados: { resumo: 'x'.repeat(100) } }).erro, 'sem_permissao');
});

test('só conta institucional (@liga.org.br) usa o Apps Script', () => {
  const { chamar } = criarAmbiente({ perfis: PERFIS });
  assert.equal(chamar({ acao: 'ping', token: token({ email: 'alguem@gmail.com' }) }).erro, 'sem_permissao');
  assert.equal(chamar({ acao: 'ping', token: token({ email: 'u1@liga.org.br.falso.com' }) }).erro, 'sem_permissao');
  assert.equal(chamar({ acao: 'ping', token: token({ email: 'U1@LIGA.ORG.BR' }) }).ok, true);
});
