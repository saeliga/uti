// Esquema da evolução: blocos, subblocos e campos. É DADO, não tela: o mesmo
// esquema gera o formulário, o texto para o PEP e as validações. Para mudar um
// campo, mude aqui. Rótulos por extenso; siglas só do Manual da Liga e nunca as
// ambíguas (PA, FR, EV, SC, HD, PCR, SAE…).

import { GLASGOW, glasgow, RASS, camAplicavel, camIcu, BPS, dor } from './escalas.js';
import { pam, diureseReal, debitoUrinario, num } from './calculos.js';
import { contagemDia } from './datas.js';

const op = (...lista) => Object.fromEntries(lista.map((x) => (Array.isArray(x) ? x : [x, x])));
const simNao = op(['sim', 'Sim'], ['nao', 'Não']);
const fmt = (v, casas = 1) => (v == null ? '' : String(Math.round(v * 10 ** casas) / 10 ** casas).replace('.', ','));

// Medidas preventivas: sempre começam sem marcação e usam quatro estados.
export const ESTADOS_MEDIDA = op(['prescrito', 'Prescrito'], ['realizado', 'Realizado'], ['nao_realizado', 'Não realizado'], ['nao_se_aplica', 'Não se aplica']);

const SUPORTES = op(
  ['aa', 'Ar ambiente'], ['cn', 'Cateter nasal (CN)'], ['venturi', 'Máscara de Venturi'], ['nao_reinalante', 'Máscara não reinalante'],
  ['cnaf', 'Cateter nasal de alto fluxo (CNAF)'], ['vni', 'VNI'], ['vmi_tot', 'VMI por TOT'], ['vmi_tqt', 'VMI por TQT'], ['tqt_espontanea', 'TQT em respiração espontânea'],
);
const comFluxo = (d) => ['cn', 'venturi', 'nao_reinalante', 'cnaf', 'tqt_espontanea'].includes(d.suporte);
const comFio2 = (d) => ['venturi', 'cnaf', 'vni', 'vmi_tot', 'vmi_tqt', 'tqt_espontanea'].includes(d.suporte);
const ventilado = (d) => ['vmi_tot', 'vmi_tqt'].includes(d.suporte);
const comPressao = (d) => ventilado(d) || d.suporte === 'vni';
const viaAereaArtificial = (d) => ['vmi_tot', 'vmi_tqt', 'tqt_espontanea'].includes(d.suporte);

// Atalhos do "Controle de infusão" (lista da folha atual da UTI). O texto gravado
// usa sempre o nome genérico; o nome comercial aparece só no botão, para facilitar a transição.
export const ATALHOS_INFUSAO = [
  { rotulo: 'Hidratação venosa', item: { medicamento: 'hidratação venosa' } },
  { rotulo: 'Midazolam', item: { medicamento: 'midazolam' } },
  { rotulo: 'Fentanil', item: { medicamento: 'fentanil' } },
  { rotulo: 'SG 10%', item: { medicamento: 'soro glicosado 10%' } },
  { rotulo: 'Insulina', item: { medicamento: 'insulina regular' } },
  { rotulo: 'Amiodarona (Ancoron)', item: { medicamento: 'amiodarona' } },
  { rotulo: 'Noradrenalina', item: { medicamento: 'noradrenalina' } },
  { rotulo: 'Dobutamina', item: { medicamento: 'dobutamina' } },
  { rotulo: 'Dopamina', item: { medicamento: 'dopamina' } },
  { rotulo: 'Nitroprussiato (Nipride)', item: { medicamento: 'nitroprussiato' } },
  { rotulo: 'Nitroglicerina (Tridil)', item: { medicamento: 'nitroglicerina' } },
];

export const TIPOS_DISPOSITIVO = op(
  ['cvc', 'CVC'], ['picc', 'PICC'], ['cti', 'Cateter venoso totalmente implantado'], ['cateter_dialise', 'Cateter de hemodiálise'],
  ['avp', 'Acesso venoso periférico'], ['pai', 'Cateter de pressão arterial invasiva'], ['tot', 'TOT'], ['tqt', 'TQT'],
  ['cvd', 'CVD'], ['sne', 'SNE'], ['sng', 'SNG'], ['soe', 'SOE'], ['gtm', 'GTM'], ['outro', 'Outro'],
);

