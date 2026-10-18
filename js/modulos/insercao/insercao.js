// Check-lists de inserção de CVC e CVD preenchidos no sistema (modelo atual da
// Liga, versão 2). O registro fica salvo (indicador de adesão ao bundle de
// inserção) e pode ser impresso no mesmo leiaute do papel.

import { backend } from '../../dados/backend.js';
import { estado, podeEditar } from '../../nucleo/estado.js';
import { h, aviso, abrirJanela, confirmar } from '../../nucleo/ui.js';
import { hojeISO, formatarData } from '../../regras/datas.js';
import {
  CHECKLISTS_INSERCAO, OPCOES_SITUACAO, OPCOES_LOCAL_CVC, OPCOES_LUMENS, INDICACOES_CVD,
  novoChecklistInsercao, avaliarInsercao, validarInsercao,
} from '../../regras/impressos.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const responsavelPadrao = () => (estado.perfil ? `${estado.perfil.nome}${estado.perfil.coren ? ` (Coren ${estado.perfil.coren})` : ''}` : '');
export const ROTULO_STATUS_INSERCAO = { conforme: 'Bundle conforme', nao_conforme: 'Bundle não conforme', incompleto: 'Incompleto' };

/**
 * Abre o check-list para preencher (novo) ou revisar (existente).
 * opcoes: { tipo, internacao, unidade:{id,nome}, leitoNum, dispositivo, existente, aoSalvar(reg) }
 */
