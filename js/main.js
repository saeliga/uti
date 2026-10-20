// Ponto de entrada: decide qual tela mostrar e monta a estrutura do sistema.

import { MODO_DEMO, VERSAO } from './config.js';
import { backend } from './dados/backend.js';
import { h, limpar, carregando, aviso, anexar, ativarCamposNumericos, emSegundoPlano } from './nucleo/ui.js';
import { telaEntrada, telaAguardando, telaSolicitarAcesso, sairComSeguranca } from './nucleo/sessao.js';
import { iniciarBloqueio, bloquear } from './nucleo/bloqueio.js';
import { iniciarVerificacaoVersao } from './nucleo/versao.js';
import { estado } from './nucleo/estado.js';
import { PERFIS } from './regras/opcoes.js';

// Campos numéricos aceitam só números (sinais vitais, volumes etc.).
ativarCamposNumericos();

const raiz = document.getElementById('app');
// Não funciona dentro de moldura de outro site (proteção contra "clickjacking":
// uma página maliciosa por cima do sistema, enganando o toque do usuário).
if (window.top !== window.self) {
  raiz.textContent = 'Por segurança, o sistema só abre na própria página: https://saeliga.github.io/uti/';
  throw new Error('aberto dentro de moldura');
}
window.__sistemaCarregado = true; // usado pelo aviso de falha de carregamento (index.html)
let iniciado = false;

backend.aoMudarSessao(async (usuario) => {
  if (!usuario) {
    estado.perfil = null;
    return telaEntrada(raiz);
  }
  carregando(raiz, 'Carregando seu perfil…');
  let perfil;
  try {
    perfil = await backend.lerPerfil(usuario.uid);
  } catch (e) {
    return telaAguardando(raiz, null, e.message);
  }
  // Primeiro acesso com esta conta Google: pede nome e Coren e cria a solicitação.
  if (!perfil) return telaSolicitarAcesso(raiz, usuario);
  if (!perfil.ativo || perfil.perfil === 'pendente') return telaAguardando(raiz, perfil);
  estado.perfil = perfil;
  await iniciarSistema();
});

async function iniciarSistema() {
  estado.unidades = await backend.listarUnidades().catch((e) => {
    aviso(e.message, 'erro');
    return [];
  });
  montarEstrutura();
  if (!iniciado) {
    iniciado = true;
    iniciarBloqueio(estado.perfil);
    iniciarVerificacaoVersao();
    window.addEventListener('hashchange', rotear);
    window.addEventListener('online', atualizarConexao);
    window.addEventListener('offline', atualizarConexao);
  }
  emSegundoPlano(rotear());
}

function unidadesPermitidas() {
  const p = estado.perfil;
  return estado.unidades.filter((u) => p.perfil === 'admin' || p.unidades.includes(u.id));
}

function montarEstrutura() {
  const p = estado.perfil;
  const abas = h('nav', { class: 'abas-unidade', id: 'abas-unidade', 'aria-label': 'Unidades' });
  const menu = h('div', { class: 'menu-usuario' },
    h('div', { class: 'usuario-nome' }, p.nome, h('span', { class: 'usuario-coren' }, `Coren ${p.coren} · ${PERFIS[p.perfil]}`)),
    p.perfil === 'admin' && h('a', { href: '#/admin', class: 'btn btn-secundario btn-pequeno', dataset: { rota: 'admin' } }, 'Administração'),
    h('button', { class: 'btn btn-secundario btn-pequeno', type: 'button', onclick: bloquear }, 'Bloquear tela'),
    h('button', { class: 'btn btn-secundario btn-pequeno', type: 'button', onclick: sairComSeguranca }, 'Sair'));
  anexar(limpar(raiz), 
    MODO_DEMO ? h('div', { class: 'faixa-demo' }, 'MODO DEMONSTRAÇÃO — dados fictícios, nada é salvo. Ao recarregar a página, tudo volta ao início.') : null,
    h('header', { class: 'topo' },
      h('a', { href: '#/', class: 'topo-marca', 'aria-label': 'Início' },
        h('img', { src: 'assets/logo/logo_liga_cor_400.webp', alt: 'Liga Contra o Câncer', class: 'topo-logo' })),
      abas,
      h('div', { id: 'conexao', class: 'conexao' }),
      menu),
    h('main', { id: 'conteudo', class: 'conteudo', tabindex: '-1' }),
    h('footer', { class: 'rodape' }, `Versão ${VERSAO}`));
  desenharAbas();
  atualizarConexao();
}

