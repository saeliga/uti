// Administração: aprovação de usuários, leitos por unidade e teste de conexão.

import { backend } from '../../dados/backend.js';
import { estado } from '../../nucleo/estado.js';
import { h, limpar, carregando, aviso, confirmar } from '../../nucleo/ui.js';
import { PERFIS } from '../../regras/opcoes.js';
import { UNIDADES_PADRAO } from '../../config.js';
import { chamar } from '../../api/appsscript.js';

export async function telaAdmin(conteudo, { aoMudarUnidades }) {
  const abas = [
    ['usuarios', 'Usuários', () => secaoUsuarios(corpo)],
    ['leitos', 'Unidades e leitos', () => secaoLeitos(corpo, aoMudarUnidades)],
    ['conexao', 'Conexão com o Apps Script', () => secaoConexao(corpo)],
  ];
  const corpo = h('div', { class: 'admin-corpo' });
  const nav = h('div', { class: 'abas-admin', role: 'tablist' });
  const abrir = (id) => {
    for (const b of nav.children) b.setAttribute('aria-selected', String(b.dataset.id === id));
    abas.find((a) => a[0] === id)[2]();
  };
  for (const [id, texto] of abas) nav.append(h('button', { class: 'aba-admin', type: 'button', role: 'tab', dataset: { id }, onclick: () => abrir(id) }, texto));
  limpar(conteudo).append(h('h1', {}, 'Administração'), nav, corpo);
  abrir('usuarios');
}

// --------------------------------------------------------------------------- usuários
async function secaoUsuarios(corpo) {
  carregando(corpo);
  let lista;
  try {
    lista = await backend.listarUsuarios();
  } catch (e) {
    return limpar(corpo).append(h('p', {}, e.message));
  }
  const pendentes = lista.filter((u) => u.perfil === 'pendente');
  const ordenar = (a, b) => a.nome.localeCompare(b.nome, 'pt');
  limpar(corpo).append(
    h('p', { class: 'ajuda' }, 'Novos cadastros chegam como "Aguardando aprovação". Confira nome e Coren, escolha o perfil e as unidades, marque "Ativo" e salve.'),
    pendentes.length ? h('h2', {}, `Aguardando aprovação (${pendentes.length})`) : null,
    ...pendentes.sort(ordenar).map(linhaUsuario),
    h('h2', {}, 'Todos os usuários'),
    ...lista.filter((u) => u.perfil !== 'pendente').sort(ordenar).map(linhaUsuario));
}

function linhaUsuario(u) {
  const eu = u.uid === estado.perfil.uid;
  const perfil = h('select', { 'aria-label': `Perfil de ${u.nome}`, disabled: eu },
    Object.entries(PERFIS).map(([v, t]) => h('option', { value: v, selected: v === u.perfil }, t)));
  const unidades = estado.unidades.map((x) =>
    h('label', { class: 'opcao' }, h('input', { type: 'checkbox', value: x.id, checked: u.unidades?.includes(x.id), disabled: eu }), h('span', {}, x.nome)));
  const ativo = h('input', { type: 'checkbox', checked: u.ativo, disabled: eu });
  const salvar = h('button', { class: 'btn btn-primario btn-pequeno', type: 'button' }, 'Salvar');
  salvar.addEventListener('click', async () => {
    const dados = {
      perfil: perfil.value,
      ativo: ativo.checked,
      unidades: unidades.map((l) => l.querySelector('input')).filter((c) => c.checked).map((c) => c.value),
    };
    if (dados.ativo && dados.perfil === 'pendente') return aviso('Escolha um perfil antes de ativar.', 'atencao');
    if (dados.ativo && dados.perfil !== 'admin' && !dados.unidades.length) return aviso('Marque pelo menos uma unidade.', 'atencao');
    if (dados.perfil === 'admin' && u.perfil !== 'admin' &&
      !(await confirmar(`Dar perfil de ADMINISTRADOR a ${u.nome}? Administradores aprovam usuários e alteram leitos.`, { sim: 'Confirmar' }))) return;
    salvar.disabled = true;
    try {
      await backend.atualizarUsuario(u.uid, dados);
      Object.assign(u, dados);
      aviso(`Usuário ${u.nome} atualizado.`, 'ok');
    } catch (e) {
      aviso(e.message, 'erro');
    } finally {
      salvar.disabled = false;
    }
  });
  return h('div', { class: `usuario-linha${u.perfil === 'pendente' ? ' pendente' : ''}` },
    h('div', { class: 'usuario-dados' }, h('strong', {}, u.nome), h('span', {}, `Coren ${u.coren} · ${u.email}`), eu && h('em', {}, 'Você (não pode alterar o próprio perfil)')),
    h('div', { class: 'usuario-campos' },
      h('label', { class: 'mini' }, 'Perfil', perfil),
      h('div', { class: 'mini' }, 'Unidades', h('div', { class: 'opcoes' }, unidades)),
      h('label', { class: 'opcao' }, ativo, h('span', {}, 'Ativo')),
      !eu && salvar));
}

