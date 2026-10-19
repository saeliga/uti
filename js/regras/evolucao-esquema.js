// Esquema da evolução: blocos, subblocos e campos. É DADO, não tela: o mesmo
// esquema gera o formulário, o texto para o PEP e as validações. Para mudar um
// campo, mude aqui. Rótulos por extenso; siglas só do Manual da Liga e nunca as
// ambíguas (PA, FR, EV, SC, HD, PCR, SAE…).

import { GLASGOW, glasgow, RASS, camAplicavel, camIcu, BPS, dor } from './escalas.js';
import { pam, diureseReal, debitoUrinario, num } from './calculos.js';
import { contagemDia, diasEntre, formatarData } from './datas.js';
import { CATALOGO_DISPOSITIVOS, textoDispositivos, dispositivosParaNovoDia, ativo as dispositivoAtivo } from './dispositivos.js';
import { GRUPOS_INFUSAO, textoInfusoes } from './infusoes.js';

const op = (...lista) => Object.fromEntries(lista.map((x) => (Array.isArray(x) ? x : [x, x])));
const simNao = op(['sim', 'Sim'], ['nao', 'Não']);
const fmt = (v, casas = 1) => (v == null ? '' : String(Math.round(v * 10 ** casas) / 10 ** casas).replace('.', ','));

// Medidas preventivas: sempre começam sem marcação e usam quatro estados.
export const ESTADOS_MEDIDA = op(['prescrito', 'Prescrito'], ['realizado', 'Realizado'], ['nao_realizado', 'Não realizado'], ['nao_se_aplica', 'Não se aplica']);

// Neurológico: RASS só para paciente sob sedação; Glasgow para os demais.
const sedado = (d) => d.consciencia === 'sedado';
const semSedacao = (d) => !!d.consciencia && d.consciencia !== 'sedado';
const nivelAlterado = (d) => (sedado(d) ? Number(d.rass) !== 0 : d.consciencia !== 'alerta');
export function camDe(d) {
  const aplicavel = sedado(d) ? camAplicavel(d.rass) : ['alerta', 'sonolento'].includes(d.consciencia);
  return camIcu({ rass: d.rass, agudo: d.camAgudo, desatencao: d.camDesatencao, desorganizado: d.camDesorganizado, aplicavel, nivelAlterado: nivelAlterado(d) });
}

const SUPORTES = op(
  ['aa', 'Ar ambiente'], ['cn', 'Cateter nasal (CN)'], ['venturi', 'Máscara de Venturi'], ['nao_reinalante', 'Máscara não reinalante'],
  ['cnaf', 'Cateter nasal de alto fluxo (CNAF)'], ['vni', 'VNI'], ['vmi_tot', 'VMI por TOT'], ['vmi_tqt', 'VMI por TQT'], ['tqt_espontanea', 'TQT em respiração espontânea'],
);
const comFluxo = (d) => ['cn', 'venturi', 'nao_reinalante', 'cnaf', 'tqt_espontanea'].includes(d.suporte);
const comFio2 = (d) => ['venturi', 'cnaf', 'vni', 'vmi_tot', 'vmi_tqt', 'tqt_espontanea'].includes(d.suporte);
const ventilado = (d) => ['vmi_tot', 'vmi_tqt'].includes(d.suporte);
const comPressao = (d) => ventilado(d) || d.suporte === 'vni';

export const TIPOS_DISPOSITIVO = Object.fromEntries(Object.entries(CATALOGO_DISPOSITIVOS).map(([k, v]) => [k, v.nome]));

// Locais para MV diminuídos/abolidos (texto por extenso no PEP).
const CAMPOS_PULMONARES = op(['apice_d', 'Ápice direito'], ['apice_e', 'Ápice esquerdo'], ['medio_d', 'Terço médio direito'], ['medio_e', 'Terço médio esquerdo'],
  ['base_d', 'Base direita'], ['base_e', 'Base esquerda'], ['difuso', 'Difusamente']);
const temEdema = (d) => (d.edemaLocais || []).some((v) => v !== 'sem');

