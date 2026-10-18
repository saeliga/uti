// Impressos da UTI no padrão da Liga: capa da ocorrência, ocorrência por leito
// (fase de transição), folha de balanço hídrico, checklist diário de IRAS e
// checklists de inserção de CVC e CVD. Aqui ficam só regras puras (testáveis no
// Node): itens, cálculo de adesão e o preenchimento dos campos a partir da
// internação e da evolução. A montagem da página fica em js/impressos/.

import { contagemDia, formatarData, idade as idadeEm, diasEntre } from './datas.js';
import { ativo as dispositivoAtivo } from './dispositivos.js';
import { normalizarInfusoes, caixaAlta } from './infusoes.js';
import { ISOLAMENTOS } from './opcoes.js';
import { SUBBLOCOS, subblocoRegistrado } from './evolucao.js';

const DIAS_SEMANA = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataUTC = (iso) => { const [a, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(Date.UTC(a, m - 1, d)); };
export const diaDaSemana = (iso) => DIAS_SEMANA[dataUTC(iso).getUTCDay()];
/** "domingo, 18 de outubro de 2026" */
export function dataExtenso(iso) {
  const d = dataUTC(iso);
  return `${DIAS_SEMANA[d.getUTCDay()].toLowerCase()}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}
const curta = (iso) => (iso ? formatarData(iso).slice(0, 5) : '');
const X = (cond) => (cond ? ' X ' : '   ');

// --------------------------------------------------------------------------- checklist de IRAS
// Texto igual ao formulário da Liga (PTQLD0005:03, rev. 03).
export const BUNDLES_IRAS = [
  {
    id: 'pav', titulo: 'MEDIDAS PARA PREVENÇÃO DE PNEUMONIA ASSOCIADA À VENTILAÇÃO MECÂNICA', adesao: 'Adesão ao Bundle de Prevenção da PAV*',
    itens: [
      ['decubito', 'Decúbito elevado entre 30°-45°'],
      ['sedacao', 'Sedação interrompida (Horário)'],
      ['aspiracao', 'Aspiração de via aérea'],
      ['extubacao', 'Verificado necessidade de extubação'],
      ['higieneOral', 'Higiene oral com clorexidina aquosa a 0,12'],
      ['cuff', 'Pressão do cuff entre 20 e 22 mmHg (25 e 30 cmH2O)'],
    ],
  },
  {
    id: 'cvc', titulo: 'MEDIDAS PARA PREVENÇÃO DE INFECÇÃO DE CORRENTE SANGUÍNEA', adesao: 'Adesão ao Bundle de Manutenção de CVC*',
    itens: [
      ['indicacao', 'Registro da indicação de permanência do CVC'],
      ['tecnica', 'Técnica asséptica no manuseio do CVC', '(higiene das mãos e desinfecção das conexões antes do manuseio do CVC)'],
      ['infusao', 'Manutenção adequada do sistema de infusão', '(controle e troca dos equipos e dispositivos conforme protocolo institucional)'],
      ['curativo', 'Curativo adequado', '(limpo, seco, bem aderido e datado)'],
    ],
  },
  {
    id: 'cvd', titulo: 'MEDIDAS PARA PREVENÇÃO DE INFECÇÃO DE TRATO URINÁRIO', adesao: 'Adesão ao Bundle de Manutenção de CVD*',
    itens: [
      ['fechado', 'Sistema de drenagem fechado e estéril'],
      ['manipulacao', 'Manipulação correta do sistema de drenagem', '(fixação adequada, bolsa coletora abaixo do nível da bexiga e esvaziada em 2/3 de sua capacidade)'],
      ['meato', 'Meato uretral higienizado'],
      ['necessidade', 'Verificado necessidade de manutenção do CVD'],
    ],
  },
];
export const MARCAS_IRAS = ['1', '0', 'NA'];

/**
 * Adesão ao bundle (regra da Liga: conforme só quando todas as boas práticas
 * foram cumpridas). '1' todos conformes (NA não conta); '0' algum não conforme;
 * 'NA' todos não se aplicam; '' ainda incompleto.
 */
export function adesaoBundle(bundle, respostas = {}) {
  const v = bundle.itens.map(([id]) => respostas[id] || '');
  if (v.includes('0')) return '0';
  if (v.some((x) => !x)) return '';
  if (v.every((x) => x === 'NA')) return 'NA';
  return '1';
}

/** O leito precisa de cada bundle? (VMI → PAV; cateter central → CVC; CVD → ITU) */
export function bundlesAplicaveis(ev) {
  const d = ev?.dados || {};
  const disp = (d.dispositivos?.itens || []).filter(dispositivoAtivo).map((i) => i.tipo);
  return {
    pav: ['vmi_tot', 'vmi_tqt'].includes(d.respiratorio?.suporte) || disp.includes('tot'),
    cvc: disp.some((t) => ['cvc', 'picc', 'cti', 'cateter_dialise'].includes(t)),
    cvd: disp.includes('cvd') || d.renal?.modo === 'cvd',
  };
}

/** Respostas iniciais: leito vago; bundle sem o dispositivo vem como NA. */
export function irasInicial(leitos, evolucaoDoLeito = {}) {
  const r = {};
  for (const l of leitos) {
    if (!l.internacaoId) { r[l.numero] = { vago: true }; continue; }
    const ap = bundlesAplicaveis(evolucaoDoLeito[l.internacaoId]);
    const col = {};
    for (const b of BUNDLES_IRAS) col[b.id] = ap[b.id] ? {} : Object.fromEntries(b.itens.map(([id]) => [id, 'NA']));
    r[l.numero] = col;
  }
  return r;
}

/** Percentual de adesão do turno por bundle (para acompanhar e para a pesquisa). */
export function resumoIras(respostas = {}) {
  const out = {};
  for (const b of BUNDLES_IRAS) {
    const ad = Object.values(respostas).filter((c) => !c.vago).map((c) => adesaoBundle(b, c[b.id]));
    const aval = ad.filter((x) => x === '1' || x === '0');
    out[b.id] = { avaliados: aval.length, conformes: aval.filter((x) => x === '1').length, pendentes: ad.filter((x) => x === '').length };
  }
  return out;
}

// --------------------------------------------------------------------------- checklists de inserção
// Texto igual aos formulários atuais da Liga (Versão 2, 07/04/2026), enviados pelo Tercio.
// `esperado` = resposta conforme (nas perguntas de falha, o conforme é NÃO).
export const OPCOES_SITUACAO = { urgencia: 'Urgência', nova: 'Nova inserção', reinsercao: 'Reinserção (Troca)' };
export const OPCOES_LOCAL_CVC = { jugular: 'Jugular', subclavia: 'Subclávia', femoral: 'Femoral', mmss: 'MMSS', mmii: 'MMII' };
export const OPCOES_LUMENS = { mono: 'Mono Lúmen', duplo: 'Duplo Lúmen', triplo: 'Triplo Lúmen' };
export const INDICACOES_CVD = {
  intraop: 'Monitorização do débito urinário no intra-operatório',
  posop: 'Monitorização do débito urinário no pós-operatório',
  monitorizacao: 'Monitorização do débito urinário, especifique:',
  retencao: 'Manejo de retenção urinária',
  obstrucao: 'Manejo de obstrução urinária',
  incontinencia: 'Incontinência urinária',
  lpp: 'Paciente com lesão por pressão com cicatrização prejudicada pelo contato com a urina',
};

export const CHECKLISTS_INSERCAO = {
  cvc: {
    titulo: ['CHECK-LIST DE INSERÇÃO DE', 'CATETER VENOSO CENTRAL'], curto: 'CVC',
    tipos: ['cvc', 'cateter_dialise', 'picc'],
    secoes: [
      { titulo: 'Boas práticas antes da inserção do cateter', itens: [
        { id: 'identificacao', texto: 'Confirmada a identificação do paciente?' },
        { id: 'explicado', texto: 'Procedimento explicado ao paciente?' },
        { id: 'preparoMaos', texto: 'Realizado preparo pré-operatório das mãos com anti-séptico?' },
        { id: 'assistenteMaos', texto: 'Assistente realizou a higiene das mãos antes do procedimento?' },
        { id: 'degermacao', texto: 'Realizado degermação da pele com clorexidina degermante?' },
        { id: 'antissepsia', texto: 'Realizado antissepsia da pele com clorexidina alcoólica?' },
      ] },
      { titulo: 'Boas práticas durante a inserção do cateter', itens: [
        { id: 'barreira', texto: 'Equipe cirúrgica utilizando a barreira máxima de precaução?', nota: 'Luva estéril, máscara, gorro e avental/capote estéril.' },
        { id: 'campo', texto: 'Manteve campo estéril amplo?' },
        { id: 'quebra', texto: 'Houve quebra de técnica durante a inserção do cateter?', nota: 'Se sim, especifique:', esperado: 'nao', detalhe: true },
        { id: 'maisPuncao', texto: 'Foi necessário mais de uma punção para inserir o cateter?', esperado: 'nao' },
        { id: 'mudouSitio', texto: 'Mudou o sítio de inserção após primeira tentativa?', esperado: 'nao' },
      ] },
      { titulo: 'Boas práticas após inserção do cateter', itens: [
        { id: 'fixado', texto: 'Cateter fixado adequadamente?' },
        { id: 'curativo', texto: 'Realizado curativo estéril com gaze e micropore nas primeiras 24h?' },
        { id: 'anotado', texto: 'Anotado data de inserção no curativo e no prontuário?' },
        { id: 'raioX', texto: 'Confirmado posição com radiologia simples de tórax?' },
      ] },
    ],
  },
  cvd: {
    titulo: ['CHECK-LIST DE INSERÇÃO DE', 'CATETER VESICAL DE DEMORA'], curto: 'CVD',
    tipos: ['cvd'],
    secoes: [
      { titulo: 'Boas práticas antes da inserção da CVD', itens: [
        { id: 'identificacao', texto: 'Confirmada a identificação do paciente?' },
        { id: 'explicado', texto: 'Procedimento explicado ao paciente?' },
        { id: 'material', texto: 'Reunido material para realização da higiene íntima e passagem da CVD?' },
        { id: 'maosAntes', texto: 'Realizado a higiene das mãos antes da higiene íntima do(a) paciente?' },
        { id: 'higieneIntima', texto: 'Realizado higiene íntima do(a) paciente com água e solução degermante a 2%?' },
      ] },
      { titulo: 'Boas práticas para inserção da CVD com técnica asséptica', itens: [
        { id: 'maosDepois', texto: 'Realizado a higiene das mãos depois da higiene íntima do(a) paciente?' },
        { id: 'luvas', texto: 'Calçou as luvas de procedimento estéreis?' },
        { id: 'campo', texto: 'Manteve campo estéril amplo?' },
        { id: 'organizou', texto: 'Organizou material no campo estéril?' },
        { id: 'conectou', texto: 'Conectou CVD ao coletor de urina?' },
        { id: 'antissepsia', texto: 'Realizou a antissepsia da região perineal com solução de clorexidina aquosa a 0,2%?', nota: 'Partindo da uretra para periferia' },
        { id: 'tecnica', texto: 'Seguiu técnica asséptica na inserção?' },
        { id: 'drenagem', texto: 'Antes de insuflar o balão, observou a drenagem de urina pelo cateter e coletor que deverá ficar abaixo da bexiga urinária?' },
        { id: 'fixou', texto: 'Fixou corretamente o cateter na parte interna da raiz da coxa.' },
      ] },
      { titulo: 'Boas práticas após inserção da CVD', itens: [
        { id: 'maosApos', texto: 'Realizado a higiene das mãos depois da passagem da CVD?' },
        { id: 'demarcado', texto: 'Demarcado 2/3 na bolsa coletora para sinalizar o momento do descarte do volume urinário?' },
        { id: 'registrado', texto: 'Procedimento registrado no prontuário?' },
      ] },
    ],
  },
};
export const itensInsercao = (tipo) => CHECKLISTS_INSERCAO[tipo].secoes.flatMap((s) => s.itens);
/** Tipo de check-list de um dispositivo (CVC, cateter de hemodiálise e PICC → CVC; CVD → CVD). */
export const tipoChecklistDe = (tipoDispositivo) => Object.keys(CHECKLISTS_INSERCAO).find((k) => CHECKLISTS_INSERCAO[k].tipos.includes(tipoDispositivo)) || null;

/** Registro novo, já com o que o dispositivo informa (tipo de cateter, lúmens, local, lado, data). */
export function novoChecklistInsercao(tipo, { dispositivo, data, setor, responsavel } = {}) {
  const r = { tipo, data: dispositivo?.insercao || data || '', respostas: {}, detalhes: {}, equipe: '', observacoes: '', responsavel: responsavel || '' };
  if (tipo === 'cvc') {
    const d = dispositivo || {};
    const local = String(d.local || '');
    Object.assign(r, {
      naUti: d.implantadoUti === 'nao' ? 'nao' : d.implantadoUti === 'sim' ? 'sim' : '', setor: '',
      situacao: '', situacaoMotivo: '', indicacao: '', indicacaoMotivo: '',
      cateter: d.tipo === 'cateter_dialise' ? 'hd' : d.tipo ? 'cvc' : '',
      lumens: { 1: 'mono', 2: 'duplo', 3: 'triplo' }[d.lumens] || '', cateterOutro: d.tipo === 'picc' ? 'PICC' : '',
      local: /JUGULAR/.test(local) ? 'jugular' : /SUBCL/.test(local) ? 'subclavia' : /FEMORAL/.test(local) ? 'femoral' : d.tipo === 'picc' ? 'mmss' : '',
      lado: d.lado === 'D' || d.lado === 'E' ? d.lado : '', localOutro: '',
    });
  } else {
    Object.assign(r, { setor: setor || '', indicacoes: [], indicacaoEspecifique: '' });
  }
  return r;
}

/** Conformidade: tudo respondido e todas as respostas iguais à esperada. */
export function avaliarInsercao(reg) {
  const itens = itensInsercao(reg.tipo);
  const resp = reg.respostas || {};
  const respondidos = itens.filter((i) => resp[i.id]).length;
  const conformes = itens.filter((i) => resp[i.id] === (i.esperado || 'sim')).length;
  const status = respondidos < itens.length ? 'incompleto' : conformes === itens.length ? 'conforme' : 'nao_conforme';
  return { total: itens.length, respondidos, conformes, status };
}

/** Pendências para salvar como concluído. */
export function validarInsercao(reg) {
  const e = [];
  if (!reg.data) e.push('Informe a data.');
  if (reg.tipo === 'cvc') {
    if (!reg.naUti) e.push('Informe se o cateter foi passado na UTI.');
    if (reg.naUti === 'nao' && !String(reg.setor || '').trim()) e.push('Informe em qual setor o cateter foi passado.');
    if (!reg.situacao) e.push('Marque a situação de inserção.');
    if (reg.situacao === 'reinsercao' && !String(reg.situacaoMotivo || '').trim()) e.push('Informe o motivo da reinserção.');
    if (!reg.cateter && !String(reg.cateterOutro || '').trim()) e.push('Marque o tipo de cateter.');
    if (!reg.local && !String(reg.localOutro || '').trim()) e.push('Marque o local de inserção.');
    if (reg.local && !reg.lado) e.push('Marque o lado do local de inserção.');
  } else if (!(reg.indicacoes || []).length) e.push('Marque a indicação de inserção.');
  const resp = reg.respostas || {};
  const faltam = itensInsercao(reg.tipo).filter((i) => !resp[i.id]);
  if (faltam.length) e.push(`Responda todos os itens (${faltam.length} sem resposta).`);
  for (const i of itensInsercao(reg.tipo)) if (i.detalhe && resp[i.id] === 'sim' && !String(reg.detalhes?.[i.id] || '').trim()) e.push(`${i.texto} Especifique.`);
  if (!String(reg.responsavel || '').trim()) e.push('Informe o responsável pelo preenchimento.');
  return e;
}

// --------------------------------------------------------------------------- campos da ocorrência e do BH
function dispositivosAtivos(ev) {
  return (ev?.dados?.dispositivos?.itens || []).filter(dispositivoAtivo);
}
const primeiro = (lista, tipos) => lista.find((i) => tipos.includes(i.tipo));
const localCurto = (i) => [i?.local === 'OUTRO' ? i?.localOutro : i?.local, i?.lado === 'D' ? 'D' : i?.lado === 'E' ? 'E' : ''].filter(Boolean).join(' ');
const ROTULO_SONDA = { sne: 'SNE', soe: 'SOE', sng: 'SNG', sog: 'SOG' };

// --------------------------------------------------------------------------- capa: reservas
/**
 * Reservas da capa (cirúrgicas ou de leito para hemodiálise): uma linha livre por
 * paciente, do jeito que o NIR manda no WhatsApp. Aceita o aviso colado inteiro:
 * tira o cabeçalho ("Reservas de UTI 17/10"), linhas vazias e a numeração ("1.",
 * "2)", "3 -"); linha sem número logo depois de um item numerado é continuação dele.
 */
export const MAX_RESERVAS = 20;
const NUMERO = /^\s*\d{1,2}\s*[.)\-–]\s*/;
export function normalizarReservas(entrada) {
  const limparLinha = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
  let linhas;
  if (Array.isArray(entrada)) {
    // Lista já salva (texto) ou do formato antigo (objetos com paciente/detalhe/horário).
    linhas = entrada.map((r) => (r && typeof r === 'object' ? [r.paciente, r.detalhe, r.horario && `às ${r.horario}`].filter(Boolean).join(' / ') : r));
    return linhas.map(limparLinha).map((t) => t.replace(NUMERO, '')).filter(Boolean).map((t) => t.slice(0, 600)).slice(0, MAX_RESERVAS);
  }
  // Continuação: linha sem número colada (sem linha em branco) a um item numerado.
  const itens = [];
  let anteriorNumerado = false;
  for (const bruta of String(entrada ?? '').split(/\r?\n/)) {
    const t = limparLinha(bruta);
    if (!t) { anteriorNumerado = false; continue; }
    if (/^reservas?\b/i.test(t) && !NUMERO.test(t)) continue;
    if (NUMERO.test(t)) { itens.push(t.replace(NUMERO, '')); anteriorNumerado = true; }
    else if (anteriorNumerado) itens[itens.length - 1] += ` ${t}`;
    else itens.push(t);
  }
  return itens.filter(Boolean).map((t) => t.slice(0, 600)).slice(0, MAX_RESERVAS);
}

/** Campos de identificação comuns às folhas. */
export function camposIdentificacao(internacao, leitoNum) {
  const p = internacao.paciente || {};
  const al = internacao.alergias;
  const iso = internacao.isolamento?.tipo;
  return {
    nome: p.nome || '', registro: p.registro || '', convenio: (p.convenio || '').toUpperCase(),
    nascimento: p.dataNascimento ? formatarData(p.dataNascimento) : '',
    isolamento: iso && iso !== 'padrao' ? caixaAlta(String(ISOLAMENTOS[iso] || iso).replace(/ \(.*\)$/, '')) : '',
    alergias: al?.situacao === 'possui' ? caixaAlta(al.descricao) : al?.situacao === 'nega' ? 'NEGA' : '',
    diagnostico: caixaAlta(internacao.diagnosticoMedico || ''),
    diagnosticoCirurgico: '',
    leito: `L${leitoNum}`, leitoNum,
  };
}

function antimicrobianos(ev, dataRef) {
  const c = {};
  (ev?.dados?.antimicrobianos?.itens || []).filter((a) => a.nome).slice(0, 5).forEach((a, k) => {
    c[`atb${k}`] = `${caixaAlta(a.nome)}${a.inicio ? ` I: ${curta(a.inicio)}` : ''}`;
    c[`atbDias${k}`] = a.inicio ? `${contagemDia(a.inicio, dataRef)}${a.previsto ? `/${a.previsto}` : ''}` : '';
  });
  return c;
}

/** Folha de balanço hídrico (folha de cuidados): cabeçalho, dias de permanência e antimicrobianos. */
export function camposBH(internacao, ev, { leitoNum, dataFolha }) {
  const disp = dispositivosAtivos(ev);
  const dias = (i) => (i?.insercao ? contagemDia(i.insercao, dataFolha) : '');
  const sonda = primeiro(disp, ['sne', 'soe', 'sng', 'sog']);
  const dreno = disp.find((i) => i.tipo === 'dreno' && /BLAKE/.test(i.subtipo || ''));
  return {
    ...camposIdentificacao(internacao, leitoNum),
    dataExtenso: dataExtenso(dataFolha),
    diasUti: internacao.admissaoUti ? contagemDia(internacao.admissaoUti, dataFolha) : '',
    diasAvp: dias(primeiro(disp, ['avp'])),
    diasAvc: dias(primeiro(disp, ['cvc', 'picc'])),
    diasCatHd: dias(primeiro(disp, ['cateter_dialise'])),
    sondaRotulo: sonda ? ROTULO_SONDA[sonda.tipo] : 'DATA SNE:', diasSonda: dias(sonda),
    diasVmi: dias(primeiro(disp, ['tot'])), diasTqt: dias(primeiro(disp, ['tqt'])), diasTuboLaminar: '',
    diasDreno: dias(dreno), diasGtm: dias(primeiro(disp, ['gtm'])), diasJejuno: '', diasUrostomia: '',
    svdRotulo: primeiro(disp, ['cvd']) ? 'CVD' : 'DATA CVD:', diasSvd: dias(primeiro(disp, ['cvd'])),
    ...antimicrobianos(ev, dataFolha),
  };
}

// Nome na folha da ocorrência → medicamento (princípio ativo) no sistema.
const INFUSAO_OCORRENCIA = {
  NORADRENALINA: 'NORADRENALINA', MIDAZOLAM: 'MIDAZOLAM', DOBUTAMINA: 'DOBUTAMINA', FENTANIL: 'FENTANIL', DOPAMINA: 'DOPAMINA',
  NITROPRUSSIATO: 'NITROPRUSSIATO', INSULINA: 'INSULINA REGULAR', NITROGLICERINA: 'NITROGLICERINA', AMIODARONA: 'AMIODARONA',
};
const vaz = (i) => (i ? `${i.vazao ? `${String(i.vazao).replace('.', ',')} mL/h` : '✓'}` : '');

/** Ocorrência de enfermagem por leito (fase de transição): o que o sistema já sabe vem preenchido. */
export function camposOcorrencia(internacao, ev, { leitoNum, data }) {
  const d = ev?.dados || {};
  const disp = dispositivosAtivos(ev);
  const inf = normalizarInfusoes(d.infusoes?.itens).filter((i) => i.medicamento);
  const usados = new Set();
  const pega = (nome) => { const i = inf.find((x) => x.medicamento === nome && x.grupo !== 'hv'); if (i) usados.add(i); return i; };
  const hv = inf.find((i) => i.grupo === 'hv');
  if (hv) usados.add(hv);
  const c = {
    ...camposIdentificacao(internacao, leitoNum),
    data: formatarData(data),
    idade: internacao.paciente?.dataNascimento ? `${idadeEm(internacao.paciente.dataNascimento, data)}a` : '',
    xClinico: internacao.tipo === 'clinico' ? '(X)' : '(  )', xCirurgico: internacao.tipo === 'cirurgico' ? '(X)' : '(  )',
    pulseiraS: X(internacao.pulseira === true), pulseiraN: X(internacao.pulseira === false),
    dih: internacao.admissaoHospital ? formatarData(internacao.admissaoHospital) : '',
    duti: internacao.admissaoUti ? formatarData(internacao.admissaoUti) : '',
    diasUti: internacao.admissaoUti ? contagemDia(internacao.admissaoUti, data) : '',
    medicos: caixaAlta(internacao.especialidade || ''),
    vHV: hv && hv.medicamento !== 'SORO GLICOSADO 10%' ? `${vaz(hv)} ${hv.medicamento.replace('SORO FISIOLÓGICO', 'SF').replace('SORO GLICOSADO', 'SG')}` : '',
    vSG10: hv && hv.medicamento === 'SORO GLICOSADO 10%' ? vaz(hv) : vaz(pega('SORO GLICOSADO 10%')),
  };
  for (const [rot, nome] of Object.entries(INFUSAO_OCORRENCIA)) c[`v${rot}`] = vaz(pega(nome));
  inf.filter((i) => !usados.has(i)).slice(0, 3).forEach((i, k) => { c[`outraInf${k}`] = `${i.medicamento} ${vaz(i)}`; });

  // Dispositivos (data e localização)
  const linha = (pref, tipos) => { const i = primeiro(disp, tipos); c[`${pref}Data`] = curta(i?.insercao); c[`${pref}Local`] = i ? localCurto(i) : ''; };
  linha('avp', ['avp']); linha('avc', ['cvc', 'picc']); linha('cti', ['cti']); linha('catHd', ['cateter_dialise']);
  const sonda = primeiro(disp, ['sne', 'soe', 'sng', 'sog']);
  c.sondaRotulo = sonda ? ROTULO_SONDA[sonda.tipo] : 'SNE'; c.dataSonda = sonda ? formatarData(sonda.insercao || '') : '';
  const cvd = primeiro(disp, ['cvd']);
  c.svdRotulo = 'CVD'; c.dataSvd = cvd?.insercao ? formatarData(cvd.insercao) : '';

  // Dieta, eliminações, drenos e curativos (marcações)
  const vias = d.gi?.via || [];
  Object.assign(c, { viaVo: X(vias.includes('vo')), viaSne: X(vias.includes('sne')), viaSoe: X(vias.includes('soe')), viaSng: X(vias.includes('sng')), viaGtm: X(vias.includes('gtm')), viaNpt: X(vias.includes('npt')) });
  const modo = d.renal?.modo;
  Object.assign(c, { eEsp: X(modo === 'espontanea'), eSvd: X(modo === 'cvd' || !!cvd), eSva: X(modo === 'cva'), eFralda: X(modo === 'fralda') });
  const est = (d.gi?.estomias || []).map((e) => e.tipo);
  Object.assign(c, { eColost: X(est.includes('colostomia')), eIleost: X(est.includes('ileostomia')) });
  const drenos = disp.filter((i) => i.tipo === 'dreno');
  const sub = drenos.map((i) => i.subtipo || '');
  const outros = drenos.filter((i) => !['PENROSE', 'TORÁCICO'].includes(i.subtipo));
  Object.assign(c, { dPenrose: X(sub.includes('PENROSE')), dLaminar: '   ', dToracico: X(sub.includes('TORÁCICO')), dOutro: X(outros.length), dOutroNome: outros.map((i) => i.subtipo || 'DRENO').join(', ') || '______________' });
  const lesoes = d.pele?.lesoes || [];
  Object.assign(c, {
    cAvc: X(!!primeiro(disp, ['cvc', 'picc'])), cDreno: X(drenos.length), cCvti: X(!!primeiro(disp, ['cti'])),
    cCirurgico: X(lesoes.some((l) => l.tipo === 'cirurgica')), cLpp: X(lesoes.some((l) => l.tipo === 'lpp')),
  });
  const TIPO_LESAO = { lpp: 'LPP', cirurgica: 'INCISÃO CIRÚRGICA', oncologica: 'LESÃO ONCOLÓGICA', dermatite: 'DERMATITE ASSOCIADA À INCONTINÊNCIA', friccao: 'LESÃO POR FRICÇÃO', outra: 'LESÃO' };
  c.lesoes = lesoes.filter((l) => l.tipo || l.local).map((l) => [TIPO_LESAO[l.tipo] || 'LESÃO', l.local && caixaAlta(l.local), l.estagio && `ESTÁGIO ${caixaAlta(l.estagio)}`, l.cobertura && `COBERTURA: ${caixaAlta(l.cobertura)}`].filter(Boolean).join(' - '));
  return { ...c, ...antimicrobianos(ev, data) };
}

/** Troca {{campo}} pelo valor (texto escapado; listas viram linhas; `brutos` entram como HTML). */
export function preencherModelo(modelo, campos, brutos = {}) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return modelo.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (k in brutos) return brutos[k]; // HTML pronto (ex.: logotipo)
    const v = campos[k];
    if (Array.isArray(v)) return v.map(esc).join('<br>');
    return esc(v);
  });
}

/** Junta evoluções (da mais nova para a mais antiga): cada subbloco vem da mais nova que o registrou. */
export function juntarEvolucoes(evs = []) {
  const lista = evs.filter(Boolean);
  if (!lista.length) return null;
  const dados = {};
  for (const ev of [...lista].reverse()) {
    for (const [k, v] of Object.entries(ev.dados || {})) {
      if (!(k in SUBBLOCOS) || subblocoRegistrado(ev, k)) dados[k] = v;
    }
  }
  return { ...lista[0], dados };
}

export const diasDesde = (inicio, ref) => (inicio ? diasEntre(inicio, ref) : null);
