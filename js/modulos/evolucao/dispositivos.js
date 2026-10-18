// Campo "dispositivos": cartões dos dispositivos ativos com a avaliação do dia
// (necessidade, sítio, débito do dreno) e um modal por tipo para incluir ou editar,
// com localização em lista, lado, lúmens, calibre, curativo e retirada.
// Baseado no modal do piloto do Hospital dos Pescadores.

import { h, limpar, abrirJanela, confirmar, campo, lerFormulario, mostrarErros } from '../../nucleo/ui.js';
import { backend } from '../../dados/backend.js';
import {
  CATALOGO_DISPOSITIVOS, ROTULOS_CAMPO, LADOS, LUMENS, CURATIVOS, SITIO,
  ativo, definicao, rotuloDispositivo, alertasDispositivo,
} from '../../regras/dispositivos.js';
import { contagemDia, formatarData } from '../../regras/datas.js';
import { tipoChecklistDe } from '../../regras/impressos.js';

const GRUPOS_TIPO = [
  ['Acessos vasculares', ['cvc', 'cateter_dialise', 'picc', 'cti', 'avp', 'pai']],
  ['Via aérea', ['tot', 'tqt']],
  ['Sondas e cateteres', ['cvd', 'sne', 'soe', 'sng', 'sog', 'gtm']],
  ['Drenos', ['dreno']],
  ['Outros', ['outro']],
];
const novoId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const opc = (lista) => Object.fromEntries(lista.map((x) => [x, x]));