// Escala de Bristol (consistência das fezes).
export const BRISTOL = op(
  ['1', 'Tipo 1 — caroços duros e separados'], ['2', 'Tipo 2 — formato de salsicha, encaroçada'], ['3', 'Tipo 3 — salsicha com fissuras na superfície'],
  ['4', 'Tipo 4 — salsicha ou cobra, lisa e macia'], ['5', 'Tipo 5 — pedaços macios com bordas definidas'], ['6', 'Tipo 6 — pedaços moles, bordas irregulares, pastosa'],
  ['7', 'Tipo 7 — totalmente líquida'],
);

/**
 * Tipos de campo: texto, numero, area, hora, data, datahora, escolha (uma opção),
 * multipla (várias, em botões), marcar (várias, em caixas de marcar; `excludentes`
 * são grupos em que só um vale e `exclusivos` desmarcam todo o resto), select,
 * escala (opções com pontos), calculado (somente leitura), medidas (lista fixa com
 * 4 estados), lista (itens repetíveis), infusoes e dispositivos (componentes
 * próprios; o texto vem de `texto(valor, ctx)`).
 * `se(dados, contexto)` mostra o campo só quando se aplica. `info` liga o campo ao guia da
 * escala (botão "i" ao lado do rótulo; textos em escalas-info.js).
 * Subbloco `herdavel`: ao abrir o dia, vem preenchido com a evolução anterior
 * (`aoHerdar` ajusta o que recomeça a cada dia).
 */
