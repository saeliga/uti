// Barra de impressos do painel de leitos: capa da ocorrência, ocorrências por
// leito (transição), folhas de balanço hídrico, check-list de IRAS e check-lists
// de inserção de CVC e CVD.

import { backend } from '../../dados/backend.js';
import { h, aviso, abrirJanela } from '../../nucleo/ui.js';
import { hojeISO, somarDias, formatarData } from '../../regras/datas.js';
import { diaAssistencial, diaAnterior, idEvolucao } from '../../regras/turnos.js';
import { CHECKLISTS_INSERCAO, juntarEvolucoes } from '../../regras/impressos.js';
import { ativo as dispositivoAtivo } from '../../regras/dispositivos.js';

const carregarImpressos = () => import('../../impressos/impressos.js');

/**
 * Dados mais recentes do paciente: junta as evoluções de hoje e dos 2 dias
 * anteriores, ficando, para cada subbloco, o registro mais novo que tem conteúdo
 * (a evolução de hoje pode estar só começando).
 */
async function evolucaoRecente(internacaoId) {
  const evs = [];
  let d = diaAssistencial();
  for (let k = 0; k < 3; k++, d = diaAnterior(d)) {
    const ev = await backend.lerEvolucao(idEvolucao(internacaoId, d)).catch(() => null);
    if (ev) evs.push(ev);
  }
  return juntarEvolucoes(evs);
}

async function dadosDosLeitos(leitos) {
  return Promise.all(leitos.map(async (l) => ({
    leito: l, internacao: await backend.lerInternacao(l.internacaoId), ev: await evolucaoRecente(l.internacaoId),
  })));
}

/** Janela com a escolha dos leitos (todos marcados) e, opcionalmente, mais campos. */
function escolherLeitos({ titulo, leitos, extra, aoConfirmar, textoBotao = 'Imprimir' }) {
  const caixas = leitos.map((l) => {
    const cx = h('input', { type: 'checkbox', checked: true, value: l.id });
    return { l, cx, el: h('label', { class: 'opcao' }, cx, h('span', {}, `Leito ${l.numero} — ${l.resumo?.nome || ''}`)) };
  });
  const corpo = h('div', { class: 'formulario' },
    extra?.el,
    h('div', { class: 'linha-acoes' },
      h('button', { type: 'button', class: 'btn btn-link btn-pequeno', onclick: () => caixas.forEach((c) => { c.cx.checked = true; }) }, 'Marcar todos'),
      h('button', { type: 'button', class: 'btn btn-link btn-pequeno', onclick: () => caixas.forEach((c) => { c.cx.checked = false; }) }, 'Desmarcar todos')),
    h('div', { class: 'lista-leitos-imp' }, caixas.map((c) => c.el)));
  abrirJanela({
    titulo, conteudo: corpo,
    acoes: [
      { texto: 'Cancelar', classe: 'btn-secundario' },
      { texto: textoBotao, classe: 'btn-primario', aoClicar: async () => {
        const escolhidos = caixas.filter((c) => c.cx.checked).map((c) => c.l);
        if (!escolhidos.length) { aviso('Escolha pelo menos um leito.', 'atencao'); return false; }
        try {
          await aoConfirmar(escolhidos, extra?.valor?.());
        } catch (e) {
          aviso(`Não foi possível montar a impressão: ${e.message}`, 'erro', 8000);
          return false;
        }
      } },
    ],
  });
}