export function campoDispositivos(c, { obter, definir, ro, contexto, atualizadores }) {
  const el = h('div', { class: 'dispositivos' });
  const lista = () => (obter()[c.nome] || []).map((i) => ({ ...i, id: i.id || novoId() }));
  const hoje = () => contexto().dataTurno;
  const salvar = (nova) => { definir(nova); desenhar(); };
  const atualizarItem = (id, mudanca, redesenhar = false) => {
    const nova = lista().map((i) => (i.id === id ? { ...i, ...mudanca } : i));
    if (redesenhar) salvar(nova); else definir(nova);
  };

  function chipsDia(i, campoNome, opcoes, { multiplo = false, exclusivo = '' } = {}) {
    const grupo = h('div', { class: 'chips' });
    const desenharChips = () => {
      const atual = multiplo ? new Set(i[campoNome] || []) : i[campoNome];
      grupo.replaceChildren(...Object.entries(opcoes).map(([v, t]) => {
        const on = multiplo ? atual.has(v) : atual === v;
        return h('button', { type: 'button', class: `chip-op chip-mini${on ? ' on' : ''}`, disabled: ro, onclick: () => {
          if (multiplo) {
            let s = new Set(i[campoNome] || []);
            if (s.has(v)) s.delete(v);
            else if (v === exclusivo) s = new Set([v]);
            else { s.delete(exclusivo); s.add(v); }
            i[campoNome] = Object.keys(opcoes).filter((k) => s.has(k));
          } else i[campoNome] = i[campoNome] === v ? '' : v;
          atualizarItem(i.id, { [campoNome]: i[campoNome] }, campoNome === 'sitio');
          desenharChips();
        } }, t);
      }));
    };
    desenharChips();
    return grupo;
  }

  function cartao(i) {
    const def = definicao(i.tipo);
    const alertas = alertasDispositivo(i, hoje());
    const linhaDia = (rot, conteudo) => h('div', { class: 'disp-dia' }, h('span', { class: 'disp-dia-rotulo' }, rot), conteudo);
    const entrada = (campoNome, attrs) => {
      const inp = h('input', { type: 'text', value: i[campoNome] || '', disabled: ro, ...attrs });
      inp.addEventListener('input', () => atualizarItem(i.id, { [campoNome]: inp.value }));
      return inp;
    };
    return h('article', { class: `disp-card${alertas.some((a) => a.nivel === 'alto') ? ' com-alerta' : ''}`, dataset: { tipo: i.tipo } },
      h('div', { class: 'disp-topo' },
        h('strong', { class: 'disp-nome' }, rotuloDispositivo(i)),
        h('span', { class: 'disp-meta' }, i.insercao ? `inserido em ${formatarData(i.insercao)} · ${contagemDia(i.insercao, hoje())}` : 'sem data de inserção'),
        i.implantadoUti === 'nao' && h('span', { class: 'chip' }, 'implantado fora da UTI'),
        botaoChecklist(i),
        !ro && h('span', { class: 'disp-acoes' },
          h('button', { type: 'button', class: 'btn btn-link btn-pequeno', onclick: () => abrirModal(i) }, 'Editar'),
          def.curativo && h('button', { type: 'button', class: 'btn btn-link btn-pequeno', onclick: () => {
            if (!i.curativoTipo) return abrirModal(i, { foco: 'curativoTipo' });
            atualizarItem(i.id, { curativoData: hoje() }, true);
          } }, 'Curativo trocado hoje'),
          h('button', { type: 'button', class: 'btn btn-link btn-pequeno', onclick: () => retirar(i) }, 'Retirar'),
          h('button', { type: 'button', class: 'btn-icone', 'aria-label': 'Apagar lançamento', title: 'Apagar (lançamento feito por engano)', onclick: async () => {
            if (!(await confirmar(`Apagar "${rotuloDispositivo(i)}"? Use só para lançamento feito por engano; para dispositivo removido, use "Retirar".`, { sim: 'Apagar', perigo: true }))) return;
            salvar(lista().filter((x) => x.id !== i.id));
          } }, '×'))),
      def.curativo && h('div', { class: 'disp-meta' }, i.curativoTipo ? `Curativo: ${CURATIVOS[i.curativoTipo].toLowerCase()}${i.curativoData ? `, aplicado em ${formatarData(i.curativoData)}` : ''}` : 'Curativo: sem registro'),
      alertas.length ? h('div', { class: 'chips disp-alertas' }, alertas.map((a) => h('span', { class: `chip ${a.nivel === 'alto' ? 'chip-alerta' : 'chip-atencao'}` }, `⚠ ${a.texto}`))) : null,
      def.sitio && linhaDia('Sítio hoje', chipsDia(i, 'sitio', SITIO, { multiplo: true, exclusivo: 'sem_alteracoes' })),
      def.debito && linhaDia('Débito no período', h('div', { class: 'disp-debito' },
        h('span', { class: 'entrada-com-unidade' }, entrada('volume', { inputmode: 'decimal', placeholder: 'volume', 'aria-label': 'Volume drenado' }), h('span', { class: 'unidade' }, 'mL')),
        entrada('aspecto', { placeholder: 'aspecto (ex.: seroso, serossanguinolento)', 'aria-label': 'Aspecto' }))),
      linhaDia('Ainda é necessário?', chipsDia(i, 'necessario', { sim: 'Sim', nao: 'Não' })));
  }

  // Check-list de inserção (CVC/HD/PICC e CVD implantados na UTI): preencher ou abrir o já salvo.
  function botaoChecklist(i) {
    const tipoCk = tipoChecklistDe(i.tipo);
    const ctx = contexto();
    if (!tipoCk || i.implantadoUti === 'nao' || !ctx.internacao) return null;
    const feito = !!i.checklistInsercao;
    if (ro && !feito) return null;
    return h('button', { type: 'button', class: `chip chip-botao ${feito ? 'chip-ok' : 'chip-atencao'}`, title: 'Check-list de inserção', onclick: async () => {
      const { abrirChecklistInsercao } = await import('../insercao/insercao.js');
      const existente = feito ? await backend.lerChecklistInsercao(i.checklistInsercao).catch(() => null) : null;
      abrirChecklistInsercao({
        tipo: tipoCk, internacao: ctx.internacao, unidade: ctx.unidade, leitoNum: ctx.leitoNum, dispositivo: i, existente,
        aoSalvar: (reg) => atualizarItem(i.id, { checklistInsercao: reg.id, checklistStatus: reg.avaliacao }, true),
      });
    } }, feito ? `✓ Check-list de inserção${i.checklistStatus === 'nao_conforme' ? ' (não conforme)' : i.checklistStatus === 'incompleto' ? ' (incompleto)' : ''}` : '⏳ Check-list de inserção pendente');
  }

  function desenhar() {
    const todos = lista();
    // Garante ids estáveis sem disparar salvamento.
    obter()[c.nome] = todos;
    const ativos = todos.filter(ativo);
    const retirados = todos.filter((i) => i.tipo && i.retirada);
    limpar(el).append(...[
      ativos.length ? h('div', { class: 'disp-lista' }, ativos.map(cartao)) : h('p', { class: 'ajuda' }, 'Nenhum dispositivo ativo.'),
      !ro && h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => abrirModal(null) }, '+ Adicionar dispositivo'),
      retirados.length ? h('details', { class: 'disp-retirados' }, h('summary', {}, `Retirados nesta evolução (${retirados.length})`),
        h('ul', {}, retirados.map((i) => h('li', {}, `${rotuloDispositivo(i)} — retirado em ${formatarData(i.retirada)} `,
          !ro && h('button', { type: 'button', class: 'btn btn-link btn-pequeno', onclick: () => atualizarItem(i.id, { retirada: '' }, true) }, 'Desfazer'))))) : null,
    ].filter(Boolean));
  }

  function retirar(i) {
    const form = h('form', { class: 'formulario', novalidate: true }, campo({ nome: 'retirada', rotulo: 'Data da retirada', tipo: 'date', valor: hoje(), obrigatorio: true }));
    abrirJanela({
      titulo: `Retirar ${rotuloDispositivo(i)}`,
      conteudo: form,
      acoes: [
        { texto: 'Cancelar', classe: 'btn-secundario' },
        { texto: 'Confirmar retirada', classe: 'btn-perigo', aoClicar: () => {
          const { retirada } = lerFormulario(form);
          if (!mostrarErros(form, retirada ? {} : { retirada: 'Informe a data.' })) return false;
          atualizarItem(i.id, { retirada }, true);
        } },
      ],
    });
  }

  function abrirModal(existente, { foco } = {}) {
    const v = existente || {};
    const tipoSel = h('select', { name: 'tipo', id: 'disp-tipo' },
      h('option', { value: '' }, '— selecione o tipo —'),
      GRUPOS_TIPO.map(([g, tipos]) => h('optgroup', { label: g }, tipos.map((t) => h('option', { value: t, selected: v.tipo === t }, CATALOGO_DISPOSITIVOS[t].nome)))));
    const camposEl = h('div', { class: 'disp-campos' });
    const form = h('form', { class: 'formulario', novalidate: true },
      h('div', { class: 'campo', dataset: { campo: 'tipo' } }, h('label', { class: 'campo-rotulo', for: 'disp-tipo' }, 'Tipo de dispositivo', h('span', { class: 'obrigatorio' }, ' *')), tipoSel, h('div', { class: 'campo-erro' })),
      camposEl);

    function desenharCampos() {
      const tipo = tipoSel.value;
      limpar(camposEl);
      if (!tipo) return camposEl.append(h('p', { class: 'ajuda' }, 'Escolha o tipo para ver os campos.'));
      const def = definicao(tipo);
      const cs = def.campos;
      const add = (x) => camposEl.append(x);
      if (cs.includes('descricao')) add(campo({ nome: 'descricao', rotulo: ROTULOS_CAMPO.descricao, valor: v.descricao, obrigatorio: true, attrs: { placeholder: 'Ex.: cateter de PIC, cateter peridural' } }));
      if (cs.includes('subtipo')) add(campo({ nome: 'subtipo', rotulo: ROTULOS_CAMPO.subtipo, tipo: 'select', opcoes: opc(def.subtipos), valor: v.subtipo }));
      if (cs.includes('local')) {
        if (def.locais) {
          const valor = v.local && !def.locais.includes(v.local) ? 'OUTRO' : v.local;
          add(campo({ nome: 'local', rotulo: ROTULOS_CAMPO.local, tipo: 'select', opcoes: opc(def.locais), valor }));
          if (def.locais.includes('OUTRO')) add(campo({ nome: 'localOutro', rotulo: 'Qual localização', valor: v.localOutro || (valor === 'OUTRO' && v.local !== 'OUTRO' ? v.local : '') }));
        } else add(campo({ nome: 'local', rotulo: ROTULOS_CAMPO.local, valor: v.local }));
      }
      if (cs.includes('lado')) add(campo({ nome: 'lado', rotulo: ROTULOS_CAMPO.lado, tipo: 'radio', opcoes: LADOS, valor: v.lado }));
      if (cs.includes('lumens')) add(campo({ nome: 'lumens', rotulo: ROTULOS_CAMPO.lumens, tipo: 'select', opcoes: LUMENS, valor: String(v.lumens || '') }));
      if (cs.includes('calibre')) add(campo({ nome: 'calibre', rotulo: ROTULOS_CAMPO.calibre, valor: v.calibre, attrs: { placeholder: 'Ex.: 20G, 7 Fr' } }));
      if (cs.includes('numero')) add(campo({ nome: 'numero', rotulo: ROTULOS_CAMPO.numero, valor: v.numero, attrs: { inputmode: 'decimal', placeholder: 'Nº' } }));
      if (cs.includes('fixacao')) add(campo({ nome: 'fixacao', rotulo: tipo === 'tot' ? 'Fixação na rima labial (cm)' : 'Fixação na narina ou boca (cm)', valor: v.fixacao, attrs: { inputmode: 'decimal' } }));
      add(campo({ nome: 'insercao', rotulo: 'Data de inserção', tipo: 'date', valor: v.insercao || hoje(), obrigatorio: true }));
      if (def.central || tipo === 'cvd') add(campo({ nome: 'implantadoUti', rotulo: 'Implantado nesta UTI?', tipo: 'radio', opcoes: { sim: 'Sim', nao: 'Não' }, valor: v.implantadoUti || 'sim' }));
      if (def.curativo) {
        add(campo({ nome: 'curativoTipo', rotulo: 'Curativo — tipo', tipo: 'select', opcoes: CURATIVOS, valor: v.curativoTipo }));
        add(campo({ nome: 'curativoData', rotulo: 'Curativo — data da aplicação', tipo: 'date', valor: v.curativoData || (existente ? '' : hoje()) }));
      }
      const sincLocal = () => {
        const sel = form.querySelector('[name=local]');
        const outro = form.querySelector('[data-campo=localOutro]');
        if (sel && outro) outro.hidden = sel.value !== 'OUTRO';
      };
      form.querySelector('[name=local]')?.addEventListener('change', sincLocal);
      sincLocal();
      if (foco) setTimeout(() => form.querySelector(`[name=${foco}]`)?.focus(), 60);
    }
    tipoSel.addEventListener('change', desenharCampos);
    desenharCampos();

    abrirJanela({
      titulo: existente ? 'Editar dispositivo' : 'Adicionar dispositivo',
      conteudo: form,
      acoes: [
        { texto: 'Cancelar', classe: 'btn-secundario' },
        { texto: 'Salvar dispositivo', classe: 'btn-primario', aoClicar: () => {
          const d = lerFormulario(form);
          const def = definicao(d.tipo);
          const erros = {};
          if (!d.tipo) erros.tipo = 'Escolha o tipo.';
          if (d.tipo && !d.insercao) erros.insercao = 'Informe a data de inserção.';
          if (d.insercao && d.insercao > hoje()) erros.insercao = 'A data não pode ser posterior ao dia da evolução.';
          if (def.campos.includes('descricao') && !String(d.descricao || '').trim()) erros.descricao = 'Descreva o dispositivo.';
          if (d.local === 'OUTRO' && !String(d.localOutro || '').trim()) erros.localOutro = 'Informe a localização.';
          if (d.curativoData && d.curativoData > hoje()) erros.curativoData = 'A data não pode ser posterior ao dia da evolução.';
          if (!mostrarErros(form, erros)) return false;
          const limpo = Object.fromEntries(Object.entries(d).map(([k, x]) => [k, typeof x === 'string' ? x.trim() : x]));
          if (limpo.calibre) limpo.calibre = limpo.calibre.toUpperCase();
          if (limpo.local !== 'OUTRO') delete limpo.localOutro;
          const atual = lista();
          if (existente) salvar(atual.map((i) => (i.id === existente.id ? { ...i, ...limpo } : i)));
          else salvar([...atual, { id: novoId(), sitio: [], necessario: '', ...limpo }]);
        } },
      ],
    });
  }

  desenhar();
  // Ao mudar a data do turno ou outro subbloco, os alertas e dias são recalculados.
  let ultimo = '';
  atualizadores.push(() => {
    const chave = hoje();
    if (chave !== ultimo) { ultimo = chave; desenhar(); }
  });
  return el;
}
