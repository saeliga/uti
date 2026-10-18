// Regras da evolução: validação para finalizar, pendências automáticas,
// situação do registro e texto para o PEP. Funções puras (testáveis no Node).

import { BLOCOS, SUBBLOCOS, contextoEvolucao, visivel, dorDe, ESTADOS_MEDIDA, camDe } from './evolucao-esquema.js';
import { checarSinal, num, pam as pamCalc } from './calculos.js';
import { formatarData, formatarDataHora, contagemDia, diasEntre } from './datas.js';
import { TURNOS } from './turnos.js';
import { ISOLAMENTOS } from './opcoes.js';
import { planoParaNovoDia, enunciado, STATUS_ATIVIDADE, DECISOES } from './sae.js';
import { ativo as dispositivoAtivo, alertasDispositivo, rotuloDispositivo, textoDispositivos } from './dispositivos.js';
import { RASS, glasgow as glasgowDe } from './escalas.js';
import { normalizarInfusoes, textoInfusoes } from './infusoes.js';

const pamDe = (d) => pamCalc(d.pas, d.pad);

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

// --------------------------------------------------------------------------- texto para o PEP (SBAR)
// Formato SBAR, em frases curtas como o enfermeiro escreve, tudo em caixa alta
// (padrão da Liga). Sem identificação do paciente nem assinatura: o PEP já
// registra o paciente, a data, o autor e imprime nome e Coren.
const TITULO_A = {
  sinais: 'SINAIS VITAIS', neuro: 'NEUROLÓGICO', dor: 'DOR', respiratorio: 'RESPIRATÓRIO', hemodinamica: 'CARDIOVASCULAR', abdome: 'ABDOME',
  infusoes: 'INFUSÕES CONTÍNUAS', renal: 'RENAL', gi: 'GASTRINTESTINAL E NUTRIÇÃO', pele: 'PELE E LESÕES', dispositivos: 'DISPOSITIVOS', contencao: 'CONTENÇÃO MECÂNICA',
};
const juntar = (...p) => p.flat().filter(Boolean).join(', ');
const frases = (...p) => p.flat().filter(Boolean).map((t) => limpar(t).replace(/\.$/, '')).join('. ');
const campoDe = (sid, nome) => SUBBLOCOS[sid].campos.find((c) => c.nome === nome);
const op1 = (sid, nome, v) => (vazio(v) ? '' : String(campoDe(sid, nome).opcoes[v] ?? v));
const opN = (sid, nome, v) => (Array.isArray(v) ? v.map((x) => String(campoDe(sid, nome).opcoes[x] ?? x)) : (vazio(v) ? [] : [String(v)]));
const minus = (t) => String(t || '').toLowerCase();
const nu = (v, u = '') => (vazio(v) ? '' : `${String(v).replace('.', ',')}${u}`);
const vis = (sid, nome, d, ctx) => visivel(campoDe(sid, nome), d, ctx);
const rassTexto = (v) => { const [n, ...r] = limpar(RASS[v] || v).split(' '); return r.length ? `${n} (${r.join(' ')})` : n; };
const eLista = (l) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}` : l[0] || '');

const FRASES = {
  sinais: (d) => {
    const vPam = pamDe(d);
    return juntar((d.pas || d.pad) && `pressão arterial ${d.pas || '?'}x${d.pad || '?'} mmHg${vPam != null ? ` (PAM ${vPam} mmHg)` : ''}`,
      d.fc && `FC ${nu(d.fc)} bpm`, d.fr && `frequência respiratória ${nu(d.fr)} irpm`, d.t && `temperatura ${nu(d.t)} °C`,
      d.spo2 && `SpO2 ${nu(d.spo2)}%`, d.hgt && `HGT ${nu(d.hgt)} mg/dL`);
  },
  neuro: (d) => {
    let nivel;
    if (d.consciencia === 'sedado') nivel = juntar('sob sedação', d.rass && `RASS ${rassTexto(d.rass)}`, d.metaRass && `meta RASS ${rassTexto(d.metaRass).split(' ')[0]}`);
    else {
      const g = glasgowDe({ ocular: d.gOcular, verbal: d.gVerbal, motora: d.gMotora });
      nivel = juntar(minus(op1('neuro', 'consciencia', d.consciencia)), g.completo && `Glasgow ${g.texto} (O${d.gOcular} V${d.gVerbal} M${d.gMotora})`);
    }
    const pup = d.pupilas && juntar(`pupilas ${minus(op1('neuro', 'pupilas', d.pupilas))}`,
      d.fotoD === 'presente' && d.fotoE === 'presente' ? 'fotorreagentes' : d.fotoD === 'ausente' && d.fotoE === 'ausente' ? 'sem fotorreação'
        : (d.fotoD || d.fotoE) && `fotorreação direita ${d.fotoD || 'não avaliada'} e esquerda ${d.fotoE || 'não avaliada'}`);
    const inter = d.consciencia === 'sedado' && { realizada: 'interrupção diária da sedação realizada', nao_realizada: 'interrupção diária da sedação não realizada' }[d.interrupcao];
    const cam = d.consciencia && { positivo: 'CAM-ICU positivo', negativo: 'CAM-ICU negativo' }[camDe(d).resultado];
    return frases(nivel, pup, juntar(inter, cam));
  },
  dor: (d) => {
    const r = dorDe(d);
    if (d.escala === 'nao_avaliavel') return 'dor não avaliável';
    if (r.total == null) return '';
    if (!r.comDor) return `${minus(r.classe)} (${r.escala} ${r.total})`;
    return juntar(`${minus(r.classe)} (${r.escala} ${r.total})${d.local ? ` em ${d.local}` : ''}`,
      d.conduta?.length && `conduta ${eLista(opN('dor', 'conduta', d.conduta).map(minus))}`, d.reavHora && `reavaliada às ${d.reavHora}${vazio(d.reavEscore) ? '' : ` com escore ${d.reavEscore}`}`);
  },
  respiratorio: (d, ctx) => {
    const v = (n) => vis('respiratorio', n, d, ctx) && !vazio(d[n]);
    const sup = d.suporte && (d.suporte === 'aa' ? 'em ar ambiente' : `em ${op1('respiratorio', 'suporte', d.suporte)}`);
    const parametros = juntar(v('fluxo') && `${nu(d.fluxo)} L/min`, v('modo') && d.modo, v('peep') && `PEEP ${nu(d.peep)} cmH2O`, v('pSuporte') && `pressão de suporte ${nu(d.pSuporte)} cmH2O`,
      v('vc') && `VC ${nu(d.vc)} mL`, v('frProgramada') && `frequência programada ${nu(d.frProgramada)} irpm`, v('fio2') && `FiO2 ${nu(d.fio2)}%`);
    const local = (n) => (v(n) ? eLista(opN('respiratorio', n, d[n]).map(minus)) : '');
    const ausc = (Array.isArray(d.ausculta) ? d.ausculta : []).map((x) => {
      if (x === 'mv_diminuidos') return `MV diminuídos${local('mvDiminuidosLocal') ? ` em ${local('mvDiminuidosLocal')}` : ''}`;
      if (x === 'mv_abolidos') return `MV abolidos${local('mvAbolidosLocal') ? ` em ${local('mvAbolidosLocal')}` : ''}`;
      return campoDe('respiratorio', 'ausculta').opcoes[x] ?? x;
    });
    const sec = d.secrecao === 'ausente' ? 'sem secreção' : d.secrecao ? juntar(`secreção em ${minus(op1('respiratorio', 'secrecao', d.secrecao))} quantidade`, v('secrecaoAspecto') && d.secrecaoAspecto) : '';
    return frases(juntar(sup, parametros), juntar(opN('respiratorio', 'padrao', d.padrao).map(minus)), juntar(ausc), sec);
  },
  hemodinamica: (d, ctx) => {
    const ritmo = d.ritmo === 'outro' ? (d.ritmoOutro ? `ritmo ${d.ritmoOutro}` : '') : d.ritmo && `ritmo ${minus(op1('hemodinamica', 'ritmo', d.ritmo))}`;
    const locais = (d.edemaLocais || []).filter((x) => x !== 'sem');
    const edema = (d.edemaLocais || []).includes('sem') ? 'sem edema'
      : locais.length ? `edema em ${eLista(opN('hemodinamica', 'edemaLocais', locais))}${vis('hemodinamica', 'edemaGrau', d, ctx) && d.edemaGrau && d.edemaGrau !== 'na' ? ` ${op1('hemodinamica', 'edemaGrau', d.edemaGrau)}/4` : ''}` : '';
    return frases(juntar(ritmo, opN('hemodinamica', 'auscultaCardiaca', d.auscultaCardiaca)),
      juntar(d.tec && `TEC ${minus(op1('hemodinamica', 'tec', d.tec))}`, d.pulsos && `pulsos periféricos ${minus(op1('hemodinamica', 'pulsos', d.pulsos))}`, d.extremidades && `extremidades ${minus(op1('hemodinamica', 'extremidades', d.extremidades))}`),
      edema);
  },
  abdome: (d) => juntar(opN('abdome', 'exame', d.exame).map(minus), d.rha && `RHA ${minus(op1('abdome', 'rha', d.rha))}`, d.ascite && minus(op1('abdome', 'ascite', d.ascite)), d.observacao),
  infusoes: (d) => textoInfusoes(d.itens),
  renal: (d, ctx) => {
    const v = (n) => vis('renal', n, d, ctx) && !vazio(d[n]);
    const modo = { espontanea: 'diurese espontânea', cvd: 'diurese por CVD', cva: 'diurese por CVA', fralda: 'diurese em fralda', urostomia: 'diurese por urostomia', nefrostomia: 'diurese por nefrostomia', anuria: 'anúria' }[d.modo] || '';
    const vol = v('volume') && `${nu(d.volume)} mL${d.horas ? ` em ${nu(d.horas)} h` : ''}`;
    const deb = campoDe('renal', 'debito').calc(d, ctx);
    const irrig = d.irrigacao === 'sim' && juntar('irrigação vesical', v('infundido') && `infundido ${nu(d.infundido)} mL`, v('drenado') && `drenado ${nu(d.drenado)} mL`, campoDe('renal', 'diureseReal').calc(d) && `diurese real ${campoDe('renal', 'diureseReal').calc(d).replace(/ \(.*\)$/, '')}`);
    const trs = d.terapiaRenal === 'hemodialise' ? juntar('hemodiálise', v('hdUf') && `UF ${nu(d.hdUf)} mL`, v('hdDuracao') && `duração ${nu(d.hdDuracao)} h`, v('hdHeparina') && minus(op1('renal', 'hdHeparina', d.hdHeparina)), v('hdIntercorrencias') && `intercorrências: ${d.hdIntercorrencias}`)
      : d.terapiaRenal === 'continua' ? 'em terapia renal substitutiva contínua' : '';
    return frases(juntar(modo, vol, deb && `débito ${deb}`, d.aspecto && `aspecto ${d.aspecto}`), irrig, trs);
  },
  gi: (d, ctx) => {
    const v = (n) => vis('gi', n, d, ctx) && !vazio(d[n]);
    const vias = (d.via || []).filter((x) => x !== 'jejum');
    const dieta = (d.via || []).includes('jejum') ? `em jejum${v('jejumMotivo') ? ` (${d.jejumMotivo})` : ''}` : '';
    const comVia = vias.length ? `dieta por ${eLista(opN('gi', 'via', vias))}${v('dieta') ? `: ${d.dieta}` : ''}` : '';
    const nausea = { nao: 'sem náuseas ou vômitos', nausea: 'com náusea', vomito: 'com vômito' }[d.nausea] || '';
    let evac = '';
    if (d.evacuou === 'sim') evac = juntar(`evacuou${v('episodios') ? ` ${nu(d.episodios)} vez(es)` : ''}`, v('bristol') && `Bristol ${d.bristol}`, opN('gi', 'fezesAspecto', d.fezesAspecto).map(minus));
    else if (d.evacuou === 'nao') evac = ctx.ultimaEvacuacao ? `sem evacuação há ${((n) => `${n} ${n === 1 ? 'dia' : 'dias'}`)(diasEntre(ctx.ultimaEvacuacao, ctx.dataTurno))} (última em ${formatarData(ctx.ultimaEvacuacao)})` : 'sem evacuação nas últimas 24 horas';
    const est = (d.estomias || []).filter((i) => i.tipo || i.outra).map((i) => campoDe('gi', 'estomias').textoItem(i));
    return frases(juntar(dieta, comVia, v('pausas') && `pausas: ${d.pausas}`), nausea, evac, est.join('; '));
  },
  pele: (d) => {
    const c = campoDe('pele', 'lesoes');
    const tipo = (i) => c.campos[0].opcoes[i.tipo] || '';
    const les = (d.lesoes || []).filter((i) => Object.values(i).some((x) => !vazio(x))).map((i) => juntar(
      [tipo(i), i.tipo === 'lpp' && i.estagio && minus(c.campos[2].opcoes[i.estagio] || i.estagio), i.local && `em ${i.local}`, i.medidas && `(${i.medidas} cm)`].filter(Boolean).join(' '),
      i.leito, i.cobertura && `cobertura: ${i.cobertura}`, i.troca && `troca em ${formatarData(i.troca)}`, i.evolucao && minus(c.campos[7].opcoes[i.evolucao])));
    return frases(juntar(opN('pele', 'inspecao', d.inspecao).map(minus), d.mucosas && `mucosas ${minus(op1('pele', 'mucosas', d.mucosas))}`), les.join('; '));
  },
  dispositivos: (d, ctx) => textoDispositivos(d.itens, ctx.dataTurno),
  contencao: (d) => (d.emUso !== 'sim' ? '' : juntar(`contenção mecânica${d.local ? ` (${d.local})` : ''}`, d.indicacao && `indicação: ${d.indicacao}`,
    { sim: 'prescrita', nao: 'não prescrita' }[d.prescrita], d.inicio && `desde ${formatarDataHora(d.inicio)}`, d.avaliacao, d.reavHora && `necessidade reavaliada às ${d.reavHora}`)),
};

/** Frase curta de um subbloco da avaliação ("sem alteração…" quando só confirmado). */
function fraseA(id, ev, ctx) {
  const d = ev.dados?.[id] || {};
  const t = limpar(FRASES[id](d, ctx));
  if (t) return t;
  return ev.confirmados?.[id] ? 'sem alteração em relação à evolução anterior' : '';
}

const FREQ_ROTULO = { TURNO: '1X/TURNO', CONTINUO: 'CONTÍNUO' };

/**
 * Estrutura da evolução no formato SBAR:
 * { titulo, secoes: [{ rotulo, texto?, itens: [{ titulo?, texto }] }] }.
 */
export function estruturaPEP(ev, internacao, { unidadeNome = '' } = {}) {
  const ctx = contextoEvolucao(ev.dados, ev.data);
  const dd = ev.dados || {};
  const leito = String(ev.leitoId || internacao.leitoId || '').split('_')[1] || '';
  const diaUti = internacao.admissaoUti ? contagemDia(internacao.admissaoUti, ev.data) : '';
  const titulo = ['EVOLUÇÃO DE ENFERMAGEM', unidadeNome, leito && `LEITO ${leito}`, diaUti && `${diaUti} DE UTI`, ev.turnoInicio && `TURNO DA ${TURNOS[ev.turnoInicio].nome}`].filter(Boolean).join(' – ');

  // S — situação: estado geral e suporte atual, intercorrências e a narrativa do enfermeiro.
  const sn = dd.sinais || {};
  const ne = dd.neuro || {};
  const re = dd.respiratorio || {};
  const inf = normalizarInfusoes(dd.infusoes?.itens).filter((i) => i.medicamento);
  const dva = inf.filter((i) => i.grupo === 'dva').map((i) => i.medicamento);
  const situacao = juntar(
    sn.estadoGeral && `estado geral ${minus(op1('sinais', 'estadoGeral', sn.estadoGeral))}`,
    ne.consciencia && (ne.consciencia === 'sedado' ? 'sob sedação' : minus(op1('neuro', 'consciencia', ne.consciencia))),
    re.suporte && (re.suporte === 'aa' ? 'em ar ambiente' : `em ${op1('respiratorio', 'suporte', re.suporte)}`),
    dva.length && `em uso de ${eLista(dva)}`,
    dd.renal?.terapiaRenal === 'hemodialise' && 'em hemodiálise');
  const interc = (dd.intercorrencias?.itens || []).filter((i) => i.descricao).map((i) => frases(`${i.hora ? `às ${i.hora}, ` : ''}${i.descricao}`, i.conduta && `conduta: ${i.conduta}`, i.comunicado && `comunicado: ${i.comunicado}`, i.resultado && `resultado: ${i.resultado}`));
  const itensS = [];
  if (interc.length) itensS.push({ titulo: 'INTERCORRÊNCIAS', texto: interc.join('; ') });
  const narrativa = String(dd.narrativa?.texto || '').trim();
  if (narrativa) itensS.push({ texto: narrativa });

  // B — breve histórico.
  const al = internacao.alergias;
  const iso = internacao.isolamento;
  const cu = dd.cuidado || {};
  const atb = (dd.antimicrobianos?.itens || []).filter((i) => i.nome).map((i) => campoDe('antimicrobianos', 'itens').textoItem(i, ctx));
  const cult = (dd.antimicrobianos?.culturas || []).filter((i) => i.material).map((i) => `${i.material}${i.coleta ? ` de ${formatarData(i.coleta)}` : ''}: ${i.resultado || 'sem resultado'}`);
  const historico = frases(
    internacao.diagnosticoMedico && `diagnóstico médico: ${internacao.diagnosticoMedico}`,
    internacao.comorbidades && `comorbidades: ${internacao.comorbidades}`,
    internacao.admissaoUti && `admissão na UTI em ${formatarData(internacao.admissaoUti)}`,
    al?.situacao === 'possui' ? `alergia: ${al.descricao}` : al?.situacao === 'nega' ? 'nega alergias' : '',
    iso?.tipo && (iso.tipo === 'padrao' ? 'precaução padrão' : `precaução: ${minus(ISOLAMENTOS[iso.tipo] || iso.tipo).replace(/ \(.*\)$/, '')}${iso.motivo ? ` (${iso.motivo})` : ''}`),
    juntar(cu.limitacao === 'sim' ? `limitação de suporte: ${cu.limitacaoDescricao || 'sim'}` : cu.limitacao === 'nao' ? 'sem limitação de suporte' : '', cu.objetivos && `objetivo de cuidado ${minus(op1('cuidado', 'objetivos', cu.objetivos))}`),
    atb.length && `antimicrobianos: ${atb.join(', ')}`,
    cult.length && `culturas: ${cult.join('; ')}`);

  // A — avaliação por sistemas e diagnósticos de enfermagem.
  const itensA = [];
  for (const id of Object.keys(TITULO_A)) {
    const t = fraseA(id, ev, ctx);
    if (t) itensA.push({ titulo: TITULO_A[id] + (id === 'sinais' && sn.horario ? ` (${sn.horario})` : ''), texto: t });
  }
  const diags = dd.sae?.diagnosticos || [];
  if (diags.length) {
    itensA.push({ titulo: 'DIAGNÓSTICOS DE ENFERMAGEM' });
    diags.forEach((d, k) => {
      if (d.situacao === 'resolvido') { itensA.push({ texto: `${k + 1}. ${d.titulo}: resolvido` }); return; }
      const res = (d.noc || []).map((r) => `${r.titulo}: ${(r.indicadores || []).map((i) => `${i.texto} ${i.pontuacao === 'NA' ? 'não avaliado' : i.pontuacao || 'sem pontuação'}${i.meta ? ` (meta ${i.meta})` : ''}`).join(', ')}`);
      itensA.push({ texto: `${k + 1}. ${limpar(enunciado(d))}${res.length ? `. Resultado esperado – ${res.join('; ')}` : ''}` });
    });
  }

  // R — recomendações: intervenções do PE com a avaliação do dia e alertas do sistema.
  const itensR = [];
  diags.filter((d) => d.situacao !== 'resolvido').forEach((d) => {
    const nics = (d.nic || []).filter((x) => (x.atividades || []).length).map((x) => `${x.titulo}: ${x.atividades.map((a) => {
      const apz = [a.freq && (FREQ_ROTULO[a.freq] || a.freq), a.obsPrescricao].filter(Boolean).join('; ');
      const st = a.status ? ` – ${minus(STATUS_ATIVIDADE[a.status])}${a.justificativa ? ` (${a.justificativa})` : ''}` : '';
      return `${a.texto}${apz ? ` (${apz})` : ''}${st}`;
    }).join('; ')}`);
    if (nics.length || d.decisao) itensR.push({ texto: frases(nics, d.decisao && `${DECISOES[d.decisao]}${d.decisaoMotivo ? ` (${d.decisaoMotivo})` : ''}`) });
  });
  for (const i of (dd.dispositivos?.itens || []).filter(dispositivoAtivo))
  {
    const al = alertasDispositivo(i, ev.data);
    if (al.length) itensR.push({ texto: `${rotuloDispositivo(i)}: ${al.map((a) => a.texto).join('; ')}` });
  }
  if (ne.consciencia === 'sedado' && ne.interrupcao === 'nao_realizada') itensR.push({ texto: 'Interrupção diária da sedação não realizada: reavaliar com a equipe' });
  itensR.forEach((r, k) => { r.texto = `${k + 1}. ${r.texto}`; });

  const secoes = [
    { rotulo: 'S – SITUAÇÃO', texto: situacao, itens: itensS },
    { rotulo: 'B – BREVE HISTÓRICO', texto: historico, itens: [] },
    { rotulo: 'A – AVALIAÇÃO', texto: '', itens: itensA },
    { rotulo: 'R – RECOMENDAÇÕES', texto: '', itens: itensR },
  ].filter((s) => s.texto || s.itens.length);
  if (ev.versao > 1 && ev.retificacao?.motivo) secoes.push({ rotulo: `RETIFICAÇÃO (VERSÃO ${ev.versao})`, texto: ev.retificacao.motivo, itens: [] });
  return { titulo, secoes };
}

const caixaAltaPEP = (t) => limpar(t).toLocaleUpperCase('pt-BR');
const ponto = (t) => (t && !/[.:!?]$/.test(t) ? `${t}.` : t);

/**
 * Linhas prontas (caixa alta, com ponto final): [{ negrito, texto, novaSecao }].
 * A mesma lista gera o texto simples, o HTML e a prévia/impressão da tela.
 */
export function linhasPEP({ titulo, secoes }) {
  const linhas = [{ negrito: caixaAltaPEP(titulo), texto: '' }];
  for (const s of secoes) {
    linhas.push({ negrito: `${caixaAltaPEP(s.rotulo)}:`, texto: s.texto ? ponto(caixaAltaPEP(s.texto)) : '', novaSecao: true });
    for (const i of s.itens) linhas.push({ negrito: i.titulo ? `${caixaAltaPEP(i.titulo)}:` : '', texto: i.texto ? ponto(caixaAltaPEP(i.texto)) : '' });
  }
  return linhas;
}

/** Texto simples (caixa alta) para copiar ao PEP institucional. */
export function textoParaPEP(ev, internacao, opcoes = {}) {
  return linhasPEP(estruturaPEP(ev, internacao, opcoes))
    .flatMap((l) => [...(l.novaSecao ? [''] : []), [l.negrito, l.texto].filter(Boolean).join(' ')]).join('\n');
}

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Mesmo texto em HTML simples (títulos em negrito), para colar no editor do PEP. */
export function htmlParaPEP(ev, internacao, opcoes = {}) {
  return linhasPEP(estruturaPEP(ev, internacao, opcoes))
    .map((l) => `<p>${l.negrito ? `<b>${escHtml(l.negrito)}</b>${l.texto ? ' ' : ''}` : ''}${escHtml(l.texto)}</p>`).join('');
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
