// Chamadas ao Apps Script da Liga (catálogos e IA). Toda chamada leva o ID token
// do Firebase; o Apps Script confere o token e o perfil antes de responder.
// O corpo vai como text/plain para evitar a pré-verificação CORS, que o Apps
// Script não suporta.

import { APPS_SCRIPT_URL, MODO_DEMO } from '../config.js';
import { backend } from '../dados/backend.js';

export class ErroApi extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo;
  }
}

const MENSAGENS = {
  sem_token: 'Sessão expirada. Entre de novo.',
  token_invalido: 'Sessão expirada. Entre de novo.',
  sem_permissao: 'Seu usuário não tem permissão para esta consulta.',
  limite: 'Muitas consultas seguidas. Aguarde um minuto.',
  acao_desconhecida: 'Ação não reconhecida pelo servidor.',
  tempo_esgotado: 'O servidor demorou para responder. Tente de novo.',
  sem_conexao: 'Sem conexão com o servidor. Confira o Wi-Fi.',
  nao_configurado: 'O endereço do Apps Script ainda não foi configurado.',
  resumo_insuficiente: 'A avaliação ainda tem poucos dados para a IA.',
  ia_resposta_invalida: 'A IA respondeu fora do formato. Tente de novo.',
  fora_das_ligacoes: 'Esta intervenção não está ligada ao diagnóstico.',
  ia_indisponivel: 'A IA está fora do ar agora. Continue a evolução e monte o PE pela biblioteca.',
  ia_limite: 'A IA atingiu o limite de pedidos. Tente em alguns minutos ou use a biblioteca.',
  ia_sem_conexao: 'O servidor não conseguiu falar com a IA. Tente de novo ou use a biblioteca.',
  ia_chave_invalida: 'A IA não está configurada corretamente. Avise o administrador.',
};

export async function chamar(acao, dados = {}, { tempoMs = 30000 } = {}) {
  if (MODO_DEMO) {
    const demo = await import('./demo-servidor.js');
    return demo.responder(acao, dados);
  }
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === 'COLE_AQUI') throw new ErroApi('nao_configurado', MENSAGENS.nao_configurado);
  const token = await backend.obterToken();
  if (!token) throw new ErroApi('sem_token', MENSAGENS.sem_token);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), tempoMs);
  let resp;
  try {
    resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ acao, token, dados }),
      signal: ctrl.signal,
      redirect: 'follow',
    });
  } catch (e) {
    throw new ErroApi(e.name === 'AbortError' ? 'tempo_esgotado' : 'sem_conexao', MENSAGENS[e.name === 'AbortError' ? 'tempo_esgotado' : 'sem_conexao']);
  } finally {
    clearTimeout(timer);
  }
  let corpo;
  try {
    corpo = await resp.json();
  } catch {
    throw new ErroApi('resposta_invalida', 'Resposta inválida do servidor.');
  }
  if (!corpo.ok) throw new ErroApi(corpo.erro, MENSAGENS[corpo.erro] || 'O servidor recusou a solicitação.');
  return corpo.dados;
}
