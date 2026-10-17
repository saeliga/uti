// Campo "infusões contínuas" por finalidade: hidratação venosa (seleção + vazão),
// outras infusões, DVA e sedoanalgesia (marcar o medicamento + vazão) e "+ Outra"
// para incluir medicamento fora da lista. Nomes da lista não são editáveis.

import { h, limpar } from '../../nucleo/ui.js';
import { normalizarInfusoes, caixaAlta } from '../../regras/infusoes.js';

const novoId = () => `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/**
 * c: campo do esquema ({ nome, grupos }). obter(): objeto do subbloco.
 * definir(v): grava o valor e avisa a mudança. Devolve o elemento do campo.
 */
export function campoInfusoes(c, { obter, definir, ro, atualizadores }) {
  const el = h('div', { class: 'infusoes' });
  const itens = () => normalizarInfusoes(obter()[c.nome]);
  const gravar = (lista) => definir(lista);

  const entradaVazao = (valor, aoMudar, attrs = {}) => {
    const inp = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'vazão', value: valor ?? '', disabled: ro, class: 'inf-vazao', 'aria-label': 'Vazão em mL/h', ...attrs });
    inp.addEventListener('input', () => aoMudar(inp.value));
    return h('span', { class: 'entrada-com-unidade inf-vazao-caixa' }, inp, h('span', { class: 'unidade' }, 'mL/h'));
  };

  function desenhar() {
    limpar(el);
    // Normaliza registros antigos e dá um id estável aos itens livres.
    const base = normalizarInfusoes(obter()[c.nome]);
    for (const i of base) if (i.livre && !i.id) i.id = novoId();
    obter()[c.nome] = base;
    for (const g of c.grupos) {
      const sec = h('div', { class: 'inf-grupo', dataset: { grupo: g.id } }, h('div', { class: 'inf-titulo' }, g.titulo));
      if (g.selecao) {
        // Hidratação venosa: uma solução + vazão.
        const atual = itens().find((i) => i.grupo === g.id) || {};
        const sel = h('select', { disabled: ro, 'aria-label': g.titulo },
          h('option', { value: '' }, '— selecione —'),
          g.selecao.map((n) => h('option', { value: n, selected: atual.medicamento === n }, n)),
          atual.medicamento && !g.selecao.includes(atual.medicamento) ? h('option', { value: atual.medicamento, selected: true }, atual.medicamento) : null);
        const salvarHv = (mudanca) => {
          const lista = itens();
          const k = lista.findIndex((i) => i.grupo === g.id);
          const item = { grupo: g.id, medicamento: '', vazao: '', ...(k >= 0 ? lista[k] : {}), ...mudanca };
          if (k >= 0) lista.splice(k, 1);
          if (item.medicamento || item.vazao) lista.push(item);
          gravar(lista);
        };
        sel.addEventListener('change', () => salvarHv({ medicamento: sel.value }));
        sec.append(h('div', { class: 'inf-linha inf-hv' }, sel, entradaVazao(atual.vazao, (v) => salvarHv({ vazao: v }))));
      }
      for (const nome of g.fixos || []) {
        const atual = itens().find((i) => i.grupo === g.id && !i.livre && i.medicamento === nome);
        const caixa = h('input', { type: 'checkbox', checked: !!atual, disabled: ro });
        const vaz = entradaVazao(atual?.vazao, (v) => {
          const lista = itens();
          const it = lista.find((i) => i.grupo === g.id && !i.livre && i.medicamento === nome);
          if (it) { it.vazao = v; gravar(lista); }
        }, { disabled: ro || !atual });
        caixa.addEventListener('change', () => {
          const lista = itens().filter((i) => !(i.grupo === g.id && !i.livre && i.medicamento === nome));
          if (caixa.checked) lista.push({ grupo: g.id, medicamento: nome, vazao: '' });
          gravar(lista);
          const inp = vaz.querySelector('input');
          inp.disabled = ro || !caixa.checked;
          if (caixa.checked) inp.focus(); else inp.value = '';
        });
        sec.append(h('div', { class: `inf-linha${atual ? ' on' : ''}` }, h('label', { class: 'inf-nome' }, caixa, h('span', {}, nome)), vaz));
      }
      for (const it of itens().filter((i) => i.grupo === g.id && i.livre)) {
        const nome = h('input', { type: 'text', value: caixaAlta(it.medicamento), placeholder: 'PRINCÍPIO ATIVO', disabled: ro, class: 'inf-livre', 'aria-label': 'Medicamento' });
        nome.addEventListener('input', () => {
          const pos = nome.selectionStart;
          nome.value = caixaAlta(nome.value).replace(/^\s+/, '');
          nome.setSelectionRange(pos, pos);
          const lista = itens();
          const alvo = lista.find((i) => i.id === it.id);
          if (alvo) { alvo.medicamento = nome.value; it.medicamento = nome.value; gravar(lista); }
        });
        sec.append(h('div', { class: 'inf-linha inf-outra' }, nome,
          entradaVazao(it.vazao, (v) => {
            const lista = itens();
            const alvo = lista.find((i) => i.id === it.id);
            if (alvo) { alvo.vazao = v; gravar(lista); }
          }),
          !ro && h('button', { type: 'button', class: 'btn-icone', 'aria-label': 'Retirar infusão', onclick: () => {
            gravar(itens().filter((i) => i.id !== it.id));
            desenhar();
          } }, '×')));
      }
      if (g.livre && !ro) {
        sec.append(h('button', { type: 'button', class: 'btn btn-secundario btn-pequeno inf-mais', onclick: () => {
          const lista = itens();
          lista.push({ grupo: g.id, medicamento: '', vazao: '', livre: true, id: novoId() });
          gravar(lista);
          desenhar();
          el.querySelector(`[data-grupo="${g.id}"] .inf-outra:last-of-type .inf-livre`)?.focus();
        } }, g.livre));
      }
      el.append(sec);
    }
  }
  desenhar();
  atualizadores.push(() => {
    for (const linha of el.querySelectorAll('.inf-linha')) {
      const cx = linha.querySelector('input[type=checkbox]');
      if (cx) linha.classList.toggle('on', cx.checked);
    }
  });
  return el;
}
