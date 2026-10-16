// Aviso de nova versão publicada. O arquivo versao.json, na raiz do site,
// é atualizado a cada publicação no GitHub Pages.

import { VERSAO, MINUTOS_VERIFICAR_VERSAO } from '../config.js';
import { h } from './ui.js';

let avisado = false;

async function verificar() {
  if (avisado) return;
  try {
    const r = await fetch(`versao.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const { versao } = await r.json();
    if (versao && versao !== VERSAO) mostrar(versao);
  } catch { /* sem conexão: tenta depois */ }
}

function mostrar(nova) {
  avisado = true;
  document.body.append(h('div', { class: 'faixa-versao', role: 'status' },
    `Nova versão disponível (${nova}). Salve o que estiver fazendo e recarregue.`,
    h('button', { class: 'btn btn-pequeno', type: 'button', onclick: () => location.reload() }, 'Recarregar')));
}

export function iniciarVerificacaoVersao() {
  setTimeout(verificar, 20000);
  setInterval(verificar, MINUTOS_VERIFICAR_VERSAO * 60000);
}