export const BLOCOS = [
  {
    id: 'b2', titulo: '2. Avaliação',
    descricao: 'Valores de hoje, intercorrências, ocorrências e narrativa. A evolução anterior aparece para consulta; para reaproveitar, confirme "sem alteração". Ocorrências abertas da evolução anterior já vêm preenchidas e seguem até serem marcadas como resolvidas.',
    subblocos: [
      {
        id: 'cuidado', titulo: 'Limitação de suporte e objetivo de cuidado', copiavel: true, herdavel: true,
        campos: [
          { nome: 'limitacao', rotulo: 'Limitação de suporte documentada pela equipe', tipo: 'escolha', opcoes: simNao },
          { nome: 'limitacaoDescricao', rotulo: 'Qual limitação', tipo: 'texto', se: (d) => d.limitacao === 'sim' },
          { nome: 'objetivos', rotulo: 'Objetivo de cuidado (consulta)', tipo: 'escolha', opcoes: op(['curativo', 'Curativo'], ['paliativo', 'Paliativo exclusivo'], ['nao_definido', 'Não definido']) },
        ],
      },
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
        ],
      },
      {
        id: 'neuro', titulo: 'Neurológico e sedoanalgesia', copiavel: true, obrigatorio: true,
        campos: [
          { nome: 'consciencia', rotulo: 'Nível de consciência', tipo: 'escolha', obrigatorio: true,
            opcoes: op(['alerta', 'Alerta'], ['sonolento', 'Sonolento'], ['torporoso', 'Torporoso'], ['comatoso', 'Comatoso'], ['sedado', 'Sob sedação']) },
          { nome: 'gOcular', rotulo: 'Glasgow — abertura ocular', tipo: 'escala', opcoes: GLASGOW.ocular, se: semSedacao, info: 'glasgow' },
          { nome: 'gVerbal', rotulo: 'Glasgow — resposta verbal', tipo: 'escala', opcoes: GLASGOW.verbal, se: semSedacao },
          { nome: 'gMotora', rotulo: 'Glasgow — resposta motora', tipo: 'escala', opcoes: GLASGOW.motora, se: semSedacao },
          { nome: 'glasgow', rotulo: 'Glasgow', tipo: 'calculado', se: semSedacao, calc: (d) => glasgow({ ocular: d.gOcular, verbal: d.gVerbal, motora: d.gMotora }).texto },
          { nome: 'rass', rotulo: 'RASS', tipo: 'select', opcoes: RASS, se: sedado, info: 'rass' },
          { nome: 'metaRass', rotulo: 'Meta de RASS prescrita', tipo: 'select', opcoes: RASS, se: sedado },
          { nome: 'interrupcao', rotulo: 'Interrupção diária da sedação', tipo: 'escolha', opcoes: op(['realizada', 'Realizada'], ['nao_realizada', 'Não realizada'], ['nao_se_aplica', 'Não se aplica']), se: sedado },
          { nome: 'pupilas', rotulo: 'Pupilas', tipo: 'escolha', opcoes: op(['isocoricas', 'Isocóricas'], ['anisocoricas', 'Anisocóricas'], ['puntiformes', 'Puntiformes']) },
          { nome: 'fotoD', rotulo: 'Fotorreação direita', tipo: 'escolha', opcoes: op(['presente', 'Presente'], ['lenta', 'Lenta'], ['ausente', 'Ausente']) },
          { nome: 'fotoE', rotulo: 'Fotorreação esquerda', tipo: 'escolha', opcoes: op(['presente', 'Presente'], ['lenta', 'Lenta'], ['ausente', 'Ausente']) },
          { nome: 'camAgudo', rotulo: 'Delirium — início agudo ou curso flutuante?', tipo: 'escolha', opcoes: simNao, se: (d) => camDe(d).aplicavel, info: 'cam' },
          { nome: 'camDesatencao', rotulo: 'Delirium — desatenção?', tipo: 'escolha', opcoes: simNao, se: (d) => camDe(d).aplicavel && d.camAgudo === 'sim' },
          { nome: 'camDesorganizado', rotulo: 'Delirium — pensamento desorganizado?', tipo: 'escolha', opcoes: simNao, se: (d) => camDe(d).aplicavel && d.camAgudo === 'sim' && d.camDesatencao === 'sim' && !nivelAlterado(d) },
          { nome: 'cam', rotulo: 'Rastreio de delirium', ajuda: 'Método CAM-ICU.', tipo: 'calculado', se: (d) => !!d.consciencia,
            calc: (d) => ({ positivo: 'Positivo', negativo: 'Negativo', nao_aplicavel: sedado(d) ? 'Não aplicável (RASS abaixo de −3)' : 'Não aplicável (nível de consciência)' })[camDe(d).resultado] || '' },
        ],
      },
      {
        id: 'dor', titulo: 'Dor', copiavel: false, obrigatorio: true,
        campos: [
          { nome: 'escala', rotulo: 'Escala (conforme a comunicação do paciente)', tipo: 'escolha', obrigatorio: true,
            opcoes: op(['evn', 'EVN (comunica)'], ['bps', 'BPS (sedado/intubado)'], ['nao_avaliavel', 'Não avaliável']), info: 'dor' },
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
          { nome: 'padrao', rotulo: 'Padrão respiratório', tipo: 'multipla', opcoes: op(['eupneico', 'Eupneico'], ['taquipneico', 'Taquipneico'], ['bradipneico', 'Bradipneico'], ['dispneico', 'Dispneico'], ['acessoria', 'Uso de musculatura acessória'], ['assincronia', 'Assincronia com o ventilador']) },
          { nome: 'ausculta', rotulo: 'Ausculta pulmonar', tipo: 'marcar',
            opcoes: op(['mv_presentes', 'MV presentes'], ['mv_diminuidos', 'MV diminuídos'], ['mv_abolidos', 'MV abolidos'], ['roncos', 'Roncos'], ['sibilos', 'Sibilos'], ['estertores', 'Estertores crepitantes']),
            excludentes: [['mv_presentes', 'mv_diminuidos'], ['mv_presentes', 'mv_abolidos']] },
          { nome: 'mvDiminuidosLocal', rotulo: 'MV diminuídos em', tipo: 'marcar', opcoes: CAMPOS_PULMONARES, exclusivos: ['difuso'], se: (d) => (d.ausculta || []).includes('mv_diminuidos') },
          { nome: 'mvAbolidosLocal', rotulo: 'MV abolidos em', tipo: 'marcar', opcoes: CAMPOS_PULMONARES, exclusivos: ['difuso'], se: (d) => (d.ausculta || []).includes('mv_abolidos') },
          { nome: 'secrecao', rotulo: 'Secreção — quantidade', tipo: 'escolha', opcoes: op(['ausente', 'Ausente'], ['pequena', 'Pequena'], ['moderada', 'Moderada'], ['grande', 'Grande']) },
          { nome: 'secrecaoAspecto', rotulo: 'Secreção — aspecto', tipo: 'texto', se: (d) => d.secrecao && d.secrecao !== 'ausente' },
        ],
      },
      {
        id: 'hemodinamica', titulo: 'Cardiovascular e hemodinâmica', copiavel: true,
        campos: [
          { nome: 'ritmo', rotulo: 'Ritmo', tipo: 'escolha', opcoes: op(['sinusal', 'Sinusal'], ['fibrilacao', 'Fibrilação atrial'], ['marcapasso', 'Marca-passo'], ['outro', 'Outro']) },
          { nome: 'ritmoOutro', rotulo: 'Qual ritmo', tipo: 'texto', se: (d) => d.ritmo === 'outro' },
          { nome: 'auscultaCardiaca', rotulo: 'Ausculta cardíaca', tipo: 'marcar',
            opcoes: op(['bnf2t', 'BNF em 2T'], ['hipofoneticas', 'Bulhas hipofonéticas'], ['arritmicas', 'Bulhas arrítmicas'], ['sopro', 'Sopro'], ['acessorias', 'Bulhas acessórias']),
            excludentes: [['bnf2t', 'hipofoneticas']] },
          { nome: 'tec', rotulo: 'TEC', tipo: 'escolha', opcoes: op(['ate3', 'Até 3 s'], ['mais3', 'Mais de 3 s']), info: 'tec' },
          { nome: 'pulsos', rotulo: 'Pulsos periféricos', tipo: 'escolha', opcoes: op(['presentes', 'Presentes e cheios'], ['finos', 'Finos'], ['ausentes', 'Ausentes']) },
          { nome: 'extremidades', rotulo: 'Extremidades', tipo: 'escolha', opcoes: op(['aquecidas', 'Aquecidas'], ['frias', 'Frias'], ['cianoticas', 'Cianóticas']) },
          { nome: 'edemaLocais', rotulo: 'Edema', tipo: 'marcar',
            opcoes: op(['sem', 'Sem edema'], ['mmii', 'MMII'], ['mmss', 'MMSS'], ['sacral', 'Sacral'], ['facial', 'Facial'], ['anasarca', 'Anasarca']), exclusivos: ['sem'] },
          { nome: 'edemaGrau', rotulo: 'Grau do edema (cacifo)', tipo: 'escolha', opcoes: op(['1', '+1'], ['2', '+2'], ['3', '+3'], ['4', '+4'], ['na', 'Não se aplica']), se: temEdema, info: 'edema' },
        ],
      },
      {
        id: 'abdome', titulo: 'Abdome', copiavel: true,
        campos: [
          { nome: 'exame', rotulo: 'Inspeção, palpação e percussão', tipo: 'marcar',
            opcoes: op(['plano', 'Plano'], ['globoso', 'Globoso'], ['escavado', 'Escavado'], ['distendido', 'Distendido'], ['flacido', 'Flácido'], ['tenso', 'Tenso / rígido'],
              ['doloroso', 'Doloroso à palpação'], ['indolor', 'Indolor à palpação'], ['timpanico', 'Timpânico'], ['macico', 'Maciço']),
            excludentes: [['plano', 'globoso', 'escavado'], ['flacido', 'tenso'], ['doloroso', 'indolor'], ['timpanico', 'macico']] },
          { nome: 'rha', rotulo: 'Ruídos hidroaéreos (RHA)', tipo: 'escolha', opcoes: op(['presentes', 'Presentes'], ['aumentados', 'Aumentados'], ['diminuidos', 'Diminuídos'], ['ausentes', 'Ausentes']) },
          { nome: 'ascite', rotulo: 'Ascite', tipo: 'escolha', opcoes: op(['nao', 'Sem ascite'], ['sim', 'Com ascite']) },
          { nome: 'observacao', rotulo: 'Outros achados', tipo: 'texto' },
        ],
      },
      {
        id: 'infusoes', titulo: 'Infusões contínuas (controle de infusão)', copiavel: true,
        descricao: 'Marque o medicamento e informe a vazão. Nomes pelo princípio ativo; para outro medicamento, use o botão "+ Outra" do grupo.',
        campos: [
          { nome: 'itens', rotulo: 'Infusões em uso', tipo: 'infusoes', grupos: GRUPOS_INFUSAO, texto: (v) => textoInfusoes(v) },
        ],
      },
      {
        id: 'renal', titulo: 'Renal e eliminação urinária', copiavel: true,
        campos: [
          { nome: 'modo', rotulo: 'Eliminação urinária', tipo: 'escolha', opcoes: op(['espontanea', 'Espontânea'], ['cvd', 'CVD'], ['cva', 'CVA'], ['fralda', 'Fralda'], ['urostomia', 'Urostomia'], ['nefrostomia', 'Nefrostomia'], ['anuria', 'Anúria']) },
          { nome: 'volume', rotulo: 'Volume no período', tipo: 'numero', unidade: 'mL', se: (d) => !d.irrigacao || d.irrigacao === 'nao' },
          { nome: 'horas', rotulo: 'Período', tipo: 'numero', unidade: 'h' },
          { nome: 'peso', rotulo: 'Peso', tipo: 'numero', unidade: 'kg', ajuda: 'Opcional: usado para o débito urinário em mL/kg/h.' },
          { nome: 'aspecto', rotulo: 'Aspecto', tipo: 'texto' },
          { nome: 'irrigacao', rotulo: 'Irrigação vesical', tipo: 'escolha', opcoes: simNao },
          { nome: 'infundido', rotulo: 'Volume infundido (irrigação)', tipo: 'numero', unidade: 'mL', se: (d) => d.irrigacao === 'sim' },
          { nome: 'drenado', rotulo: 'Volume drenado total', tipo: 'numero', unidade: 'mL', se: (d) => d.irrigacao === 'sim' },
          { nome: 'diureseReal', rotulo: 'Diurese real', tipo: 'calculado', se: (d) => d.irrigacao === 'sim', calc: (d) => { const v = diureseReal(d.drenado, d.infundido); return v == null ? '' : `${v} mL (drenado − infundido)`; } },
          { nome: 'debito', rotulo: 'Débito urinário', tipo: 'calculado', calc: (d, ctx) => { const vol = d.irrigacao === 'sim' ? diureseReal(d.drenado, d.infundido) : num(d.volume); const v = debitoUrinario(vol, ctx.peso, d.horas); return v == null ? '' : `${fmt(v, 2)} mL/kg/h`; } },
          { nome: 'terapiaRenal', rotulo: 'Terapia renal substitutiva', tipo: 'escolha', opcoes: op(['nao', 'Não'], ['hemodialise', 'Hemodiálise'], ['continua', 'Terapia contínua']) },
          { nome: 'hdUf', rotulo: 'Hemodiálise — ultrafiltração (UF)', tipo: 'numero', unidade: 'mL', se: (d) => d.terapiaRenal === 'hemodialise' },
          { nome: 'hdDuracao', rotulo: 'Hemodiálise — duração', tipo: 'numero', unidade: 'h', se: (d) => d.terapiaRenal === 'hemodialise' },
          { nome: 'hdHeparina', rotulo: 'Hemodiálise — heparina', tipo: 'escolha', opcoes: op(['com', 'Com heparina'], ['sem', 'Sem heparina']), se: (d) => d.terapiaRenal === 'hemodialise' },
          { nome: 'hdIntercorrencias', rotulo: 'Hemodiálise — intercorrências', tipo: 'texto', se: (d) => d.terapiaRenal === 'hemodialise' },
        ],
      },
      {
        id: 'gi', titulo: 'Gastrintestinal e nutrição', copiavel: true,
        campos: [
          { nome: 'via', rotulo: 'Dieta — via', tipo: 'multipla', opcoes: op(['jejum', 'Jejum'], ['vo', 'VO'], ['sne', 'SNE'], ['soe', 'SOE'], ['sng', 'SNG'], ['gtm', 'GTM'], ['npt', 'NPT']) },
          { nome: 'jejumMotivo', rotulo: 'Motivo do jejum', tipo: 'texto', se: (d) => (d.via || []).includes('jejum') },
          { nome: 'dieta', rotulo: 'Tipo de dieta e vazão', tipo: 'texto', se: (d) => (d.via || []).some((v) => v !== 'jejum') },
          { nome: 'pausas', rotulo: 'Pausas e motivo', tipo: 'texto', se: (d) => (d.via || []).some((v) => ['sne', 'soe', 'sng', 'gtm'].includes(v)) },
          { nome: 'nausea', rotulo: 'Náusea / vômito', tipo: 'escolha', opcoes: op(['nao', 'Não'], ['nausea', 'Náusea'], ['vomito', 'Vômito']) },
          { nome: 'evacuou', rotulo: 'Evacuou nas últimas 24 horas?', tipo: 'escolha', opcoes: simNao },
          { nome: 'ultimaEvacuacao', rotulo: 'Última evacuação registrada', tipo: 'calculado', se: (d) => d.evacuou !== 'sim',
            calc: (d, ctx) => (ctx.ultimaEvacuacao ? `${formatarData(ctx.ultimaEvacuacao)} (há ${diasEntre(ctx.ultimaEvacuacao, ctx.dataTurno)} dia(s))` : 'sem registro anterior no sistema') },
          { nome: 'episodios', rotulo: 'Número de episódios', tipo: 'numero', se: (d) => d.evacuou === 'sim' },
          { nome: 'bristol', rotulo: 'Consistência (escala de Bristol)', tipo: 'escala', opcoes: BRISTOL, se: (d) => d.evacuou === 'sim', info: 'bristol' },
          { nome: 'fezesAspecto', rotulo: 'Aspecto das fezes', tipo: 'marcar', se: (d) => d.evacuou === 'sim',
            opcoes: op(['habitual', 'Coloração habitual'], ['melena', 'Melena'], ['sangue', 'Com sangue vivo'], ['acolica', 'Acólica'], ['muco', 'Com muco'], ['restos', 'Com restos alimentares']),
            excludentes: [['habitual', 'melena', 'acolica']] },
          {
            nome: 'estomias', rotulo: 'Estomias', tipo: 'lista', rotuloItem: 'estomia',
            tituloItem: (i) => ({ colostomia: 'Colostomia', ileostomia: 'Ileostomia', jejunostomia: 'Jejunostomia', gastrostomia: 'Gastrostomia', outra: 'Outra estomia' })[i.tipo] || '',
            textoItem: (i) => [({ colostomia: 'colostomia', ileostomia: 'ileostomia', jejunostomia: 'jejunostomia', gastrostomia: 'gastrostomia' })[i.tipo] || i.outra || 'estomia',
              i.estoma && `estoma ${i.estoma}`, i.efluente && `efluente ${i.efluente}`, i.volume && `${String(i.volume).replace('.', ',')} mL`].filter(Boolean).join(', '),
            campos: [
              { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: op(['colostomia', 'Colostomia'], ['ileostomia', 'Ileostomia'], ['jejunostomia', 'Jejunostomia'], ['gastrostomia', 'Gastrostomia'], ['outra', 'Outra']) },
              { nome: 'outra', rotulo: 'Qual', tipo: 'texto', se: (i) => i.tipo === 'outra' },
              { nome: 'estoma', rotulo: 'Aspecto do estoma', tipo: 'texto', sugestoes: () => ['vermelho vivo, úmido', 'edemaciado', 'pálido', 'arroxeado', 'com sangramento'] },
              { nome: 'efluente', rotulo: 'Aspecto do efluente', tipo: 'texto' },
              { nome: 'volume', rotulo: 'Volume no período', tipo: 'numero', unidade: 'mL' },
            ],
          },
        ],
      },
      {
        id: 'pele', titulo: 'Pele, lesões e LPP', copiavel: true, herdavel: true,
        descricao: 'Braden e Morse não são registrados aqui: são preenchidos e acompanhados no PEP oficial.',
        campos: [
          { nome: 'inspecao', rotulo: 'Inspeção da pele', tipo: 'marcar',
            opcoes: op(['normocorada', 'Normocorada'], ['hipocorada', 'Hipocorada'], ['acianotica', 'Acianótica'], ['cianotica', 'Cianótica'], ['anicterica', 'Anictérica'], ['icterica', 'Ictérica'],
              ['hidratada', 'Hidratada'], ['desidratada', 'Desidratada'], ['integra', 'Íntegra'], ['nao_integra', 'Não íntegra']),
            excludentes: [['normocorada', 'hipocorada'], ['acianotica', 'cianotica'], ['anicterica', 'icterica'], ['hidratada', 'desidratada'], ['integra', 'nao_integra']] },
          { nome: 'mucosas', rotulo: 'Mucosas', tipo: 'escolha', opcoes: op(['integras', 'Íntegras'], ['ressecadas', 'Ressecadas'], ['mucosite', 'Com mucosite']) },
          {
            nome: 'lesoes', rotulo: 'Lesões e curativos', tipo: 'lista', rotuloItem: 'lesão',
            tituloItem: (i) => [({ lpp: 'LPP', cirurgica: 'Incisão cirúrgica', oncologica: 'Lesão oncológica', dermatite: 'Dermatite associada à incontinência', friccao: 'Lesão por fricção', outra: 'Outra lesão' })[i.tipo], i.local].filter(Boolean).join(' — '),
            campos: [
              { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: op(['lpp', 'LPP'], ['cirurgica', 'Incisão cirúrgica'], ['oncologica', 'Lesão oncológica'], ['dermatite', 'Dermatite associada à incontinência'], ['friccao', 'Lesão por fricção'], ['outra', 'Outra']) },
              { nome: 'local', rotulo: 'Local', tipo: 'texto', sugestoes: () => ['sacral', 'calcâneo direito', 'calcâneo esquerdo', 'trocânter direito', 'trocânter esquerdo', 'occipital', 'orelha direita', 'orelha esquerda', 'glúteo'] },
              { nome: 'estagio', rotulo: 'Estágio (LPP)', tipo: 'select', se: (i) => i.tipo === 'lpp',
                opcoes: op(['1', 'Estágio 1'], ['2', 'Estágio 2'], ['3', 'Estágio 3'], ['4', 'Estágio 4'], ['nc', 'Não classificável'], ['tp', 'Lesão tissular profunda'], ['dispositivo', 'Relacionada a dispositivo médico'], ['mucosa', 'Em membrana mucosa']) },
              { nome: 'medidas', rotulo: 'Medidas (cm)', tipo: 'texto' },
              { nome: 'leito', rotulo: 'Leito da lesão e exsudato', tipo: 'texto' },
              { nome: 'cobertura', rotulo: 'Cobertura', tipo: 'texto' },
              { nome: 'troca', rotulo: 'Data da troca', tipo: 'data' },
              { nome: 'evolucao', rotulo: 'Evolução', tipo: 'escolha', opcoes: op(['melhora', 'Melhora'], ['estavel', 'Estável'], ['piora', 'Piora']) },
            ],
          },
        ],
      },
      {
        id: 'dispositivos', titulo: 'Dispositivos', copiavel: true, herdavel: true,
        descricao: 'Os dispositivos ativos passam para o dia seguinte; a avaliação do sítio e da necessidade recomeça a cada dia. Drenos também ficam aqui.',
        aoHerdar: (d) => ({ ...d, itens: dispositivosParaNovoDia(d.itens) }),
        campos: [
          { nome: 'itens', rotulo: 'Dispositivos em uso', tipo: 'dispositivos', texto: (v, ctx) => textoDispositivos(v, ctx.dataTurno) },
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
        id: 'antimicrobianos', titulo: 'Antimicrobianos e culturas', copiavel: true, herdavel: true,
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
      // Antes eram o bloco 6 (aba própria); agora fecham a avaliação, na mesma aba.
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
        // Mesmo id de antes (dados já salvos continuam valendo); no papel, vai para OCORRÊNCIAS.
        id: 'pendencias', titulo: 'Ocorrências', copiavel: false,
        descricao: 'Uma ocorrência por linha (exames, pareceres, avisos à equipe). As abertas saem no campo OCORRÊNCIAS da folha impressa; marque "Resolvida" para tirar do papel.',
        campos: [
          { nome: 'itens', rotulo: 'Ocorrências', tipo: 'lista', rotuloItem: 'ocorrência',
            textoItem: (i) => [i.descricao, i.situacao === 'resolvida' ? 'resolvida' : 'aberta'].filter(Boolean).join(', '),
            campos: [
              { nome: 'descricao', rotulo: 'Ocorrência', tipo: 'area', linhas: 3, placeholder: 'Ex.: 13/10 - Parecer da nefrologia (ok)' },
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
  const disp = (dados.dispositivos?.itens || []).filter(dispositivoAtivo);
  const sup = dados.respiratorio?.suporte;
  return {
    dataTurno,
    peso: num(dados.renal?.peso),
    ventilado: ['vmi_tot', 'vmi_tqt'].includes(sup) || disp.some((i) => i.tipo === 'tot' || i.tipo === 'tqt'),
    temCvd: dados.renal?.modo === 'cvd' || disp.some((i) => i.tipo === 'cvd'),
    temCvc: disp.some((i) => ['cvc', 'picc', 'cti', 'cateter_dialise'].includes(i.tipo)),
    // Data da última evacuação registrada nas evoluções anteriores (vem ao abrir o dia).
    ultimaEvacuacao: dados.herdado?.ultimaEvacuacao || '',
  };
}

/** Campo visível? (aplica a condição `se`). */
export const visivel = (campo, dados, ctx) => !campo.se || !!campo.se(dados || {}, ctx);
