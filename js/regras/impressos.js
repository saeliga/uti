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
// Itens do protocolo usado no piloto (CCIH/ANVISA), no leiaute da Liga.
export const CHECKLISTS_INSERCAO = {
  cvc: {
    titulo: 'CHECK-LIST PARA PASSAGEM DE CATETER VENOSO CENTRAL',
    subtitulo: 'PROTOCOLO DE PREVENÇÃO DE INFECÇÃO DE CORRENTE SANGUÍNEA',
    tipos: ['cvc', 'cateter_dialise', 'picc'],
    cabecalho: [
      ['INDICAÇÃO DO PROCEDIMENTO', ['DROGA VASOATIVA', 'SEM CONDIÇÕES DE AVP', 'HEMODIÁLISE', 'NUTRIÇÃO PARENTERAL', 'OUTROS: ________']],
      ['LOCALIZAÇÃO', ['JUGULAR INTERNA', 'SUBCLÁVIA', 'FEMORAL', 'PERIFÉRICA (PICC)'], 'local'],
      ['LADO', ['DIREITO', 'ESQUERDO'], 'lado'],
      ['TIPO DE PROCEDIMENTO', ['ELETIVO', 'EMERGÊNCIA']],
      ['TIPO DE CATETER', ['1 LÚMEN', '2 LÚMENS', '3 LÚMENS', 'CATETER DE HEMODIÁLISE'], 'lumens'],
      ['SÍTIO DE 1ª ESCOLHA É SUBCLÁVIA?', ['SIM', 'NÃO — JUSTIFICATIVA: ____________________']],
      ['COMPLICAÇÃO', ['SEM COMPLICAÇÕES', 'ARRITMIA', 'HEMATOMA', 'LESÃO VASCULAR', 'MAL POSICIONAMENTO', 'PNEUMOTÓRAX']],
    ],
    secoes: [
      ['ANTES DO PROCEDIMENTO', ['HIGIENIZAÇÃO DAS MÃOS COM CLOREXIDINA DEGERMANTE', 'CAMPO ESTÉRIL GRANDE COBRINDO TODO O PACIENTE, INCLUINDO O ROSTO', 'ANTISSEPSIA DA PELE COM CLOREXIDINA ALCOÓLICA > 0,5%']],
      ['PARAMENTAÇÃO (BARREIRA MÁXIMA)', ['MÁSCARA', 'ÓCULOS', 'TOUCA DESCARTÁVEL', 'LUVA ESTÉRIL', 'AVENTAL (CAPOTE) CIRÚRGICO ESTÉRIL']],
      ['APÓS O PROCEDIMENTO', ['FIXAÇÃO DO CATETER EM 4 PONTOS', 'CURATIVO COM GAZE E FITA NAS PRIMEIRAS 24 HORAS (OU FILME TRANSPARENTE)', 'RAIO X CHECADO E DOCUMENTADO (JUGULAR OU SUBCLÁVIA)', 'DATA DA INSERÇÃO REGISTRADA NO CURATIVO']],
    ],
    assinaturas: ['MÉDICO QUE REALIZOU O PROCEDIMENTO (NOME, ASSINATURA E CARIMBO)', 'ENFERMEIRO(A) QUE APLICOU O CHECK-LIST (NOME, ASSINATURA E CARIMBO)'],
  },
  cvd: {
    titulo: 'CHECK-LIST PARA PASSAGEM DE CATETER VESICAL DE DEMORA',
    subtitulo: 'PROTOCOLO DE PREVENÇÃO DE INFECÇÃO DO TRATO URINÁRIO',
    tipos: ['cvd'],
    cabecalho: [
      ['JUSTIFICATIVA PARA O PROCEDIMENTO', ['MONITORIZAÇÃO DO VOLUME URINÁRIO', 'OBSTRUÇÃO DO TRATO URINÁRIO', 'BEXIGA NEUROGÊNICA E/OU RETENÇÃO URINÁRIA', 'CIRURGIA UROLÓGICA', 'IRRIGAÇÃO CONTÍNUA OU INTERMITENTE', 'LESÃO POR PRESSÃO EM REGIÃO SACRAL OU PERINEAL', 'INSTABILIDADE HEMODINÂMICA', 'OUTRO: ________']],
      ['TIPO DE PROCEDIMENTO', ['ELETIVO', 'URGÊNCIA']],
      ['CALIBRE', ['Nº ______'], 'numero'],
    ],
    secoes: [
      ['ANTES E DURANTE O PROCEDIMENTO', ['HIGIENIZAÇÃO DAS MÃOS', 'USO CORRETO DE EPI: TOUCA, MÁSCARA, AVENTAL E LUVAS', 'HIGIENE ÍNTIMA PRÉVIA COM ÁGUA E SABÃO OU DEGERMANTE', 'ANTISSEPSIA COM CLOREXIDINA AQUOSA', 'NOVA HIGIENIZAÇÃO DAS MÃOS (ÁGUA E SABÃO OU ÁLCOOL 70%)', 'ABERTURA DO MATERIAL ESTÉRIL SEM CONTAMINAÇÃO', 'LUVAS ESTÉREIS CALÇADAS COM TÉCNICA CORRETA', 'PASSAGEM SEM CONTAMINAÇÃO NA PRIMEIRA TENTATIVA', 'BALÃO INSUFLADO COM ÁGUA DESTILADA', 'SISTEMA FECHADO CONECTADO E BOLSA ABAIXO DO NÍVEL DA BEXIGA', 'FIXAÇÃO DO CATETER PARA EVITAR TRAÇÃO E TRAUMA']],
    ],
    assinaturas: ['PROFISSIONAL QUE REALIZOU O PROCEDIMENTO (ENFERMEIRO OU MÉDICO)', 'PROFISSIONAL QUE APLICOU O CHECK-LIST OU AUXILIOU'],
  },
};

// --------------------------------------------------------------------------- campos da ocorrência e do BH
function dispositivosAtivos(ev) {
  return (ev?.dados?.dispositivos?.itens || []).filter(dispositivoAtivo);
}
const primeiro = (lista, tipos) => lista.find((i) => tipos.includes(i.tipo));
const localCurto = (i) => [i?.local === 'OUTRO' ? i?.localOutro : i?.local, i?.lado === 'D' ? 'D' : i?.lado === 'E' ? 'E' : ''].filter(Boolean).join(' ');
const ROTULO_SONDA = { sne: 'SNE', soe: 'SOE', sng: 'SNG', sog: 'SOG' };

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
