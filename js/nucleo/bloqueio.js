// Bloqueio da tela por inatividade (tablets compartilhados à beira-leito).
// Após MINUTOS_BLOQUEIO sem toque/teclado, cobre a tela e pede a confirmação
// com a mesma conta Google.
// "Trocar de usuário" sai da conta (o cache do aparelho é apagado).

import { MINUTOS_BLOQUEIO } from '../config.js';
import { backend } from '../dados/backend.js';
import { h } from './ui.js';
import { sairComSeguranca } from './sessao.js';

let timer;
let bloqueado = false;
let ultimo = Date.now();

function reiniciar() {
  if (bloqueado) return;
  clearTimeout(timer);
  timer = setTimeout(bloquear, MINUTOS_BLOQUEIO * 60000);
}

export function iniciarBloqueio(perfil) {
  for (const ev of ['pointerdown', 'keydown', 'scroll', 'touchstart']) document.addEventListener(ev, reiniciar, { passive: true });
  document.addEventListener('visibilitychange', () => {
    // Volta de outra aba/app depois do prazo: bloqueia na hora.
    if (document.visibilityState === 'visible' && Date.now() - ultimo > MINUTOS_BLOQUEIO * 60000) bloquear();
  });
  document.addEventListener('pointerdown', () => { ultimo = Date.now(); }, { passive: true });
  document.addEventListener('keydown', () => { ultimo = Date.now(); }, { passive: true });
  iniciarBloqueio.perfil = perfil;
  reiniciar();
}

export function bloquear() {
  if (bloqueado) return;
  bloqueado = true;
  const perfil = iniciarBloqueio.perfil;
  const erro = h('div', { class: 'campo-erro', 'aria-live': 'polite' });
  const btn = h('button', { class: 'btn btn-primario', type: 'button' }, 'Desbloquear com Google');
  const tela = h('div', { class: 'bloqueio', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Tela bloqueada' },
    h('div', { class: 'bloqueio-cartao' },
      h('img', { src: 'assets/logo/logo_liga_cor.png', alt: 'Liga Contra o Câncer', class: 'bloqueio-logo' }),
      h('h2', {}, 'Tela bloqueada'),
      h('p', {}, `Sessão de ${perfil?.nome || 'usuário'}${perfil?.email ? ` (${perfil.email})` : ''}. Confirme com a mesma conta Google para continuar.`),
      btn,
      erro,
      h('button', { class: 'btn btn-link', type: 'button', onclick: () => sairComSeguranca() }, 'Trocar de usuário')));
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    erro.textContent = '';
    try {
      await backend.confirmarIdentidade();
      tela.remove();
      bloqueado = false;
      reiniciar();
    } catch (err) {
      if (err.codigo !== 'login_cancelado') erro.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });
  document.body.append(tela);
  btn.focus();
}
