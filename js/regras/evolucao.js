// Regras da evolução: validação para finalizar, pendências automáticas,
// situação do registro e texto para o PEP. Funções puras (testáveis no Node).

import { BLOCOS, SUBBLOCOS, contextoEvolucao, visivel, dorDe, ESTADOS_MEDIDA } from './evolucao-esquema.js';
import { checarSinal, num } from './calculos.js';
import { formatarData, formatarDataHora, idade, contagemDia } from './datas.js';
import { rotuloDia, TURNOS } from './turnos.js';
import { ISOLAMENTOS } from './opcoes.js';
import { textoSAE, planoParaNovoDia } from './sae.js';
import { ativo as dispositivoAtivo, alertasDispositivo, rotuloDispositivo } from './dispositivos.js';

const vazio = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

/** Um subbloco conta como registrado se tem algum valor ou foi confirmado "sem alteração". */
export function subblocoRegistrado(ev, id) {
  if (ev.confirmados?.[id]) return true;
  const d = ev.dados?.[id];
  return !!d && Object.values(d).some((v) => !vazio(v) && !(Array.isArray(v) && v.every((x) => typeof x === 'object' && Object.values(x).every(vazio))));
}

/** Pendências geradas pelo próprio sistema (dor e contenção sem reavaliação). */
export function pendenciasAutomaticas(ev) {
  const p = [];
  const dor = ev.dados?.dor || {};
  if (dorDe(dor).comDor && !dor.reavHora) p.push('Dor sem reavaliação registrada');
  const c = ev.dados?.contencao || {};
  if (c.emUso === 'sim' && !c.reavHora) p.push('Contenção mecânica sem reavaliação da necessidade');
  const disp = (ev.dados?.dispositivos?.itens || []).filter(dispositivoAtivo);
  for (const i of disp) if (!i.necessario) p.push(`Avaliar necessidade de permanência: ${rotuloDispositivo(i)}`);
  return p;
}

/**
 * Validação para finalizar. erros: impedem; avisos: pedem confirmação.
 * Valores implausíveis (provável erro de digitação) viram aviso, nunca bloqueio.
 */
export function validarFinalizacao(ev) {
  const erros = [];
  const avisos = [];
  const ctx = contextoEvolucao(ev.dados, ev.data);
  for (const b of BLOCOS) {
    for (const s of b.subblocos) {
      const d = ev.dados?.[s.id] || {};
      const confirmado = !!ev.confirmados?.[s.id];
      if (s.obrigatorio && !confirmado) {
        const faltando = s.campos.filter((c) => c.obrigatorio && visivel(c, d, ctx) && vazio(d[c.nome])).map((c) => c.rotulo);
        if (faltando.length) erros.push(`${s.titulo}: falta ${faltando.join(', ')}`);
      } else if (!s.obrigatorio && !s.opcional && !subblocoRegistrado(ev, s.id) && s.id !== 'intercorrencias' && s.id !== 'pendencias') {
        avisos.push(`${s.titulo}: sem registro neste turno`);
      }
      for (const c of s.campos) {
        if (c.sinal && checarSinal(c.sinal, d[c.nome]) === 'implausivel') avisos.push(`${c.rotulo} = ${d[c.nome]}: valor improvável, confira`);
        if (c.tipo === 'medidas' && visivel(c, d, ctx)) {
          for (const [item, m] of Object.entries(d[c.nome] || {}))
            if (m?.estado === 'nao_realizado' && !String(m.justificativa || '').trim()) erros.push(`${c.rotulo}: "${item}" não realizado sem justificativa`);
        }
      }
    }
  }
  for (const i of (ev.dados?.dispositivos?.itens || []).filter(dispositivoAtivo))
    for (const a of alertasDispositivo(i, ev.data)) avisos.push(`Dispositivo ${rotuloDispositivo(i)}: ${a.texto}`);
  if (ev.dados?.sae?.status !== 'concluido') erros.push('Processo de Enfermagem (blocos 3 a 5): conclua o PE antes de finalizar');
  for (const pa of pendenciasAutomaticas(ev)) avisos.push(`Pendência: ${pa}`);
  return { erros, avisos };
}

/**
 * Situação para o painel: sem_evolucao | rascunho | finalizada | transcrita | alterada_apos_copia.
 */
export function situacaoEvolucao(ev) {
  if (!ev) return 'sem_evolucao';
  if (ev.status !== 'finalizada') return ev.versao > 1 && ev.transcritoPEP ? 'alterada_apos_copia' : 'rascunho';
  if (!ev.transcritoPEP) return 'finalizada';
  return ev.transcritoPEP.versao === ev.versao ? 'transcrita' : 'alterada_apos_copia';
}

export const ROTULO_SITUACAO = {
  sem_evolucao: 'Evolução do dia não iniciada',
  rascunho: 'Evolução em andamento',
  finalizada: 'Finalizada · falta copiar ao PEP',
  transcrita: 'Transcrita ao PEP',
  alterada_apos_copia: 'Alterada após a cópia · atualizar o PEP',
};