function desenharAbas() {
  const nav = document.getElementById('abas-unidade');
  const rota = location.hash.replace(/^#\/?/, '');
  nav.replaceChildren(...unidadesPermitidas().map((u) =>
    h('a', { href: `#/${u.id}`, class: `aba${u.id === rota ? ' ativa' : ''}`, dataset: { rota: u.id } }, u.nome)));
}

/** Recarrega as unidades (após o administrador mudar leitos) sem sair da tela atual. */
async function recarregarUnidades() {
  estado.unidades = await backend.listarUnidades();
  desenharAbas();
}

export function atualizarConexao(meta) {
  const el = document.getElementById('conexao');
  if (!el) return;
  if (meta) estado.meta = meta;
  const off = !navigator.onLine || estado.meta?.doCache;
  const pend = estado.meta?.pendente;
  el.className = `conexao ${off ? 'conexao-off' : pend ? 'conexao-pend' : 'conexao-ok'}`;
  el.textContent = off ? 'Sem conexão · usando dados do aparelho' : pend ? 'Enviando…' : 'Conectado';
}
estado.atualizarConexao = atualizarConexao;

let desmontarAtual = null;

async function rotear() {
  const rota = location.hash.replace(/^#\/?/, '') || '';
  const conteudo = document.getElementById('conteudo');
  if (!conteudo) return;
  desmontarAtual?.();
  desmontarAtual = null;
  for (const a of document.querySelectorAll('[data-rota]')) a.classList.toggle('ativa', a.dataset.rota === rota);

  const p = estado.perfil;
  if (rota.startsWith('evolucao/')) {
    const [, internacaoId, data] = rota.split('/');
    const { telaEvolucao } = await import('./modulos/evolucao/evolucao.js');
    desmontarAtual = await telaEvolucao(conteudo, { internacaoId, data });
    return;
  }
  if (rota.startsWith('iras/')) {
    const unidade = unidadesPermitidas().find((u) => u.id === rota.split('/')[1]);
    if (unidade) {
      for (const a of document.querySelectorAll('[data-rota]')) a.classList.toggle('ativa', a.dataset.rota === unidade.id);
      const { telaIras } = await import('./modulos/iras/iras.js');
      desmontarAtual = await telaIras(conteudo, unidade);
      return;
    }
  }
  if (rota === 'admin' && p.perfil === 'admin') {
    const { telaAdmin } = await import('./modulos/admin/admin.js');
    desmontarAtual = await telaAdmin(conteudo, { aoMudarUnidades: recarregarUnidades });
    return;
  }
  const permitidas = unidadesPermitidas();
  if (!permitidas.length) {
    if (p.perfil === 'admin') {
      const { telaPrimeiraConfiguracao } = await import('./modulos/admin/admin.js');
      return telaPrimeiraConfiguracao(conteudo, { aoConcluir: iniciarSistema });
    }
    limpar(conteudo).append(h('p', { class: 'vazio' }, 'Nenhuma unidade liberada para o seu usuário. Procure o administrador.'));
    return;
  }
  const unidade = permitidas.find((u) => u.id === rota) || permitidas[0];
  if (unidade.id !== rota) {
    history.replaceState(null, '', `#/${unidade.id}`);
    for (const a of document.querySelectorAll('[data-rota]')) a.classList.toggle('ativa', a.dataset.rota === unidade.id);
  }
  const { telaPainel } = await import('./modulos/painel/painel.js');
  desmontarAtual = telaPainel(conteudo, unidade);
}
