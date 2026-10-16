// Utilitários de interface: criação de elementos, avisos, janelas e formulários.
// Não usa alert/confirm do navegador (bloqueiam a página e falham em tablets).

/** Cria um elemento: h('button', { class: 'btn', onclick }, 'Texto'). */
export function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const f of filhos.flat(Infinity)) {
    if (f == null || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return el;
}

export function limpar(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

// --------------------------------------------------------------------------- avisos
let areaAvisos;
export function aviso(texto, tipo = 'info', ms = 4500) {
  if (!areaAvisos) {
    areaAvisos = h('div', { class: 'avisos', role: 'status', 'aria-live': 'polite' });
    document.body.append(areaAvisos);
  }
  const rotulo = { erro: 'Erro', ok: 'Feito', atencao: 'Atenção', info: '' }[tipo];
  const el = h('div', { class: `aviso aviso-${tipo}` }, rotulo && h('strong', {}, `${rotulo}: `), texto);
  areaAvisos.append(el);
  setTimeout(() => el.remove(), ms);
}

// --------------------------------------------------------------------------- janelas
/**
 * Abre uma janela modal. conteudo: Node. acoes: [{ texto, classe, aoClicar }]
 * (aoClicar pode devolver false para manter a janela aberta).
 */
// prioritaria: aparece acima da tela de bloqueio (usado só para a saída).
export function abrirJanela({ titulo, conteudo, acoes = [], lateral = false, prioritaria = false, aoFechar }) {
  const anterior = document.activeElement;
  const fundo = h('div', { class: `janela-fundo${lateral ? ' lateral' : ''}${prioritaria ? ' prioritaria' : ''}` });
  const fechar = () => {
    fundo.remove();
    document.removeEventListener('keydown', tecla);
    aoFechar?.();
    anterior?.focus?.();
  };
  const tecla = (e) => e.key === 'Escape' && fechar();
  const rodape = h('div', { class: 'janela-rodape' });
  for (const a of acoes) {
    const b = h('button', { class: `btn ${a.classe || ''}`, type: 'button' }, a.texto);
    b.addEventListener('click', async () => {
      if (!a.aoClicar) return fechar();
      b.disabled = true;
      try {
        const r = await a.aoClicar();
        if (r !== false) fechar();
      } finally {
        b.disabled = false;
      }
    });
    rodape.append(b);
  }
  const janela = h(
    'div',
    { class: 'janela', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
    h('div', { class: 'janela-topo' },
      h('h2', {}, titulo),
      h('button', { class: 'btn-icone', type: 'button', 'aria-label': 'Fechar', onclick: fechar }, '✕')),
    h('div', { class: 'janela-corpo' }, conteudo),
    acoes.length ? rodape : null,
  );
  fundo.append(janela);
  fundo.addEventListener('click', (e) => e.target === fundo && fechar());
  document.addEventListener('keydown', tecla);
  document.body.append(fundo);
  setTimeout(() => janela.querySelector('input, select, textarea, button.btn')?.focus(), 30);
  return { fechar, janela };
}

export function confirmar(texto, { titulo = 'Confirmar', sim = 'Confirmar', perigo = false, prioritaria = false } = {}) {
  return new Promise((resolve) => {
    let resposta = false;
    abrirJanela({
      titulo,
      conteudo: h('p', {}, texto),
      prioritaria,
      acoes: [
        { texto: 'Cancelar', classe: 'btn-secundario' },
        { texto: sim, classe: perigo ? 'btn-perigo' : 'btn-primario', aoClicar: () => { resposta = true; } },
      ],
      aoFechar: () => resolve(resposta),
    });
  });
}

// --------------------------------------------------------------------------- formulários
let seqCampo = 0;

/**
 * Campo de formulário com rótulo e área de erro.
 * tipo: text, date, datetime-local, email, password, textarea, select, radio, checkbox.
 */
export function campo({ nome, rotulo, tipo = 'text', valor = '', opcoes, ajuda, obrigatorio, attrs = {} }) {
  const id = `c${++seqCampo}-${nome}`;
  let entrada;
  if (tipo === 'textarea') {
    entrada = h('textarea', { id, name: nome, rows: 2, ...attrs });
    entrada.value = valor ?? '';
  } else if (tipo === 'select') {
    entrada = h('select', { id, name: nome, ...attrs },
      h('option', { value: '' }, 'Selecione…'),
      Object.entries(opcoes).map(([v, t]) => h('option', { value: v, selected: v === valor }, t)));
  } else if (tipo === 'radio') {
    entrada = h('div', { class: 'opcoes', role: 'radiogroup', id },
      Object.entries(opcoes).map(([v, t]) =>
        h('label', { class: 'opcao' }, h('input', { type: 'radio', name: nome, value: v, checked: v === valor, ...attrs }), h('span', {}, t))));
  } else if (tipo === 'checkbox') {
    entrada = h('label', { class: 'opcao' }, h('input', { type: 'checkbox', id, name: nome, checked: !!valor, ...attrs }), h('span', {}, rotulo));
    return h('div', { class: 'campo', dataset: { campo: nome } }, entrada, h('div', { class: 'campo-erro', id: `${id}-erro` }));
  } else {
    entrada = h('input', { id, name: nome, type: tipo, value: valor ?? '', ...attrs });
  }
  return h('div', { class: 'campo', dataset: { campo: nome } },
    h('label', { for: id, class: 'campo-rotulo' }, rotulo, obrigatorio && h('span', { class: 'obrigatorio', 'aria-hidden': 'true' }, ' *')),
    entrada,
    ajuda && h('div', { class: 'campo-ajuda' }, ajuda),
    h('div', { class: 'campo-erro', id: `${id}-erro`, 'aria-live': 'polite' }));
}

/** Lê os valores de um <form> como objeto (checkbox → boolean). */
export function lerFormulario(form) {
  const dados = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'radio') { if (el.checked) dados[el.name] = el.value; else dados[el.name] ??= ''; }
    else if (el.type === 'checkbox') dados[el.name] = el.checked;
    else dados[el.name] = el.value;
  }
  return dados;
}

/** Mostra os erros { campo: mensagem } no formulário. Devolve true se não há erros. */
export function mostrarErros(form, erros) {
  for (const c of form.querySelectorAll('.campo')) {
    const msg = erros[c.dataset.campo] || '';
    c.classList.toggle('com-erro', !!msg);
    c.querySelector('.campo-erro').textContent = msg;
  }
  const primeiro = form.querySelector('.com-erro input, .com-erro select, .com-erro textarea');
  primeiro?.focus();
  return Object.keys(erros).length === 0;
}

export function carregando(el, texto = 'Carregando…') {
  limpar(el).append(h('div', { class: 'carregando' }, h('span', { class: 'giro', 'aria-hidden': 'true' }), texto));
}