// --------------------------------------------------------------------------- leitos
async function secaoLeitos(corpo, aoMudarUnidades) {
  const unidades = await backend.listarUnidades();
  limpar(corpo).append(
    h('p', { class: 'ajuda' }, 'Inclua ou remova leitos. Só é possível remover leito livre. Use números com dois dígitos (01, 02…).'),
    ...unidades.map((u) => editorLeitos(u, aoMudarUnidades)));
}

function editorLeitos(u, aoMudarUnidades) {
  let lista = [...u.leitos];
  const chips = h('div', { class: 'chips-leitos' });
  const desenhar = () => {
    limpar(chips).append(...lista.map((n) =>
      h('span', { class: 'chip chip-leito' }, `Leito ${n}`,
        h('button', { type: 'button', class: 'btn-icone', 'aria-label': `Remover leito ${n}`, onclick: () => { lista = lista.filter((x) => x !== n); desenhar(); } }, '✕'))));
  };
  desenhar();
  const novo = h('input', { type: 'text', inputmode: 'numeric', maxlength: 3, placeholder: '12', 'aria-label': `Novo leito na ${u.nome}` });
  const incluir = () => {
    const n = novo.value.trim().padStart(2, '0');
    if (!/^\d{2,3}$/.test(n)) return aviso('Digite o número do leito.', 'atencao');
    if (lista.includes(n)) return aviso('Esse leito já existe.', 'atencao');
    lista = [...lista, n].sort((a, b) => a.localeCompare(b, 'pt', { numeric: true }));
    novo.value = '';
    desenhar();
  };
  novo.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), incluir()));
  const salvar = h('button', { class: 'btn btn-primario', type: 'button' }, 'Salvar leitos');
  salvar.addEventListener('click', async () => {
    salvar.disabled = true;
    try {
      await backend.atualizarLeitosUnidade(u.id, lista);
      u.leitos = [...lista];
      aviso(`Leitos da ${u.nome} salvos.`, 'ok');
      await aoMudarUnidades?.();
    } catch (e) {
      aviso(e.message, 'erro');
    } finally {
      salvar.disabled = false;
    }
  });
  return h('section', { class: 'cartao-admin' },
    h('h2', {}, u.nome), chips,
    h('div', { class: 'linha-acoes' }, novo, h('button', { class: 'btn btn-secundario', type: 'button', onclick: incluir }, 'Incluir leito'), salvar));
}

/** Primeira vez: cria as unidades e os leitos padrão. */
export function telaPrimeiraConfiguracao(conteudo, { aoConcluir }) {
  const btn = h('button', { class: 'btn btn-primario', type: 'button' }, 'Criar unidades e leitos');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await backend.configurarUnidades(UNIDADES_PADRAO);
      aviso('Unidades criadas.', 'ok');
      await aoConcluir();
    } catch (e) {
      aviso(e.message, 'erro');
      btn.disabled = false;
    }
  });
  limpar(conteudo).append(h('section', { class: 'cartao-admin' },
    h('h1', {}, 'Primeira configuração'),
    h('p', {}, 'Nenhuma unidade cadastrada ainda. Serão criadas:'),
    h('ul', {}, UNIDADES_PADRAO.map((u) => h('li', {}, `${u.nome}: ${u.leitos.length} leitos (${u.leitos[0]} a ${u.leitos.at(-1)})`))),
    h('p', {}, 'Depois você pode incluir ou remover leitos em Administração → Unidades e leitos.'),
    btn));
}

// --------------------------------------------------------------------------- conexão
function secaoConexao(corpo) {
  const saida = h('pre', { class: 'saida-teste', 'aria-live': 'polite' }, 'Clique para testar.');
  const testar = async (acao, rotulo) => {
    saida.textContent = `${rotulo}…`;
    const t0 = performance.now();
    try {
      const r = await chamar(acao);
      saida.textContent = `${rotulo}: OK em ${Math.round(performance.now() - t0)} ms\n${JSON.stringify(r, null, 2)}`;
    } catch (e) {
      saida.textContent = `${rotulo}: FALHOU — ${e.message} (${e.codigo || ''})`;
    }
  };
  limpar(corpo).append(
    h('p', { class: 'ajuda' }, 'Confere se o Apps Script reconhece seu login, se os catálogos estão instalados e se a chave da Groq funciona.'),
    h('div', { class: 'linha-acoes' },
      h('button', { class: 'btn btn-secundario', type: 'button', onclick: () => testar('ping', 'Login no Apps Script') }, 'Testar login'),
      h('button', { class: 'btn btn-secundario', type: 'button', onclick: () => testar('catalogo.versao', 'Catálogos') }, 'Testar catálogos'),
      h('button', { class: 'btn btn-secundario', type: 'button', onclick: () => testar('ia.teste', 'Groq') }, 'Testar Groq')),
    saida);
}