// --------------------------------------------------------------------------- texto para o PEP
const limpar = (s) => String(s ?? '').replace(/[–—]/g, '-').replace(/[−]/g, '-').replace(/\s+/g, ' ').trim();

function valorCampo(c, d, ctx) {
  const v = d[c.nome];
  if (c.texto) return vazio(v) ? '' : c.texto(v, ctx, d);
  switch (c.tipo) {
    case 'calculado': return c.calc(d, ctx);
    case 'escolha': case 'select': case 'escala': return vazio(v) ? '' : (c.opcoes[v] ?? v);
    case 'multipla': case 'marcar':
      if (typeof v === 'string') return v; // registro anterior em texto livre
      return vazio(v) ? '' : v.map((x) => c.opcoes[x] ?? x).join(', ');
    case 'data': return v ? formatarData(v) : '';
    case 'datahora': return v ? formatarDataHora(v) : '';
    case 'numero': return vazio(v) ? '' : `${String(v).replace('.', ',')}${c.unidade ? ` ${c.unidade}` : ''}`;
    case 'medidas': {
      const itens = Object.entries(v || {}).filter(([, m]) => m?.estado);
      return itens.map(([item, m]) => `${item}: ${ESTADOS_MEDIDA[m.estado].toLowerCase()}${m.justificativa ? ` (${m.justificativa})` : ''}`).join('; ');
    }
    case 'lista': {
      const itens = (v || []).filter((i) => Object.values(i).some((x) => !vazio(x)));
      return itens.map((i, k) => `${k + 1}) ${c.textoItem ? c.textoItem(i, ctx) : c.campos.map((sc) => { const t = valorCampo(sc, i, ctx); return t ? `${rotuloMin(sc.rotulo)}: ${t}` : ''; }).filter(Boolean).join(', ')}`).join('; ');
    }
    default: return vazio(v) ? '' : String(v);
  }
}

/** Rótulo no meio da frase: primeira letra minúscula, mas siglas ficam como estão (FC, SpO2, RASS). */
const NOMES_PROPRIOS = /^(Glasgow)\b/;
const rotuloMin = (rotulo) => {
  const r = rotulo.replace(/\?$/, '');
  const primeira = r.split(/[\s—-]/)[0];
  if (NOMES_PROPRIOS.test(r) || /[A-Z0-9]/.test(primeira.slice(1))) return r; // sigla (FC, SpO2, RASS) ou nome de escala
  return r.charAt(0).toLowerCase() + r.slice(1);
};

// Campos-parte que já aparecem num calculado (não repetir no texto).
const OMITIR = new Set(['gOcular', 'gVerbal', 'gMotora', 'pupilas', 'fotoD', 'fotoE', 'camAgudo', 'camDesatencao', 'camDesorganizado',
  'escore', 'bpsFacial', 'bpsMembros', 'bpsVentilacao', 'escala', 'pas', 'pad', 'horario', 'unidadeQtd', 'unidadeDose', 'simetria']);

/** Partes do texto de um subbloco (sem título). */
function partesSubbloco(s, d, ctx) {
  const partes = [];
  if (s.id === 'sinais' && (d.pas || d.pad)) partes.push(`pressão arterial: ${d.pas || '?'}x${d.pad || '?'} mmHg`);
  const unico = s.campos.length === 1;
  if (s.id === 'neuro' && (d.pupilas || d.fotoD || d.fotoE)) {
    const pup = { isocoricas: 'isocóricas', anisocoricas: 'anisocóricas', puntiformes: 'puntiformes' }[d.pupilas] || 'não registradas';
    partes.push(`pupilas: ${pup}, fotorreação direita ${d.fotoD || 'não registrada'}, esquerda ${d.fotoE || 'não registrada'}`);
  }
  for (const c of s.campos) {
    if (OMITIR.has(c.nome)) continue;
    if (!visivel(c, d, ctx)) continue;
    const t = limpar(valorCampo(c, d, ctx)).replace(/\.$/, '');
    if (t) partes.push(unico ? t : `${rotuloMin(c.rotulo)}: ${t}`);
  }
  return partes;
}

/** Resumo de um subbloco em uma linha (usado para mostrar o turno anterior). */
export function resumoSubbloco(id, dados, dataTurno) {
  const s = SUBBLOCOS[id];
  const ctx = contextoEvolucao(dados, dataTurno);
  return limpar(partesSubbloco(s, dados?.[id] || {}, ctx).join('; '));
}

function textoSubbloco(s, ev, ctx) {
  const d = ev.dados?.[s.id] || {};
  const partes = partesSubbloco(s, d, ctx);
  const conf = ev.confirmados?.[s.id];
  if (conf && !partes.length) partes.push('sem alteração em relação à evolução anterior');
  if (conf) partes.push(`confirmado sem alteração às ${conf.hora}`);
  const titulo = s.titulo.toUpperCase().replace(/ \(.*\)$/, '') + (s.id === 'sinais' && d.horario ? ` (${d.horario})` : '');
  return partes.length ? `${titulo}: ${limpar(partes.join('; '))}.` : '';
}