/**
 * Tipos de campo: texto, numero, area, hora, data, datahora, escolha (uma opção),
 * multipla (várias), select, escala (opções com pontos), calculado (somente
 * leitura), medidas (lista fixa com 4 estados), lista (itens repetíveis; `atalhos`
 * incluem itens prontos com um toque).
 * `se(dados, contexto)` mostra o campo só quando se aplica.
 */
export const BLOCOS = [
  {
    id: 'b1', titulo: '1. Identificação e contexto',
    descricao: 'O cabeçalho vem da internação. Aqui ficam os dados do turno que mudam: peso, limitação de suporte e contexto oncológico.',
    subblocos: [
      {
        id: 'contexto', titulo: 'Peso e objetivos de cuidado', copiavel: true,
        campos: [
          { nome: 'peso', rotulo: 'Peso', tipo: 'numero', unidade: 'kg', ajuda: 'Usado no cálculo do débito urinário (mL/kg/h).' },
          { nome: 'pesoOrigem', rotulo: 'Origem do peso', tipo: 'escolha', opcoes: op(['aferido', 'Aferido'], ['estimado', 'Estimado'], ['referido', 'Referido']), se: (d) => num(d.peso) },
          { nome: 'limitacao', rotulo: 'Limitação de suporte documentada pela equipe', tipo: 'escolha', opcoes: simNao },
          { nome: 'limitacaoDescricao', rotulo: 'Qual limitação', tipo: 'texto', se: (d) => d.limitacao === 'sim' },
          { nome: 'objetivos', rotulo: 'Objetivo de cuidado (consulta)', tipo: 'escolha', opcoes: op(['curativo', 'Curativo'], ['paliativo', 'Paliativo exclusivo'], ['nao_definido', 'Não definido']) },
        ],
      },
      {
        id: 'oncologico', titulo: 'Contexto oncológico (preencher se necessário)', copiavel: true, opcional: true,
        campos: [
          { nome: 'neoplasia', rotulo: 'Neoplasia e fase do tratamento', tipo: 'texto' },
          { nome: 'ultimoTratamento', rotulo: 'Última quimioterapia/radioterapia (data e protocolo informado)', tipo: 'texto' },
          { nome: 'neutrofilos', rotulo: 'Neutrófilos', tipo: 'numero', unidade: '/mm³' },
          { nome: 'plaquetas', rotulo: 'Plaquetas', tipo: 'numero', unidade: '/mm³' },
          { nome: 'hemoglobina', rotulo: 'Hemoglobina', tipo: 'numero', unidade: 'g/dL' },
          { nome: 'dataExame', rotulo: 'Data do exame', tipo: 'data' },
          { nome: 'precaucoes', rotulo: 'Precauções', tipo: 'multipla', opcoes: op(['neutropenia', 'Neutropenia'], ['sangramento', 'Risco de sangramento']) },
          { nome: 'transfusoes', rotulo: 'Transfusões recentes e reações', tipo: 'texto' },
          { nome: 'mucosite', rotulo: 'Mucosite', tipo: 'escolha', opcoes: op(['0', 'Ausente'], ['1', 'Grau 1'], ['2', 'Grau 2'], ['3', 'Grau 3'], ['4', 'Grau 4']) },
          { nome: 'pps', rotulo: 'PPS', tipo: 'select', opcoes: op(...['100', '90', '80', '70', '60', '50', '40', '30', '20', '10'].map((v) => [v, `${v}%`])) },
          { nome: 'apoio', rotulo: 'Necessidades de apoio do paciente e da família', tipo: 'area' },
          { nome: 'acompanhante', rotulo: 'Acompanhante e contato de referência', tipo: 'texto' },
        ],
      },
    ],
  },
  {
    id: 'b2', titulo: '2. Avaliação atual',
    descricao: 'Valores de hoje. A evolução anterior aparece para consulta; para reaproveitar, confirme "sem alteração".',
    subblocos: [
      {
        id: 'sinais', titulo: 'Estado geral e sinais vitais', copiavel: false, obrigatorio: true,
        campos: [
          { nome: 'horario', rotulo: 'Horário da aferição', tipo: 'hora', obrigatorio: true },
          { nome: 'estadoGeral', rotulo: 'Estado geral', tipo: 'escolha', opcoes: op(['bom', 'Bom'], ['regular', 'Regular'], ['grave', 'Grave']), obrigatorio: true },
          { nome: 't', rotulo: 'Temperatura', tipo: 'numero', unidade: '°C', sinal: 't', obrigatorio: true },
          { nome: 'fc', rotulo: 'FC', tipo: 'numero', unidade: 'bpm', sinal: 'fc', obrigatorio: true },
          { nome: 'fr', rotulo: 'Frequência respiratória', tipo: 'numero', unidade: 'irpm', sinal: 'fr', obrigatorio: true },
          { nome: 'pas', rotulo: 'Pressão arterial sistólica', tipo: 'numero', unidade: 'mmHg', sinal: 'pas', obrigatorio: true },
          { nome: 'pad', rotulo: 'Pressão arterial diastólica', tipo: 'numero', unidade: 'mmHg', sinal: 'pad', obrigatorio: true },
          { nome: 'pam', rotulo: 'PAM', tipo: 'calculado', calc: (d) => { const v = pam(d.pas, d.pad); return v == null ? '' : `${v} mmHg`; }, sinalCalc: (d) => ['pam', pam(d.pas, d.pad)] },
          { nome: 'spo2', rotulo: 'SpO2', tipo: 'numero', unidade: '%', sinal: 'spo2', obrigatorio: true },
          { nome: 'hgt', rotulo: 'HGT', tipo: 'numero', unidade: 'mg/dL', sinal: 'hgt' },
          { nome: 'suporte', rotulo: 'Suporte usado para manter os valores', tipo: 'texto', ajuda: 'Ex.: noradrenalina em titulação, O2 por CNAF.' },
        ],
      },
      {
        id: 'neuro', titulo: 'Neurológico e sedoanalgesia', copiavel: true, obrigatorio: true,
        campos: [
          { nome: 'consciencia', rotulo: 'Nível de consciência', tipo: 'escolha', obrigatorio: true,
            opcoes: op(['alerta', 'Alerta'], ['sonolento', 'Sonolento'], ['torporoso', 'Torporoso'], ['comatoso', 'Comatoso'], ['sedado', 'Sob sedação']) },
          { nome: 'gOcular', rotulo: 'Glasgow — abertura ocular', tipo: 'escala', opcoes: GLASGOW.ocular },
          { nome: 'gVerbal', rotulo: 'Glasgow — resposta verbal', tipo: 'escala', opcoes: GLASGOW.verbal },
          { nome: 'gMotora', rotulo: 'Glasgow — resposta motora', tipo: 'escala', opcoes: GLASGOW.motora },
          { nome: 'glasgow', rotulo: 'Glasgow', tipo: 'calculado', calc: (d) => glasgow({ ocular: d.gOcular, verbal: d.gVerbal, motora: d.gMotora }).texto },
          { nome: 'pupilaD', rotulo: 'Pupila direita (mm)', tipo: 'select', opcoes: op('1', '2', '3', '4', '5', '6', '7', '8') },
          { nome: 'pupilaE', rotulo: 'Pupila esquerda (mm)', tipo: 'select', opcoes: op('1', '2', '3', '4', '5', '6', '7', '8') },
          { nome: 'fotoD', rotulo: 'Fotorreação direita', tipo: 'escolha', opcoes: op(['presente', 'Presente'], ['lenta', 'Lenta'], ['ausente', 'Ausente']) },
          { nome: 'fotoE', rotulo: 'Fotorreação esquerda', tipo: 'escolha', opcoes: op(['presente', 'Presente'], ['lenta', 'Lenta'], ['ausente', 'Ausente']) },
          { nome: 'simetria', rotulo: 'Pupilas', tipo: 'calculado', calc: (d) => (!d.pupilaD || !d.pupilaE ? '' : Math.abs(d.pupilaD - d.pupilaE) >= 1 ? 'Anisocóricas' : 'Isocóricas') },
          { nome: 'rass', rotulo: 'RASS', tipo: 'select', opcoes: RASS },
          { nome: 'metaRass', rotulo: 'Meta de RASS prescrita', tipo: 'select', opcoes: RASS },
          { nome: 'interrupcao', rotulo: 'Interrupção diária da sedação', tipo: 'escolha', opcoes: op(['realizada', 'Realizada'], ['nao_realizada', 'Não realizada'], ['nao_se_aplica', 'Não se aplica']), se: (d) => d.consciencia === 'sedado' },
          { nome: 'camAgudo', rotulo: 'Delirium — início agudo ou curso flutuante?', tipo: 'escolha', opcoes: simNao, se: (d) => camAplicavel(d.rass) },
          { nome: 'camDesatencao', rotulo: 'Delirium — desatenção?', tipo: 'escolha', opcoes: simNao, se: (d) => camAplicavel(d.rass) && d.camAgudo === 'sim' },
          { nome: 'camDesorganizado', rotulo: 'Delirium — pensamento desorganizado?', tipo: 'escolha', opcoes: simNao, se: (d) => camAplicavel(d.rass) && d.camAgudo === 'sim' && d.camDesatencao === 'sim' && Number(d.rass) === 0 },
          { nome: 'cam', rotulo: 'Rastreio de delirium', ajuda: 'Método CAM-ICU.', tipo: 'calculado', calc: (d) => ({ positivo: 'Positivo', negativo: 'Negativo', nao_aplicavel: 'Não aplicável (RASS abaixo de −3)' })[camIcu({ rass: d.rass, agudo: d.camAgudo, desatencao: d.camDesatencao, desorganizado: d.camDesorganizado }).resultado] || '' },
        ],
      },
      {
        id: 'dor', titulo: 'Dor', copiavel: false, obrigatorio: true,
        campos: [
          { nome: 'escala', rotulo: 'Escala (conforme a comunicação do paciente)', tipo: 'escolha', obrigatorio: true,
            opcoes: op(['evn', 'EVN (comunica)'], ['eva', 'EVA (comunica)'], ['bps', 'BPS (sedado/intubado)'], ['nao_avaliavel', 'Não avaliável']) },
          { nome: 'escore', rotulo: 'Escore (0 a 10)', tipo: 'escala', opcoes: op(...Array.from({ length: 11 }, (_, i) => String(i))), se: (d) => d.escala === 'evn' || d.escala === 'eva' },
          { nome: 'bpsFacial', rotulo: 'BPS — expressão facial', tipo: 'escala', opcoes: BPS.facial, se: (d) => d.escala === 'bps' },
          { nome: 'bpsMembros', rotulo: 'BPS — membros superiores', tipo: 'escala', opcoes: BPS.membros, se: (d) => d.escala === 'bps' },
          { nome: 'bpsVentilacao', rotulo: 'BPS — adaptação à ventilação', tipo: 'escala', opcoes: BPS.ventilacao, se: (d) => d.escala === 'bps' },
          { nome: 'resultado', rotulo: 'Resultado', tipo: 'calculado', calc: (d) => { const r = dorDe(d); return r.total == null ? r.classe : `${r.escala} ${r.total} — ${r.classe}`; } },
          { nome: 'local', rotulo: 'Local', tipo: 'texto', se: (d) => dorDe(d).comDor },
          { nome: 'conduta', rotulo: 'Conduta', tipo: 'multipla', opcoes: op(['farmacologica', 'Farmacológica'], ['nao_farmacologica', 'Não farmacológica']), se: (d) => dorDe(d).comDor },
          { nome: 'reavHora', rotulo: 'Reavaliação — horário', tipo: 'hora', se: (d) => dorDe(d).comDor },
          { nome: 'reavEscore', rotulo: 'Reavaliação — novo escore', tipo: 'numero', se: (d) => dorDe(d).comDor },
        ],
      },
      {
        id: 'respiratorio', titulo: 'Respiratório', copiavel: true, obrigatorio: true,
        campos: [
          { nome: 'suporte', rotulo: 'Interface / suporte', tipo: 'select', opcoes: SUPORTES, obrigatorio: true },
          { nome: 'fluxo', rotulo: 'Fluxo de O2', tipo: 'numero', unidade: 'L/min', se: comFluxo },
          { nome: 'fio2', rotulo: 'FiO2', tipo: 'numero', unidade: '%', se: comFio2 },
          { nome: 'modo', rotulo: 'Modo', tipo: 'select', opcoes: op('VCV', 'PCV', 'PSV', 'SIMV', 'CPAP'), se: comPressao },
          { nome: 'peep', rotulo: 'PEEP', tipo: 'numero', unidade: 'cmH2O', se: comPressao },
          { nome: 'pSuporte', rotulo: 'Pressão de suporte', tipo: 'numero', unidade: 'cmH2O', se: comPressao },
          { nome: 'vc', rotulo: 'VC', tipo: 'numero', unidade: 'mL', se: ventilado },
          { nome: 'frProgramada', rotulo: 'Frequência programada', tipo: 'numero', unidade: 'irpm', se: ventilado },
          { nome: 'cuff', rotulo: 'Pressão do cuff', tipo: 'numero', unidade: 'cmH2O', se: viaAereaArtificial },
          { nome: 'fixacao', rotulo: 'Fixação do TOT (rima labial, cm)', tipo: 'texto', se: (d) => d.suporte === 'vmi_tot' },
          { nome: 'padrao', rotulo: 'Padrão respiratório', tipo: 'multipla', opcoes: op(['eupneico', 'Eupneico'], ['taquipneico', 'Taquipneico'], ['bradipneico', 'Bradipneico'], ['dispneico', 'Dispneico'], ['acessoria', 'Uso de musculatura acessória'], ['assincronia', 'Assincronia com o ventilador']) },
          { nome: 'ausculta', rotulo: 'Ausculta', tipo: 'multipla', opcoes: op(['mv_presentes', 'MV presentes'], ['mv_diminuidos', 'MV diminuídos'], ['roncos', 'Roncos'], ['sibilos', 'Sibilos'], ['estertores', 'Estertores']) },
          { nome: 'secrecao', rotulo: 'Secreção — quantidade', tipo: 'escolha', opcoes: op(['ausente', 'Ausente'], ['pequena', 'Pequena'], ['moderada', 'Moderada'], ['grande', 'Grande']) },
          { nome: 'secrecaoAspecto', rotulo: 'Secreção — aspecto', tipo: 'texto', se: (d) => d.secrecao && d.secrecao !== 'ausente' },
        ],
      },
      {
        id: 'hemodinamica', titulo: 'Hemodinâmica', copiavel: true,
        campos: [
          { nome: 'ritmo', rotulo: 'Ritmo', tipo: 'escolha', opcoes: op(['sinusal', 'Sinusal'], ['fibrilacao', 'Fibrilação atrial'], ['marcapasso', 'Marca-passo'], ['outro', 'Outro']) },
          { nome: 'ritmoOutro', rotulo: 'Qual ritmo', tipo: 'texto', se: (d) => d.ritmo === 'outro' },
          { nome: 'tec', rotulo: 'TEC', tipo: 'escolha', opcoes: op(['ate3', 'Até 3 s'], ['mais3', 'Mais de 3 s']) },
          { nome: 'pulsos', rotulo: 'Pulsos periféricos', tipo: 'escolha', opcoes: op(['presentes', 'Presentes e cheios'], ['finos', 'Finos'], ['ausentes', 'Ausentes']) },
          { nome: 'extremidades', rotulo: 'Extremidades', tipo: 'escolha', opcoes: op(['aquecidas', 'Aquecidas'], ['frias', 'Frias'], ['cianoticas', 'Cianóticas']) },
        ],
      },
      {
        id: 'infusoes', titulo: 'Infusões contínuas (controle de infusão)', copiavel: true,
        descricao: 'Toque no medicamento para incluir e informe a vazão. Para outro medicamento, use "+ Outra infusão".',
        campos: [
          {
            nome: 'itens', rotulo: 'Infusões em uso', tipo: 'lista', rotuloItem: 'infusão',
            tituloItem: (i) => (i.medicamento ? i.medicamento.charAt(0).toUpperCase() + i.medicamento.slice(1) : 'Outra infusão'),
            atalhos: ATALHOS_INFUSAO,
            textoItem: (i) => `${i.medicamento || 'medicamento não informado'}${i.vazao ? ` a ${String(i.vazao).replace('.', ',')} mL/h` : ''}`,
            campos: [
              { nome: 'medicamento', rotulo: 'Medicamento / solução', tipo: 'texto', ajuda: 'Use o nome genérico.' },
              { nome: 'vazao', rotulo: 'Vazão', tipo: 'numero', unidade: 'mL/h' },
            ],
          },
        ],
      },
      {
        id: 'renal', titulo: 'Renal e eliminação urinária', copiavel: true,
        campos: [
          { nome: 'modo', rotulo: 'Eliminação urinária', tipo: 'escolha', opcoes: op(['espontanea', 'Espontânea'], ['cvd', 'CVD'], ['cva', 'CVA'], ['fralda', 'Fralda'], ['urostomia', 'Urostomia'], ['nefrostomia', 'Nefrostomia'], ['anuria', 'Anúria']) },
          { nome: 'volume', rotulo: 'Volume no período', tipo: 'numero', unidade: 'mL', se: (d) => !d.irrigacao || d.irrigacao === 'nao' },
          { nome: 'horas', rotulo: 'Período', tipo: 'numero', unidade: 'h' },
          { nome: 'aspecto', rotulo: 'Aspecto', tipo: 'texto' },
          { nome: 'irrigacao', rotulo: 'Irrigação vesical', tipo: 'escolha', opcoes: simNao },
          { nome: 'infundido', rotulo: 'Volume infundido (irrigação)', tipo: 'numero', unidade: 'mL', se: (d) => d.irrigacao === 'sim' },
          { nome: 'drenado', rotulo: 'Volume drenado total', tipo: 'numero', unidade: 'mL', se: (d) => d.irrigacao === 'sim' },
          { nome: 'diureseReal', rotulo: 'Diurese real', tipo: 'calculado', se: (d) => d.irrigacao === 'sim', calc: (d) => { const v = diureseReal(d.drenado, d.infundido); return v == null ? '' : `${v} mL (drenado − infundido)`; } },
          { nome: 'debito', rotulo: 'Débito urinário', tipo: 'calculado', calc: (d, ctx) => { const vol = d.irrigacao === 'sim' ? diureseReal(d.drenado, d.infundido) : num(d.volume); const v = debitoUrinario(vol, ctx.peso, d.horas); return v == null ? '' : `${fmt(v, 2)} mL/kg/h`; } },
          { nome: 'terapiaRenal', rotulo: 'Terapia renal substitutiva', tipo: 'escolha', opcoes: op(['nao', 'Não'], ['hemodialise', 'Hemodiálise'], ['continua', 'Terapia contínua']) },
        ],
      },
      {
        id: 'gi', titulo: 'Gastrintestinal e nutrição', copiavel: true,
        campos: [
          { nome: 'via', rotulo: 'Dieta — via', tipo: 'multipla', opcoes: op(['jejum', 'Jejum'], ['vo', 'VO'], ['sne', 'SNE'], ['soe', 'SOE'], ['sng', 'SNG'], ['gtm', 'GTM'], ['npt', 'NPT']) },
          { nome: 'jejumMotivo', rotulo: 'Motivo do jejum', tipo: 'texto', se: (d) => (d.via || []).includes('jejum') },
          { nome: 'dieta', rotulo: 'Tipo de dieta e vazão', tipo: 'texto', se: (d) => (d.via || []).some((v) => v !== 'jejum') },
          { nome: 'pausas', rotulo: 'Pausas e motivo', tipo: 'texto', se: (d) => (d.via || []).some((v) => ['sne', 'soe', 'sng', 'gtm'].includes(v)) },
          { nome: 'abdome', rotulo: 'Abdome', tipo: 'multipla', opcoes: op(['flacido', 'Flácido'], ['globoso', 'Globoso'], ['distendido', 'Distendido'], ['doloroso', 'Doloroso à palpação'], ['timpanico', 'Timpânico']) },
          { nome: 'nausea', rotulo: 'Náusea / vômito', tipo: 'escolha', opcoes: op(['nao', 'Não'], ['nausea', 'Náusea'], ['vomito', 'Vômito']) },
          { nome: 'ultimaEvacuacao', rotulo: 'Data da última evacuação', tipo: 'data' },
          { nome: 'diasSemEvacuar', rotulo: 'Dias sem evacuar', tipo: 'calculado', calc: (d, ctx) => (d.ultimaEvacuacao ? contagemDia(d.ultimaEvacuacao, ctx.dataTurno).replace('D', '') + ' dia(s)' : '') },
          { nome: 'fezes', rotulo: 'Aspecto das fezes', tipo: 'texto' },
          { nome: 'estomias', rotulo: 'Estomias', tipo: 'texto' },
        ],
      },
      {
        id: 'pele', titulo: 'Pele, feridas e LPP', copiavel: true,
        descricao: 'Braden e Morse não são registrados aqui: são preenchidos e acompanhados no PEP oficial.',
        campos: [
          { nome: 'inspecao', rotulo: 'Inspeção da pele', tipo: 'texto' },
          { nome: 'mucosas', rotulo: 'Mucosas', tipo: 'escolha', opcoes: op(['integras', 'Íntegras'], ['ressecadas', 'Ressecadas'], ['mucosite', 'Com mucosite']) },
          {
            nome: 'lesoes', rotulo: 'Lesões e feridas', tipo: 'lista', rotuloItem: 'lesão',
            campos: [
              { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: op(['lpp', 'LPP'], ['cirurgica', 'Ferida cirúrgica'], ['oncologica', 'Ferida oncológica'], ['dermatite', 'Dermatite associada à incontinência'], ['outra', 'Outra']) },
              { nome: 'local', rotulo: 'Local', tipo: 'texto' },
              { nome: 'estagio', rotulo: 'Estágio / categoria', tipo: 'texto' },
              { nome: 'medidas', rotulo: 'Medidas (cm)', tipo: 'texto' },
              { nome: 'leito', rotulo: 'Leito da ferida e exsudato', tipo: 'texto' },
              { nome: 'cobertura', rotulo: 'Cobertura', tipo: 'texto' },
              { nome: 'troca', rotulo: 'Data da troca', tipo: 'data' },
              { nome: 'evolucao', rotulo: 'Evolução', tipo: 'escolha', opcoes: op(['melhora', 'Melhora'], ['estavel', 'Estável'], ['piora', 'Piora']) },
            ],
          },
        ],
      },
      {
        id: 'dispositivos', titulo: 'Dispositivos', copiavel: true,
        campos: [
          {
            nome: 'itens', rotulo: 'Dispositivos em uso', tipo: 'lista', rotuloItem: 'dispositivo',
            textoItem: (i, ctx) => [TIPOS_DISPOSITIVO[i.tipo] || i.tipo, i.local, i.insercao && `inserção ${i.insercao.split('-').reverse().join('/')} (${contagemDia(i.insercao, ctx.dataTurno)})`,
              i.sitio && `sítio: ${i.sitio}`, i.curativo && `curativo: ${i.curativo}`, i.necessario && `necessário: ${i.necessario === 'sim' ? 'sim' : 'não'}`].filter(Boolean).join(', '),
            campos: [
              { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: TIPOS_DISPOSITIVO },
              { nome: 'local', rotulo: 'Local', tipo: 'texto' },
              { nome: 'insercao', rotulo: 'Data de inserção', tipo: 'data' },
              { nome: 'dias', rotulo: 'Dias', tipo: 'calculado', calc: (i, ctx) => contagemDia(i.insercao, ctx.dataTurno) },
              { nome: 'sitio', rotulo: 'Condições do sítio', tipo: 'texto' },
              { nome: 'curativo', rotulo: 'Curativo (tipo e data da troca)', tipo: 'texto' },
              { nome: 'necessario', rotulo: 'Ainda é necessário?', tipo: 'escolha', opcoes: simNao },
            ],
          },
          {
            nome: 'drenos', rotulo: 'Drenos', tipo: 'lista', rotuloItem: 'dreno',
            campos: [
              { nome: 'tipo', rotulo: 'Tipo', tipo: 'texto' },
              { nome: 'local', rotulo: 'Local', tipo: 'texto' },
              { nome: 'volume', rotulo: 'Volume no período', tipo: 'numero', unidade: 'mL' },
              { nome: 'aspecto', rotulo: 'Aspecto', tipo: 'texto' },
            ],
          },
        ],
      },
      {
        id: 'contencao', titulo: 'Contenção mecânica', copiavel: true,
        campos: [
          { nome: 'emUso', rotulo: 'Contenção em uso?', tipo: 'escolha', opcoes: simNao },
          { nome: 'indicacao', rotulo: 'Indicação', tipo: 'texto', se: (d) => d.emUso === 'sim' },
          { nome: 'prescrita', rotulo: 'Prescrita?', tipo: 'escolha', opcoes: simNao, se: (d) => d.emUso === 'sim' },
          { nome: 'local', rotulo: 'Tipo e local', tipo: 'texto', se: (d) => d.emUso === 'sim' },
          { nome: 'inicio', rotulo: 'Início', tipo: 'datahora', se: (d) => d.emUso === 'sim' },
          { nome: 'avaliacao', rotulo: 'Pele, perfusão e conforto no local', tipo: 'texto', se: (d) => d.emUso === 'sim' },
          { nome: 'reavHora', rotulo: 'Reavaliação da necessidade — horário', tipo: 'hora', se: (d) => d.emUso === 'sim' },
        ],
      },
      {
        id: 'antimicrobianos', titulo: 'Antimicrobianos e culturas', copiavel: true,
        campos: [
          {
            nome: 'itens', rotulo: 'Antimicrobianos', tipo: 'lista', rotuloItem: 'antimicrobiano',
            textoItem: (i, ctx) => `${i.nome || 'não informado'}${i.inicio ? ` ${contagemDia(i.inicio, ctx.dataTurno)}${i.previsto ? `/${i.previsto}` : ''}` : ''}`,
            campos: [
              { nome: 'nome', rotulo: 'Antimicrobiano', tipo: 'texto' },
              { nome: 'inicio', rotulo: 'Início', tipo: 'data' },
              { nome: 'dia', rotulo: 'Dia', tipo: 'calculado', calc: (i, ctx) => contagemDia(i.inicio, ctx.dataTurno) },
              { nome: 'previsto', rotulo: 'Dias previstos', tipo: 'numero' },
            ],
          },
          {
            nome: 'culturas', rotulo: 'Culturas', tipo: 'lista', rotuloItem: 'cultura',
            campos: [
              { nome: 'material', rotulo: 'Material', tipo: 'texto' },
              { nome: 'coleta', rotulo: 'Coleta', tipo: 'data' },
              { nome: 'resultado', rotulo: 'Resultado', tipo: 'texto' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'b6', titulo: '6. Intercorrências, pendências e narrativa',
    descricao: 'Pendências abertas da evolução anterior já vêm para cá e seguem até serem resolvidas.',
    subblocos: [
      {
        id: 'intercorrencias', titulo: 'Intercorrências', copiavel: false,
        campos: [
          { nome: 'itens', rotulo: 'Intercorrências', tipo: 'lista', rotuloItem: 'intercorrência',
            textoItem: (i) => [i.hora, i.descricao, i.conduta && `conduta: ${i.conduta}`, i.comunicado && `comunicado: ${i.comunicado}`, i.resultado && `resultado: ${i.resultado}`].filter(Boolean).join(', '),
            campos: [
              { nome: 'hora', rotulo: 'Horário', tipo: 'hora' },
              { nome: 'descricao', rotulo: 'O que aconteceu', tipo: 'area' },
              { nome: 'conduta', rotulo: 'Conduta', tipo: 'texto' },
              { nome: 'comunicado', rotulo: 'Profissional comunicado', tipo: 'texto' },
              { nome: 'resultado', rotulo: 'Resultado', tipo: 'texto' },
            ] },
        ],
      },
      {
        id: 'pendencias', titulo: 'Pendências', copiavel: false,
        campos: [
          { nome: 'itens', rotulo: 'Pendências', tipo: 'lista', rotuloItem: 'pendência',
            textoItem: (i) => [i.descricao, i.providencia && `providência: ${i.providencia}`, i.comunicado && `comunicado: ${i.comunicado}`, i.situacao === 'resolvida' ? 'resolvida' : 'aberta'].filter(Boolean).join(', '),
            campos: [
              { nome: 'descricao', rotulo: 'Pendência', tipo: 'texto' },
              { nome: 'providencia', rotulo: 'Providência tomada', tipo: 'texto' },
              { nome: 'comunicado', rotulo: 'Profissional comunicado', tipo: 'texto' },
              { nome: 'situacao', rotulo: 'Situação', tipo: 'escolha', opcoes: op(['aberta', 'Aberta'], ['resolvida', 'Resolvida']) },
            ] },
        ],
      },
      {
        id: 'narrativa', titulo: 'Narrativa interpretativa', copiavel: false, obrigatorio: true,
        descricao: 'O que os achados significam e o raciocínio do enfermeiro — não a repetição dos campos.',
        campos: [{ nome: 'texto', rotulo: 'Narrativa', tipo: 'area', linhas: 6, obrigatorio: true }],
      },
    ],
  },
];

// Atalhos de cálculo a partir dos dados do subbloco.
export const dorDe = (d) => dor({ escala: d.escala, escore: d.escore, bps: { facial: d.bpsFacial, membros: d.bpsMembros, ventilacao: d.bpsVentilacao } });

export const SUBBLOCOS = Object.fromEntries(BLOCOS.flatMap((b) => b.subblocos.map((s) => [s.id, { ...s, bloco: b.id }])));

/** Contexto usado por campos condicionais e cálculos (peso, via aérea, dispositivos). */
export function contextoEvolucao(dados = {}, dataTurno) {
  const disp = dados.dispositivos?.itens || [];
  const sup = dados.respiratorio?.suporte;
  return {
    dataTurno,
    peso: num(dados.contexto?.peso),
    ventilado: ['vmi_tot', 'vmi_tqt'].includes(sup) || disp.some((i) => i.tipo === 'tot' || i.tipo === 'tqt'),
    temCvd: dados.renal?.modo === 'cvd' || disp.some((i) => i.tipo === 'cvd'),
    temCvc: disp.some((i) => ['cvc', 'picc', 'cti', 'cateter_dialise'].includes(i.tipo)),
  };
}

/** Campo visível? (aplica a condição `se`). */
export const visivel = (campo, dados, ctx) => !campo.se || !!campo.se(dados || {}, ctx);