export function barraImpressos(unidade, leitos) {
  const ocupados = leitos.filter((l) => l.internacaoId);
  const semPacientes = () => { aviso('Não há pacientes internados nesta unidade.', 'atencao'); };

  const capa = async () => {
    const m = await carregarImpressos();
    m.imprimirFolhas([m.folhaCapa(unidade, hojeISO())]);
  };

  const ocorrencias = () => {
    if (!ocupados.length) return semPacientes();
    escolherLeitos({
      titulo: 'Ocorrências de enfermagem (fase de transição)',
      leitos: ocupados,
      extra: { el: h('p', { class: 'ajuda' }, `Uma folha por leito, com data de hoje (${formatarData(hojeISO())}). Identificação, dispositivos, infusões, antimicrobianos, dieta, eliminações e lesões vêm da evolução mais recente.`) },
      aoConfirmar: async (escolhidos) => {
        const [m, dados] = await Promise.all([carregarImpressos(), dadosDosLeitos(escolhidos)]);
        m.imprimirFolhas(dados.map(({ leito, internacao, ev }) => m.folhaOcorrencia(internacao, ev, { leitoNum: leito.numero, data: hojeISO() })));
      },
    });
  };

  const balanco = () => {
    if (!ocupados.length) return semPacientes();
    const hoje = hojeISO();
    const amanha = somarDias(hoje, 1);
    let data = new Date().getHours() >= 18 ? amanha : hoje;
    const opc = (valor, rotulo) => h('label', { class: 'opcao' },
      h('input', { type: 'radio', name: 'data-bh', value: valor, checked: data === valor, onchange: () => { data = valor; } }), h('span', {}, rotulo));
    escolherLeitos({
      titulo: 'Folhas de balanço hídrico',
      leitos: ocupados,
      extra: {
        el: h('div', {}, h('div', { class: 'campo-rotulo' }, 'Data da folha'), h('div', { class: 'opcoes' }, opc(hoje, `Hoje (${formatarData(hoje)})`), opc(amanha, `Amanhã (${formatarData(amanha)})`)),
          h('p', { class: 'ajuda' }, 'Duas páginas em paisagem por leito (frente e verso). Os dias de UTI, de dispositivos e de antimicrobianos são contados para a data da folha.')),
        valor: () => data,
      },
      aoConfirmar: async (escolhidos, dataFolha) => {
        const [m, dados] = await Promise.all([carregarImpressos(), dadosDosLeitos(escolhidos)]);
        m.imprimirFolhas(dados.flatMap(({ leito, internacao, ev }) => m.folhasBH(internacao, ev, { leitoNum: leito.numero, dataFolha })));
      },
    });
  };

  const insercao = () => {
    const sel = h('select', { 'aria-label': 'Leito' },
      ocupados.map((l) => h('option', { value: l.id }, `Leito ${l.numero} — ${l.resumo?.nome || ''}`)),
      h('option', { value: '' }, 'Em branco (sem paciente)'));
    let tipo = 'cvc';
    const tipos = h('div', { class: 'opcoes' }, Object.entries({ cvc: 'Cateter venoso central (CVC)', cvd: 'Cateter vesical de demora (CVD)' }).map(([v, t]) =>
      h('label', { class: 'opcao' }, h('input', { type: 'radio', name: 'tipo-ins', value: v, checked: v === tipo, onchange: () => { tipo = v; } }), h('span', {}, t))));
    abrirJanela({
      titulo: 'Check-list de inserção',
      conteudo: h('div', { class: 'formulario' },
        h('div', {}, h('div', { class: 'campo-rotulo' }, 'Dispositivo'), tipos),
        h('div', { class: 'campo' }, h('label', { class: 'campo-rotulo' }, 'Paciente'), sel),
        h('p', { class: 'ajuda' }, 'Se o dispositivo já estiver registrado na evolução, localização, lado, lúmens e data vêm marcados.')),
      acoes: [
        { texto: 'Cancelar', classe: 'btn-secundario' },
        { texto: 'Imprimir', classe: 'btn-primario', aoClicar: async () => {
          const m = await carregarImpressos();
          const l = ocupados.find((x) => x.id === sel.value);
          if (!l) {
            m.imprimirFolhas([m.folhaInsercao(tipo, { paciente: {} }, { leitoNum: '', unidadeNome: unidade.nome, data: hojeISO() })]);
            return;
          }
          const [internacao, ev] = await Promise.all([backend.lerInternacao(l.internacaoId), evolucaoRecente(l.internacaoId)]);
          const disp = (ev?.dados?.dispositivos?.itens || []).filter(dispositivoAtivo).filter((i) => CHECKLISTS_INSERCAO[tipo].tipos.includes(i.tipo))
            .sort((a, b) => String(b.insercao || '').localeCompare(String(a.insercao || '')))[0];
          m.imprimirFolhas([m.folhaInsercao(tipo, internacao, { leitoNum: l.numero, unidadeNome: unidade.nome, data: hojeISO(), dispositivo: disp })]);
        } },
      ],
    });
  };

  return h('div', { class: 'barra-impressos', role: 'toolbar', 'aria-label': 'Impressos da unidade' },
    h('span', { class: 'barra-rotulo' }, 'Impressos'),
    h('button', { type: 'button', class: 'btn btn-secundario btn-pequeno', onclick: capa }, 'Capa da ocorrência'),
    h('button', { type: 'button', class: 'btn btn-secundario btn-pequeno', onclick: ocorrencias }, 'Ocorrências (transição)'),
    h('button', { type: 'button', class: 'btn btn-secundario btn-pequeno', onclick: balanco }, 'Balanço hídrico'),
    h('a', { class: 'btn btn-secundario btn-pequeno', href: `#/iras/${unidade.id}` }, 'Check-list de IRAS'),
    h('button', { type: 'button', class: 'btn btn-secundario btn-pequeno', onclick: insercao }, 'Check-list de inserção'));
}

export { evolucaoRecente };