/**
 * Texto simples para copiar ao PEP institucional: sem tabelas nem símbolos
 * especiais, em seções. Usa só siglas do Manual da Liga (as ambíguas por extenso).
 */
export function textoParaPEP(ev, internacao, { unidadeNome = '', autor } = {}) {
  const ctx = contextoEvolucao(ev.dados, ev.data);
  const p = internacao.paciente;
  const linhas = [];
  linhas.push(`EVOLUÇÃO DE ENFERMAGEM - ${unidadeNome} - LEITO ${String(ev.leitoId || internacao.leitoId).split('_')[1]} - ${rotuloDia(ev.data).toUpperCase()}${ev.turnoInicio ? ` (TURNO DA ${TURNOS[ev.turnoInicio].nome.toUpperCase()})` : ''}`);
  linhas.push(`Paciente: ${p.nome}. Nascimento: ${formatarData(p.dataNascimento)} (${idade(p.dataNascimento, ev.data)} anos). Registro: ${p.registro}.`);
  const al = internacao.alergias;
  linhas.push(`Alergias: ${al?.situacao === 'possui' ? al.descricao : al?.situacao === 'nega' ? 'nega' : 'sem informação'}. Precaução: ${limpar(ISOLAMENTOS[internacao.isolamento?.tipo] || '')}${internacao.isolamento?.motivo ? ` (${internacao.isolamento.motivo})` : ''}.`);
  linhas.push(`Internação na unidade em ${formatarDataHora(internacao.admissaoUti)} (${contagemDia(internacao.admissaoUti, ev.data)}). Diagnóstico médico: ${limpar(internacao.diagnosticoMedico)}.`);
  for (const b of BLOCOS) {
    const sec = b.subblocos.map((s) => textoSubbloco(s, ev, ctx)).filter(Boolean);
    if (sec.length) {
      linhas.push('');
      linhas.push(...sec);
    }
    // O Processo de Enfermagem (blocos 3 a 5) entra depois da avaliação.
    if (b.id === 'b2' && ev.dados?.sae) {
      const pe = textoSAE(ev.dados.sae);
      if (pe) linhas.push('', pe);
    }
  }
  const auto = pendenciasAutomaticas(ev);
  if (auto.length) linhas.push(`PENDÊNCIAS IDENTIFICADAS PELO SISTEMA: ${auto.join('; ')}.`);
  linhas.push('');
  const a = autor || ev.finalizadoPorNome;
  if (a) linhas.push(`Enfermeiro(a): ${a.nome}, Coren ${a.coren}.${ev.finalizadoEmTexto ? ` Finalizado em ${ev.finalizadoEmTexto}.` : ''}`);
  if (ev.versao > 1 && ev.retificacao?.motivo) linhas.push(`Retificação (versão ${ev.versao}): ${limpar(ev.retificacao.motivo)}.`);
  return linhas.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Dados com que uma evolução nova já nasce, a partir da evolução anterior:
 * pendências abertas, subblocos herdáveis (limitação/objetivo de cuidado, pele,
 * dispositivos ativos, antimicrobianos), o plano do PE e a data da última evacuação.
 * `dados.herdado` registra o que veio da anterior (o aviso "herdado · confira").
 */
export function dadosIniciais(anterior) {
  const dados = {};
  if (!anterior) return dados;
  const pend = pendenciasAbertas(anterior).map((p) => ({ ...p, herdada: true }));
  if (pend.length) dados.pendencias = { itens: pend };
  const subblocos = [];
  for (const s of Object.values(SUBBLOCOS)) {
    const d = anterior.dados?.[s.id];
    if (!s.herdavel || !d || !subblocoRegistrado({ dados: { [s.id]: d } }, s.id)) continue;
    dados[s.id] = s.aoHerdar ? s.aoHerdar(JSON.parse(JSON.stringify(d))) : JSON.parse(JSON.stringify(d));
    subblocos.push(s.id);
  }
  if (anterior.dados?.sae?.diagnosticos?.length) dados.sae = planoParaNovoDia(anterior.dados.sae);
  const gi = anterior.dados?.gi || {};
  const ultimaEvacuacao = gi.evacuou === 'sim' ? anterior.data : (anterior.dados?.herdado?.ultimaEvacuacao || (/^\d{4}-\d{2}-\d{2}$/.test(gi.ultimaEvacuacao || '') ? gi.ultimaEvacuacao : ''));
  dados.herdado = { de: anterior.data, subblocos, ultimaEvacuacao };
  return dados;
}

/** Pendências abertas de uma evolução (para levar à evolução seguinte). */
export function pendenciasAbertas(ev) {
  return (ev?.dados?.pendencias?.itens || []).filter((i) => i.descricao && i.situacao !== 'resolvida');
}

export { SUBBLOCOS };
