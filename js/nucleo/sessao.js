// Sessão: entrada com Google, solicitação de acesso, aguardando aprovação e saída.

import { backend } from '../dados/backend.js';
import { MODO_DEMO } from '../config.js';
import { h, limpar, campo, lerFormulario, mostrarErros, abrirJanela, confirmar, aviso } from './ui.js';
import { limparCache } from '../api/catalogo.js';

const SAIR_GOOGLE_URL = 'https://accounts.google.com/Logout';

/**
 * Sai do sistema. Em tablet compartilhado, oferece sair também da conta Google:
 * sem isso, o próximo usuário vê a conta anterior na lista do Google e pode
 * entrar com ela sem digitar senha.
 */
export async function sairComSeguranca() {
  const ok = await backend.tudoEnviado();
  if (!ok) {
    const sair = await confirmar(
      'Há registros deste aparelho que ainda NÃO foram enviados ao servidor (sem conexão). Se sair agora, eles serão perdidos. Conecte ao Wi-Fi e aguarde, ou saia mesmo assim.',
      { titulo: 'Registros não enviados', sim: 'Sair e perder', perigo: true, prioritaria: true },
    );
    if (!sair) return;
  }
  let escolha = null;
  await new Promise((resolve) => {
    abrirJanela({
      titulo: 'Sair',
      prioritaria: true,
      conteudo: h('div', {},
        h('p', {}, 'Em tablet ou computador compartilhado, saia também da conta Google. Assim o próximo colega não consegue entrar com a sua conta.'),
        h('p', { class: 'ajuda' }, 'Isso encerra todas as contas Google abertas neste navegador (Gmail, Drive etc.).')),
      acoes: [
        { texto: 'Cancelar', classe: 'btn-secundario' },
        { texto: 'Sair só do sistema', classe: 'btn-secundario', aoClicar: () => { escolha = 'sistema'; } },
        { texto: 'Sair do sistema e do Google', classe: 'btn-primario', aoClicar: () => { escolha = 'google'; } },
      ],
      aoFechar: resolve,
    });
  });
  if (!escolha) return;
  limparCache();
  await backend.sair({ depois: escolha === 'google' && !MODO_DEMO ? SAIR_GOOGLE_URL : null });
}

function cabecalhoAcesso() {
  return h('div', { class: 'acesso-topo' },
    h('img', { src: 'assets/logo/logo_liga_cor.png', alt: 'Liga Contra o Câncer', class: 'acesso-logo' }),
    h('h1', {}, 'Evolução e Processo de Enfermagem'),
    h('p', { class: 'acesso-sub' }, 'UTI 1 e UTI 2'));
}

const iconeGoogle = () => {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  for (const [cor, d] of [
    ['#EA4335', 'M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6.1C12.4 13.6 17.7 9.5 24 9.5z'],
    ['#4285F4', 'M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.1z'],
    ['#FBBC05', 'M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.8-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6.1z'],
    ['#34A853', 'M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.8 6.1C6.6 42.6 14.6 48 24 48z'],
  ]) {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('fill', cor);
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
};

export function telaEntrada(raiz) {
  const erro = h('div', { class: 'campo-erro', 'aria-live': 'polite' });
  const btn = h('button', { class: 'btn btn-google btn-largo', type: 'button' }, iconeGoogle(), 'Entrar com Google');
  btn.addEventListener('click', async () => {
    erro.textContent = '';
    btn.disabled = true;
    try {
      await backend.entrarComGoogle();
    } catch (e) {
      if (e.codigo !== 'login_cancelado') erro.textContent = e.message;
      btn.disabled = false;
    }
  });
  limpar(raiz).append(h('main', { class: 'acesso' }, h('div', { class: 'acesso-cartao' },
    cabecalhoAcesso(),
    MODO_DEMO && h('div', { class: 'faixa-demo' }, 'MODO DEMONSTRAÇÃO — dados fictícios. Clique em "Entrar com Google" (não abre o Google).'),
    h('div', { class: 'acesso-form' },
      btn,
      erro,
      h('p', { class: 'acesso-nota' }, 'Use sua conta Google institucional (@liga.org.br). No primeiro acesso, você informa nome e Coren, e o administrador do sistema aprova.')))));
}

/** Primeiro acesso com uma conta Google: nome e Coren para o administrador conferir. */
export function telaSolicitarAcesso(raiz, usuario) {
  const form = h('form', { class: 'acesso-form', novalidate: true },
    h('p', {}, 'Primeiro acesso com ', h('strong', {}, usuario.email), '. Informe seus dados. O acesso só é liberado depois da aprovação do administrador do sistema.'),
    campo({ nome: 'nome', rotulo: 'Nome completo', valor: (usuario.nome || '').toUpperCase(), obrigatorio: true, attrs: { autocomplete: 'name' } }),
    campo({ nome: 'coren', rotulo: 'Coren', obrigatorio: true, ajuda: 'Número e UF, ex.: 123456-RN' }),
    h('button', { class: 'btn btn-primario btn-largo', type: 'submit' }, 'Solicitar acesso'),
    h('button', { class: 'btn btn-link', type: 'button', onclick: () => sairComSeguranca() }, 'Não é você? Sair'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = lerFormulario(form);
    const nome = d.nome.replace(/\s+/g, ' ').trim();
    const erros = {};
    if (nome.split(' ').length < 2) erros.nome = 'Informe o nome completo.';
    if (!/^\d{3,7}(-[A-Z]{2})?$/i.test(d.coren.trim())) erros.coren = 'Informe o número do Coren (ex.: 123456-RN).';
    if (!mostrarErros(form, erros)) return;
    const b = form.querySelector('button[type=submit]');
    b.disabled = true;
    try {
      await backend.solicitarAcesso({ nome: nome.toUpperCase(), coren: d.coren.trim().toUpperCase() });
      location.reload(); // relê o perfil: pendente vai para "aguardando"; administrador inicial entra direto
    } catch (err) {
      aviso(err.message, 'erro');
      b.disabled = false;
    }
  });
  limpar(raiz).append(h('main', { class: 'acesso' }, h('div', { class: 'acesso-cartao' }, cabecalhoAcesso(), form)));
}

export function telaAguardando(raiz, perfil, mensagemErro) {
  const msg = mensagemErro
    ? `Não foi possível carregar seu perfil: ${mensagemErro}`
    : perfil?.perfil === 'pendente'
      ? 'Sua solicitação foi recebida e aguarda aprovação do administrador do sistema.'
      : 'Seu acesso está desativado. Procure o administrador do sistema.';
  limpar(raiz).append(h('main', { class: 'acesso' }, h('div', { class: 'acesso-cartao' },
    cabecalhoAcesso(),
    h('p', { class: 'acesso-msg' }, msg),
    h('button', { class: 'btn btn-secundario btn-largo', type: 'button', onclick: () => location.reload() }, 'Verificar de novo'),
    h('button', { class: 'btn btn-link', type: 'button', onclick: () => sairComSeguranca() }, 'Sair'))));
}
