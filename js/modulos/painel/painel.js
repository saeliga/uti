// Painel de leitos de uma unidade: situação de cada leito em tempo real.

import { backend } from '../../dados/backend.js';
import { estado, podeEditar } from '../../nucleo/estado.js';
import { h, limpar, carregando, aviso, confirmar, abrirJanela, campo, lerFormulario, anexar } from '../../nucleo/ui.js';
import { contagemDia, idade, hojeISO } from '../../regras/datas.js';
import { ISOLAMENTOS, MOTIVOS_BLOQUEIO } from '../../regras/opcoes.js';
import { diaAssistencial, rotuloDia } from '../../regras/turnos.js';
import { situacaoEvolucao, ROTULO_SITUACAO } from '../../regras/evolucao.js';
import { ROTULO_STATUS_PE } from '../../regras/sae.js';
import { barraImpressos } from './impressos.js';

const ordenar = (a, b) => a.numero.localeCompare(b.numero, 'pt', { numeric: true });

export function telaPainel(conteudo, unidade) {
  carregando(conteudo, `Carregando leitos da ${unidade.nome}…`);
  let leitos = null;
  let evolucoes = {};
  let dia = diaAssistencial();
  const redesenhar = () => leitos && desenhar(conteudo, unidade, leitos, evolucoes, dia);
  const pararLeitos = backend.observarLeitos(
    unidade.id,
    (ls, meta) => {
      estado.atualizarConexao?.(meta);
      leitos = ls.sort(ordenar);
      redesenhar();
    },
    (erro) => limpar(conteudo).append(h('p', { class: 'vazio' }, erro.message)),
  );
  let pararEvol = null;
  const observarDia = () => {
    pararEvol?.();
    pararEvol = backend.observarEvolucoesDia(unidade.id, dia, (lista) => {
      evolucoes = Object.fromEntries(lista.map((e) => [e.internacaoId, e]));
      redesenhar();
    });
  };
  observarDia();
  // Na virada do dia assistencial (07h), passa a mostrar o novo dia.
  const relogio = setInterval(() => {
    const d = diaAssistencial();
    if (d !== dia) {
      dia = d;
      evolucoes = {};
      observarDia();
    }
  }, 60000);
  return () => {
    pararLeitos?.();
    pararEvol?.();
    clearInterval(relogio);
  };
}

function desenhar(conteudo, unidade, leitos, evolucoes, dia) {
  const ocupados = leitos.filter((l) => l.internacaoId);
  const bloqueados = leitos.filter((l) => l.bloqueado).length;
  const livres = leitos.length - ocupados.length - bloqueados;
  const sits = ocupados.map((l) => situacaoEvolucao(evolucoes[l.internacaoId]));
  const faltam = sits.filter((x) => x === 'sem_evolucao' || x === 'rascunho').length;
  const semPEP = sits.filter((x) => x === 'finalizada' || x === 'alterada_apos_copia').length;
  const rolagem = window.scrollY;
  anexar(limpar(conteudo), 
    h('div', { class: 'painel-cabecalho' },
      h('h1', {}, unidade.nome),
      h('div', { class: 'painel-contagem' },
        h('span', {}, h('strong', {}, ocupados.length), ' ocupados'),
        h('span', {}, h('strong', {}, livres), ' livres'),
        bloqueados ? h('span', {}, h('strong', {}, bloqueados), ' bloqueados') : null)),
    barraImpressos(unidade, leitos),
    ocupados.length ? h('div', { class: 'painel-turno' },
      h('strong', {}, `Evoluções do ${rotuloDia(dia).toLowerCase()}`), ' (07h às 07h): ',
      faltam ? `${faltam} de ${ocupados.length} a concluir` : 'todas finalizadas',
      semPEP ? ` · ${semPEP} a copiar ao PEP` : '') : null,
    h('div', { class: 'grade-leitos' }, leitos.map((l) => cartao(l, unidade, evolucoes[l.internacaoId]))));
  window.scrollTo(0, rolagem);
}

function chipAlergia(al) {
  if (!al) return null;
  if (al.situacao === 'possui') return h('span', { class: 'chip chip-alerta', title: 'Alergia' }, '⚠ ALERGIA: ', al.descricao);
  if (al.situacao === 'desconhecida') return h('span', { class: 'chip chip-atencao' }, 'Alergias: sem informação');
  return null;
}

function chipIsolamento(iso) {
  if (!iso || iso.tipo === 'padrao') return null;
  return h('span', { class: 'chip chip-isolamento' }, 'Isolamento: ', ISOLAMENTOS[iso.tipo]?.replace(/ \(.*\)$/, '') || iso.tipo);
}

