// Renderizador genérico de subbloco a partir do esquema (regras/evolucao-esquema.js).
// Monta os campos uma vez e, a cada mudança, só atualiza visibilidade, cálculos
// e alertas (o foco e o teclado do tablet não se perdem).

import { h, limpar, emSegundoPlano } from '../../nucleo/ui.js';
import { visivel, ESTADOS_MEDIDA } from '../../regras/evolucao-esquema.js';
import { checarSinal, SINAIS } from '../../regras/calculos.js';
import { campoInfusoes } from './infusoes.js';
import { campoDispositivos } from './dispositivos.js';

let seq = 0;
const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

/**
 * Cria o formulário de um subbloco.
 * opcoes: { dados, contexto: () => ctx, aoMudar(dados), somenteLeitura }
 * Devolve { el, definirDados(dados), dados() }.
 */
export function formularioSubbloco(sub, { dados, contexto, aoMudar, somenteLeitura = false }) {
  let d = clone(dados) || {};
  const atualizadores = [];
  const el = h('div', { class: 'campos' });

  const mudou = () => {
    atualizar();
    aoMudar?.(clone(d));
  };
  function atualizar() {
    const ctx = contexto();
    for (const f of atualizadores) f(d, ctx);
  }
  for (const c of sub.campos) el.append(criarCampo(c, () => d, mudou, contexto, atualizadores, somenteLeitura));
  atualizar();

  return {
    el,
    dados: () => clone(d),
    definirDados(novos) {
      d = clone(novos) || {};
      limpar(el);
      atualizadores.length = 0;
      for (const c of sub.campos) el.append(criarCampo(c, () => d, mudou, contexto, atualizadores, somenteLeitura));
      atualizar();
    },
    atualizar,
  };
}

function rotulo(c, id) {
  return h('label', { class: 'campo-rotulo', for: id }, c.rotulo, c.obrigatorio && h('span', { class: 'obrigatorio', 'aria-hidden': 'true' }, ' *'));
}