export function abrirChecklistInsercao({ tipo, internacao, unidade, leitoNum, dispositivo, existente, aoSalvar }) {
  const ro = !podeEditar();
  const reg = existente ? clone(existente) : novoChecklistInsercao(tipo, { dispositivo, data: hojeISO(), setor: unidade.nome, responsavel: responsavelPadrao() });
  const id = existente?.id || `${internacao.id}_${tipo}_${Date.now().toString(36)}`;
  const ck = CHECKLISTS_INSERCAO[tipo];
  const p = internacao.paciente || {};
  reg.respostas ||= {};
  reg.detalhes ||= {};

  const situacaoEl = h('div', { class: 'ins-status', 'aria-live': 'polite' });
  const atualizarStatus = () => {
    const a = avaliarInsercao(reg);
    situacaoEl.className = `ins-status ins-${a.status}`;
    situacaoEl.textContent = a.status === 'incompleto' ? `${a.respondidos} de ${a.total} itens respondidos` : `${ROTULO_STATUS_INSERCAO[a.status]} (${a.conformes}/${a.total})`;
  };

  // Componentes simples (toque grande, como o resto do sistema)
  const escolha = (campo, opcoes, { aoMudar } = {}) => {
    const grupo = h('div', { class: 'chips' });
    const desenhar = () => grupo.replaceChildren(...Object.entries(opcoes).map(([v, t]) => h('button', {
      type: 'button', class: `chip-op chip-mini${reg[campo] === v ? ' on' : ''}`, disabled: ro,
      onclick: () => { reg[campo] = reg[campo] === v ? '' : v; desenhar(); aoMudar?.(); },
    }, t)));
    desenhar();
    return grupo;
  };
  const texto = (campo, attrs = {}) => {
    const i = h('input', { type: 'text', value: reg[campo] || '', disabled: ro, ...attrs });
    i.addEventListener('input', () => { reg[campo] = i.value; });
    return i;
  };
  const bloco = (rotulo, ...filhos) => h('div', { class: 'ins-bloco' }, h('div', { class: 'campo-rotulo' }, rotulo), ...filhos);
  const condicional = (el, cond) => { el.hidden = !cond(); return el; };

  const cabecalho = [];
  if (tipo === 'cvc') {
    const setorEl = bloco('Se não foi na UTI, em qual setor foi passado?', texto('setor'));
    const motivoSit = bloco('Motivo da reinserção (troca)', texto('situacaoMotivo'));
    const motivoInd = bloco('Motivo (indicação)', texto('indicacaoMotivo'));
    const ladoEl = bloco('Lado', escolha('lado', { D: 'Direita / Direito', E: 'Esquerda / Esquerdo' }));
    const sinc = () => {
      condicional(setorEl, () => reg.naUti === 'nao');
      condicional(motivoSit, () => reg.situacao === 'reinsercao');
      condicional(motivoInd, () => reg.indicacao === 'reinsercao');
      condicional(ladoEl, () => !!reg.local);
    };
    const lumensEl = h('div');
    const desenharLumens = () => lumensEl.replaceChildren(reg.cateter ? escolha('lumens', reg.cateter === 'hd' ? { duplo: OPCOES_LUMENS.duplo, triplo: OPCOES_LUMENS.triplo } : OPCOES_LUMENS) : '');
    cabecalho.push(
      bloco('O cateter foi passado na UTI/UCI?', escolha('naUti', { sim: 'Sim', nao: 'Não' }, { aoMudar: sinc })), setorEl,
      bloco('Situação de inserção', escolha('situacao', OPCOES_SITUACAO, { aoMudar: sinc })), motivoSit,
      bloco('Tipo de cateter', escolha('cateter', { cvc: 'Cateter venoso central', hd: 'Cateter venoso central de HD' }, { aoMudar: () => { if (reg.cateter === 'hd' && reg.lumens === 'mono') reg.lumens = ''; desenharLumens(); } }), lumensEl,
        h('label', { class: 'ins-inline' }, 'Outros: ', texto('cateterOutro', { placeholder: 'Ex.: PICC' }))),
      bloco('Indicação', escolha('indicacao', OPCOES_SITUACAO, { aoMudar: sinc })), motivoInd,
      bloco('Local de inserção do cateter', escolha('local', OPCOES_LOCAL_CVC, { aoMudar: sinc }), h('label', { class: 'ins-inline' }, 'Outro: ', texto('localOutro'))), ladoEl,
    );
    desenharLumens();
    sinc();
  } else {
    reg.indicacoes ||= [];
    const especifique = bloco('Especifique (monitorização do débito urinário)', texto('indicacaoEspecifique'));
    const lista = h('div', { class: 'ins-indicacoes' }, Object.entries(INDICACOES_CVD).map(([k, t]) => {
      const cxEl = h('input', { type: 'checkbox', checked: reg.indicacoes.includes(k), disabled: ro });
      cxEl.addEventListener('change', () => {
        reg.indicacoes = Object.keys(INDICACOES_CVD).filter((x) => (x === k ? cxEl.checked : reg.indicacoes.includes(x)));
        especifique.hidden = !reg.indicacoes.includes('monitorizacao');
      });
      return h('label', { class: 'marcar-op' }, cxEl, h('span', {}, t));
    }));
    especifique.hidden = !reg.indicacoes.includes('monitorizacao');
    cabecalho.push(bloco('O cateter foi passado em qual setor?', texto('setor')), bloco('Indicação de inserção', lista), especifique);
  }

  // Itens SIM / NÃO por seção
  const secoes = ck.secoes.map((s) => h('div', { class: 'ins-secao' },
    h('div', { class: 'ins-secao-titulo' }, s.titulo),
    ...s.itens.map((i) => {
      const det = i.detalhe ? h('input', { type: 'text', placeholder: 'Especifique', value: reg.detalhes[i.id] || '', disabled: ro, class: 'ins-detalhe' }) : null;
      det?.addEventListener('input', () => { reg.detalhes[i.id] = det.value; });
      const botoes = h('div', { class: 'chips ins-simnao' });
      const desenhar = () => {
        botoes.replaceChildren(...[['sim', 'SIM'], ['nao', 'NÃO']].map(([v, t]) => {
          const on = reg.respostas[i.id] === v;
          const naoConforme = on && v !== (i.esperado || 'sim');
          return h('button', { type: 'button', class: `chip-op chip-mini${on ? ' on' : ''}${naoConforme ? ' ins-nc' : ''}`, disabled: ro, onclick: () => {
            reg.respostas[i.id] = reg.respostas[i.id] === v ? '' : v;
            if (!reg.respostas[i.id]) delete reg.respostas[i.id];
            desenhar();
            atualizarStatus();
          } }, t);
        }));
        if (det) det.hidden = reg.respostas[i.id] !== 'sim';
      };
      desenhar();
      return h('div', { class: 'ins-item' }, h('div', { class: 'ins-item-texto' }, i.texto, i.nota ? h('small', {}, i.nota) : null, det), botoes);
    })));

  const dataEl = h('input', { type: 'date', value: reg.data || '', max: hojeISO(), disabled: ro });
  dataEl.addEventListener('change', () => { reg.data = dataEl.value; });
  const area = (campo) => { const t = h('textarea', { rows: 2, disabled: ro }); t.value = reg[campo] || ''; t.addEventListener('input', () => { reg[campo] = t.value; }); return t; };

  const corpo = h('div', { class: 'formulario ins-form' },
    h('div', { class: 'ins-paciente' }, h('strong', {}, p.nome || 'Paciente'), ` · nasc. ${p.dataNascimento ? formatarData(p.dataNascimento) : '—'} · arquivo ${p.registro || '—'}${leitoNum ? ` · leito ${leitoNum}` : ''}`),
    bloco('Data', dataEl),
    ...cabecalho,
    ...secoes,
    bloco('Equipe participante', texto('equipe', { placeholder: 'Ex.: Dr(a). … + Enf. … + Téc. …' })),
    bloco('Observações', area('observacoes')),
    bloco('Responsável pelo preenchimento', texto('responsavel')),
    situacaoEl);
  atualizarStatus();

  const salvar = async (imprimir) => {
    const erros = validarInsercao(reg);
    if (erros.length && !(await confirmar(`Faltam itens: ${erros.join(' ')} Salvar mesmo assim (fica como incompleto)?`, { sim: 'Salvar incompleto' }))) return false;
    const dados = {
      ...reg, tipo, unidade: unidade.id, internacaoId: internacao.id, leitoId: internacao.leitoId || '', leitoNum: leitoNum || '',
      dispositivoId: dispositivo?.id || reg.dispositivoId || '', avaliacao: avaliarInsercao(reg).status,
    };
    try {
      await Promise.race([backend.salvarChecklistInsercao(id, dados), new Promise((r) => setTimeout(r, 4000))]);
      aviso('Check-list de inserção salvo.', 'ok');
      aoSalvar?.({ id, ...dados });
      if (imprimir) {
        const m = await import('../../impressos/impressos.js');
        m.imprimirFolhas([m.folhaInsercao(internacao, dados)], { unidade: unidade.id, internacaoId: internacao.id });
      }
    } catch (e) {
      aviso(e.message, 'erro', 8000);
      return false;
    }
  };

  abrirJanela({
    titulo: `Check-list de inserção de ${tipo === 'cvc' ? 'cateter venoso central' : 'cateter vesical de demora'}`,
    conteudo: corpo,
    acoes: ro ? [
      { texto: 'Fechar', classe: 'btn-secundario' },
      { texto: 'Imprimir', classe: 'btn-primario', aoClicar: async () => { const m = await import('../../impressos/impressos.js'); m.imprimirFolhas([m.folhaInsercao(internacao, reg)], { unidade: unidade.id, internacaoId: internacao.id }); } },
    ] : [
      { texto: 'Cancelar', classe: 'btn-secundario' },
      { texto: 'Salvar', classe: 'btn-secundario', aoClicar: () => salvar(false) },
      { texto: 'Salvar e imprimir', classe: 'btn-primario', aoClicar: () => salvar(true) },
    ],
  });
}
