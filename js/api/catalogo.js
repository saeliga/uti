// Consultas aos catálogos NANDA-I / NOC / NIC, que ficam SOMENTE no Apps Script.
// O aparelho recebe só o item consultado. O cache abaixo vive apenas na
// memória da página: some ao sair ou recarregar. Nada é gravado no aparelho.

import { chamar } from './appsscript.js';

const memoria = new Map();

async function comCache(chave, fn) {
  if (memoria.has(chave)) return memoria.get(chave);
  const v = await fn();
  memoria.set(chave, v);
  return v;
}

/** Busca diagnósticos por título, código ou foco. Devolve [{codigo, titulo, dominio, classe, categoria}]. */
export function buscarDiagnosticos(texto, { categoria = '' } = {}) {
  const t = String(texto || '').trim();
  if (t.length < 2) return Promise.resolve([]);
  return comCache(`busca|${t.toLowerCase()}|${categoria}`, () => chamar('catalogo.nanda.buscar', { texto: t, categoria }));
}

export const detalheDiagnostico = (codigo) =>
  comCache(`nanda|${codigo}`, () => chamar('catalogo.nanda.detalhe', { codigo }));

/** NOC e NIC ligados a cada diagnóstico (restrito à tabela de ligações). */
export const ligacoes = (codigos) =>
  comCache(`lig|${[...codigos].sort().join(',')}`, () => chamar('catalogo.ligacoes', { codigos }));

export const detalheResultado = (codigo) => comCache(`noc|${codigo}`, () => chamar('catalogo.noc.detalhe', { codigo }));
export const detalheIntervencao = (codigo) => comCache(`nic|${codigo}`, () => chamar('catalogo.nic.detalhe', { codigo }));
export const versaoCatalogos = () => comCache('versao', () => chamar('catalogo.versao'));

export function limparCache() {
  memoria.clear();
}

/** Cria uma busca que só dispara quando a pessoa para de digitar. */
export function buscaComPausa(fn, ms = 450) {
  let t;
  return (...args) =>
    new Promise((resolve, reject) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args).then(resolve, reject), ms);
    });
}

/** Sugestão do Processo de Enfermagem pela IA (não usa cache: cada pedido é novo). */
export const sugerirPE = (resumo) => chamar('ia.sugerirSAE', { resumo }, { tempoMs: 120000 });
export const sugerirAtividades = (resumo, codigoNanda, codigoNic) =>
  chamar('ia.sugerirAtividades', { resumo, codigoNanda, codigoNic }, { tempoMs: 60000 });