function cartao(l, unidade, ev) {
  const rotulo = `Leito ${l.numero}`;
  if (l.internacaoId && l.resumo) {
    const r = l.resumo;
    const hoje = hojeISO();
    const sit = situacaoEvolucao(ev);
    return h('div', { class: `leito leito-ocupado sit-borda-${sit}` },
      h('button', { class: 'leito-abrir', type: 'button', 'aria-label': `${rotulo}, ${r.nome}: abrir dados da internação`, onclick: () => abrirDetalhe(l, unidade) },
        h('div', { class: 'leito-topo' },
          h('span', { class: 'leito-num' }, rotulo),
          h('span', { class: 'leito-dia', title: 'Dias de UTI (admissão = D0)' }, `UTI ${contagemDia(r.admissaoUti, hoje)}`)),
        h('div', { class: 'leito-nome' }, r.nome),
        h('div', { class: 'leito-ident' }, `${idade(r.dataNascimento, hoje)} anos · Reg. ${r.registro}`),
        h('div', { class: 'leito-diag' }, r.diagnosticoMedico),
        h('div', { class: 'leito-chips' }, chipAlergia(r.alergias), chipIsolamento(r.isolamento))),
      h('a', { class: `leito-evolucao sit-${sit}`, href: `#/evolucao/${l.internacaoId}` },
        h('span', {}, ROTULO_SITUACAO[sit],
          sit === 'rascunho' && ev?.dados?.sae?.status ? h('span', { class: `leito-pe sae-status-${ev.dados.sae.status}` }, ` · ${ROTULO_STATUS_PE[ev.dados.sae.status]}`) : null),
        h('span', { 'aria-hidden': 'true' }, '→')));
  }
  if (l.bloqueado) {
    return h('div', { class: 'leito leito-bloqueado' },
      h('div', { class: 'leito-topo' }, h('span', { class: 'leito-num' }, rotulo), h('span', { class: 'leito-status' }, 'Bloqueado')),
      h('div', { class: 'leito-motivo' }, l.bloqueio?.motivo || ''),
      podeEditar() && h('button', { class: 'btn btn-secundario btn-pequeno', type: 'button', onclick: () => desbloquear(l) }, 'Desbloquear'));
  }
  return h('div', { class: 'leito leito-livre' },
    h('div', { class: 'leito-topo' }, h('span', { class: 'leito-num' }, rotulo), h('span', { class: 'leito-status' }, 'Livre')),
    podeEditar() && h('div', { class: 'leito-acoes' },
      h('button', { class: 'btn btn-secundario', type: 'button', onclick: () => admitir(l, unidade) }, '+ Admitir paciente'),
      h('button', { class: 'btn btn-link', type: 'button', onclick: () => bloquearLeito(l) }, 'Bloquear leito')));
}

async function admitir(leito, unidade) {
  const { formularioInternacao } = await import('../internacao/internacao.js');
  formularioInternacao({ leito, unidade });
}

async function abrirDetalhe(leito, unidade) {
  const { detalheInternacao } = await import('../internacao/internacao.js');
  detalheInternacao({ leito, unidade });
}

function bloquearLeito(leito) {
  const form = h('form', { class: 'formulario' },
    campo({ nome: 'motivo', rotulo: 'Motivo', tipo: 'select', opcoes: Object.fromEntries(MOTIVOS_BLOQUEIO.map((m) => [m, m])) }),
    campo({ nome: 'outro', rotulo: 'Descreva (se "Outro")' }));
  abrirJanela({
    titulo: `Bloquear leito ${leito.numero}`,
    conteudo: form,
    acoes: [
      { texto: 'Cancelar', classe: 'btn-secundario' },
      {
        texto: 'Bloquear', classe: 'btn-primario',
        aoClicar: async () => {
          const d = lerFormulario(form);
          const motivo = d.motivo === 'Outro' ? `Outro: ${d.outro.trim()}` : d.motivo;
          if (!d.motivo || (d.motivo === 'Outro' && !d.outro.trim())) {
            aviso('Informe o motivo do bloqueio.', 'atencao');
            return false;
          }
          try {
            await backend.bloquearLeito(leito.id, motivo);
            aviso(`Leito ${leito.numero} bloqueado.`, 'ok');
          } catch (e) {
            aviso(e.message, 'erro');
            return false;
          }
        },
      },
    ],
  });
}

async function desbloquear(leito) {
  if (!(await confirmar(`Desbloquear o leito ${leito.numero}?`, { sim: 'Desbloquear' }))) return;
  try {
    await backend.desbloquearLeito(leito.id);
    aviso(`Leito ${leito.numero} liberado.`, 'ok');
  } catch (e) {
    aviso(e.message, 'erro');
  }
}