/** Cria um campo; `obter()` devolve o objeto onde o valor mora (subbloco ou item de lista). */
function criarCampo(c, obter, mudou, contexto, atualizadores, ro) {
  const id = `f${++seq}`;
  const wrap = h('div', { class: `campo campo-${c.tipo}`, dataset: { campo: c.nome } });
  const alvo = () => obter();
  const definir = (v) => {
    alvo()[c.nome] = v;
    mudou();
  };

  // Visibilidade (campos condicionais)
  atualizadores.push((_, ctx) => {
    wrap.hidden = !visivel(c, alvo(), ctx);
  });

  switch (c.tipo) {
    case 'texto': case 'numero': case 'hora': case 'data': case 'datahora': {
      const tipo = { texto: 'text', numero: 'text', hora: 'time', data: 'date', datahora: 'datetime-local' }[c.tipo];
      const attrs = { id, type: tipo, value: alvo()[c.nome] ?? '', disabled: ro, autocomplete: 'off' };
      if (c.tipo === 'numero') Object.assign(attrs, { inputmode: 'decimal' });
      if (c.placeholder) attrs.placeholder = c.placeholder;
      const input = h('input', attrs);
      let lista = null;
      if (c.sugestoes) {
        lista = h('datalist', { id: `${id}-sug` });
        input.setAttribute('list', `${id}-sug`);
        atualizadores.push(() => lista.replaceChildren(...c.sugestoes(alvo()).map((v) => h('option', { value: v }))));
      }
      input.addEventListener('input', () => definir(input.value));
      const linha = h('div', { class: 'entrada-com-unidade' }, input, c.unidade && h('span', { class: 'unidade' }, c.unidade));
      const alerta = h('div', { class: 'valor-alerta', 'aria-live': 'polite' });
      wrap.append(...[rotulo(c, id), linha, lista, alerta].filter(Boolean));
      if (c.sinal) {
        atualizadores.push(() => {
          const r = checarSinal(c.sinal, alvo()[c.nome]);
          wrap.classList.toggle('alerta-critico', r === 'alerta');
          wrap.classList.toggle('alerta-implausivel', r === 'implausivel');
          alerta.textContent = r === 'alerta' ? '⚠ Valor crítico' : r === 'implausivel' ? '⚠ Valor improvável — confira a digitação' : '';
        });
      }
      break;
    }
    case 'area': {
      const ta = h('textarea', { id, rows: c.linhas || 2, disabled: ro, placeholder: c.placeholder || null });
      ta.value = alvo()[c.nome] ?? '';
      ta.addEventListener('input', () => definir(ta.value));
      wrap.append(rotulo(c, id), ta);
      break;
    }
    case 'select': {
      const sel = h('select', { id, disabled: ro },
        h('option', { value: '' }, 'Selecione…'),
        Object.entries(c.opcoes).map(([v, t]) => h('option', { value: v, selected: String(alvo()[c.nome] ?? '') === v }, t)));
      sel.addEventListener('change', () => definir(sel.value));
      wrap.append(rotulo(c, id), sel);
      if (c.padrao) {
        atualizadores.push(() => {
          if (!alvo()[c.nome]) {
            const p = c.padrao(alvo());
            if (p && sel.value !== p) { alvo()[c.nome] = p; sel.value = p; }
          }
        });
      }
      break;
    }
    case 'escolha': case 'escala': {
      const grupo = h('div', { class: `chips${c.tipo === 'escala' ? ' chips-escala' : ''}`, role: 'radiogroup', 'aria-labelledby': `${id}-r` });
      const botoes = Object.entries(c.opcoes).map(([v, t]) => {
        const b = h('button', { type: 'button', class: 'chip-op', role: 'radio', disabled: ro, dataset: { v } },
          c.tipo === 'escala' && /^\d+$/.test(v) && Object.keys(c.opcoes).length <= 8 ? h('strong', {}, v) : null, t);
        b.addEventListener('click', () => definir(String(alvo()[c.nome]) === v ? '' : v));
        return b;
      });
      grupo.append(...botoes);
      atualizadores.push(() => {
        for (const b of botoes) {
          const on = String(alvo()[c.nome] ?? '') === b.dataset.v;
          b.classList.toggle('on', on);
          b.setAttribute('aria-checked', String(on));
        }
      });
      wrap.append(h('div', { class: 'campo-rotulo', id: `${id}-r` }, c.rotulo, c.obrigatorio && h('span', { class: 'obrigatorio' }, ' *')), grupo);
      break;
    }
    case 'multipla': {
      const grupo = h('div', { class: 'chips', role: 'group', 'aria-labelledby': `${id}-r` });
      const botoes = Object.entries(c.opcoes).map(([v, t]) => {
        const b = h('button', { type: 'button', class: 'chip-op', disabled: ro, dataset: { v } }, t);
        b.addEventListener('click', () => {
          const atual = new Set(alvo()[c.nome] || []);
          if (atual.has(v)) atual.delete(v); else atual.add(v);
          definir([...atual]);
        });
        return b;
      });
      grupo.append(...botoes);
      atualizadores.push(() => {
        const atual = new Set(alvo()[c.nome] || []);
        for (const b of botoes) {
          b.classList.toggle('on', atual.has(b.dataset.v));
          b.setAttribute('aria-pressed', String(atual.has(b.dataset.v)));
        }
      });
      wrap.append(h('div', { class: 'campo-rotulo', id: `${id}-r` }, c.rotulo), grupo);
      break;
    }
    case 'marcar': {
      // Caixas de marcar em grade. excludentes: grupos em que só um vale;
      // exclusivos: opções que desmarcam todas as outras (ex.: "sem edema").
      const grade = h('div', { class: 'marcar-grade', role: 'group', 'aria-labelledby': `${id}-r` });
      const chaves = Object.keys(c.opcoes);
      const caixas = Object.entries(c.opcoes).map(([v, t]) => {
        const inp = h('input', { type: 'checkbox', disabled: ro, value: v });
        inp.addEventListener('change', () => {
          let atual = new Set(Array.isArray(alvo()[c.nome]) ? alvo()[c.nome] : []);
          if (inp.checked) {
            if ((c.exclusivos || []).includes(v)) atual = new Set();
            else for (const x of c.exclusivos || []) atual.delete(x);
            for (const g of c.excludentes || []) if (g.includes(v)) for (const x of g) atual.delete(x);
            atual.add(v);
          } else atual.delete(v);
          definir(chaves.filter((k) => atual.has(k)));
        });
        return { v, inp, el: h('label', { class: 'marcar-op' }, inp, h('span', {}, t)) };
      });
      grade.append(...caixas.map((x) => x.el));
      atualizadores.push(() => {
        const atual = new Set(Array.isArray(alvo()[c.nome]) ? alvo()[c.nome] : []);
        for (const x of caixas) { x.inp.checked = atual.has(x.v); x.el.classList.toggle('on', x.inp.checked); }
      });
      const antigo = typeof alvo()[c.nome] === 'string' && alvo()[c.nome] ? h('div', { class: 'campo-ajuda' }, `Registro anterior: ${alvo()[c.nome]}`) : null;
      wrap.append(...[h('div', { class: 'campo-rotulo', id: `${id}-r` }, c.rotulo), grade, antigo].filter(Boolean));
      break;
    }
    case 'infusoes':
      wrap.append(campoInfusoes(c, { obter: alvo, definir, ro, atualizadores }));
      break;
    case 'dispositivos':
      wrap.append(campoDispositivos(c, { obter: alvo, definir, ro, contexto, atualizadores }));
      break;
    case 'calculado': {
      const saida = h('output', { class: 'calculado', id });
      wrap.append(h('div', { class: 'campo-rotulo' }, c.rotulo, h('span', { class: 'etiqueta-calc' }, 'calculado')), saida);
      atualizadores.push((_, ctx) => {
        const t = c.calc(alvo(), ctx) || '—';
        saida.textContent = t;
        if (c.sinalCalc) {
          const [chave, v] = c.sinalCalc(alvo());
          const r = checarSinal(chave, v);
          wrap.classList.toggle('alerta-critico', r === 'alerta');
          if (r === 'alerta') saida.textContent = `${t} ⚠ ${SINAIS[chave].rotulo} crítica`;
        }
      });
      break;
    }
    case 'medidas': {
      const tabela = h('div', { class: 'medidas' });
      for (const item of c.itens) {
        const just = h('input', { type: 'text', placeholder: 'Justificativa (obrigatória)', disabled: ro, 'aria-label': `Justificativa: ${item}` });
        const estados = Object.entries(ESTADOS_MEDIDA).map(([v, t]) => {
          const b = h('button', { type: 'button', class: 'chip-op chip-mini', disabled: ro, dataset: { v } }, t);
          b.addEventListener('click', () => {
            const m = { ...(alvo()[c.nome] || {}) };
            const atual = m[item]?.estado;
            m[item] = atual === v ? { estado: '' } : { ...(m[item] || {}), estado: v };
            definir(m);
          });
          return b;
        });
        just.addEventListener('input', () => {
          const m = { ...(alvo()[c.nome] || {}) };
          m[item] = { ...(m[item] || {}), justificativa: just.value };
          definir(m);
        });
        const linha = h('div', { class: 'medida' }, h('div', { class: 'medida-nome' }, item), h('div', { class: 'chips' }, estados), just);
        tabela.append(linha);
        atualizadores.push(() => {
          const m = (alvo()[c.nome] || {})[item] || {};
          for (const b of estados) b.classList.toggle('on', m.estado === b.dataset.v);
          just.hidden = m.estado !== 'nao_realizado';
          if (document.activeElement !== just) just.value = m.justificativa || '';
          linha.classList.toggle('pendente-just', m.estado === 'nao_realizado' && !String(m.justificativa || '').trim());
        });
      }
      wrap.append(h('div', { class: 'campo-rotulo' }, c.rotulo), tabela);
      break;
    }
    case 'lista': {
      const itensEl = h('div', { class: 'lista-itens' });
      const doItens = []; // atualizadores dos itens desta lista (refeitos a cada inclusão/remoção)
      atualizadores.push((dd, ctx) => { for (const f of doItens) f(dd, ctx); });
      const desenhar = () => {
        limpar(itensEl);
        doItens.length = 0;
        (alvo()[c.nome] || []).forEach((_, k) => {
          const corpo = h('div', { class: 'item-campos' });
          for (const sc of c.campos) corpo.append(criarCampo(sc, () => (alvo()[c.nome] || [])[k] || {}, mudou, contexto, doItens, ro));
          const tituloPadrao = `${c.rotuloItem[0].toUpperCase()}${c.rotuloItem.slice(1)} ${k + 1}`;
          const titulo = h('strong', {}, c.tituloItem?.((alvo()[c.nome] || [])[k] || {}) || tituloPadrao);
          if (c.tituloItem) doItens.push(() => { titulo.textContent = c.tituloItem((alvo()[c.nome] || [])[k] || {}) || tituloPadrao; });
          // Fotos (lesões): ligadas ao item por um id estável, criado na primeira foto.
          const fotosEl = c.fotos ? h('div', { class: 'item-fotos' }) : null;
          if (fotosEl) {
            const item = () => (alvo()[c.nome] || [])[k] || {};
            emSegundoPlano(import('../fotos/fotos.js').then((m) => fotosEl.append(m.barraFotos({
              item, contexto, ro,
              titulo: () => titulo.textContent,
              garantirId: () => {
                const i = item();
                if (!i.id) { i.id = m.novoIdLesao(); mudou(); }
                return i.id;
              },
            }))));
          }
          itensEl.append(h('div', { class: 'item-lista' },
            h('div', { class: 'item-topo' }, titulo,
              !ro && h('button', { type: 'button', class: 'btn btn-link btn-pequeno', onclick: () => {
                const novos = [...(alvo()[c.nome] || [])];
                novos.splice(k, 1);
                alvo()[c.nome] = novos;
                desenhar();
                mudou();
              } }, 'Remover')),
            corpo, fotosEl));
        });
      };
      desenhar();
      // Atalhos: incluem um item pronto com um toque (ex.: controle de infusão).
      let atalhosEl = null;
      if (c.atalhos && !ro) {
        const botoes = c.atalhos.map((a) => {
          const b = h('button', { type: 'button', class: 'chip-op chip-atalho' }, `+ ${a.rotulo}`);
          b.addEventListener('click', () => {
            const itens = alvo()[c.nome] || [];
            const k = itens.findIndex((i) => i.medicamento === a.item.medicamento);
            if (k >= 0) {
              itensEl.children[k]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              itensEl.children[k]?.querySelector('[data-campo=vazao] input')?.focus();
              return;
            }
            alvo()[c.nome] = [...itens, { ...a.item }];
            desenhar();
            mudou();
            itensEl.lastElementChild?.querySelector('[data-campo=quantidade] input, [data-campo=vazao] input')?.focus();
          });
          return b;
        });
        atalhosEl = h('div', { class: 'chips atalhos' }, botoes);
        atualizadores.push(() => {
          const presentes = new Set((alvo()[c.nome] || []).map((i) => i.medicamento));
          c.atalhos.forEach((a, k) => botoes[k].classList.toggle('on', presentes.has(a.item.medicamento)));
        });
      }
      wrap.append(...[h('div', { class: 'campo-rotulo' }, c.rotulo), atalhosEl, itensEl,
        !ro && h('button', { type: 'button', class: 'btn btn-secundario btn-pequeno', onclick: () => {
          alvo()[c.nome] = [...(alvo()[c.nome] || []), {}];
          desenhar();
          mudou();
          itensEl.lastElementChild?.querySelector('input, select, textarea')?.focus();
        } }, `+ Adicionar ${c.rotuloItem}`)].filter(Boolean));
      break;
    }
    default:
      wrap.append(rotulo(c, id), h('span', {}, String(alvo()[c.nome] ?? '')));
  }
  if (c.ajuda) wrap.append(h('div', { class: 'campo-ajuda' }, c.ajuda));
  // Guia da escala: botão "i" logo após o rótulo.
  if (c.info) {
    const botao = h('button', { type: 'button', class: 'btn-info-escala', 'aria-label': 'Como aplicar esta escala', title: 'Como aplicar esta escala', onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      emSegundoPlano(import('./info-escalas.js').then((m) => m.abrirInfoEscala(c.info)));
    } }, 'i');
    const rot = wrap.querySelector('.campo-rotulo');
    if (rot) rot.append(' ', botao); else wrap.prepend(botao);
  }
  return wrap;
}
