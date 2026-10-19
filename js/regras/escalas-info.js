// Guia rápido das escalas usadas na evolução (botão "i" ao lado do campo).
// Texto de apoio à beira-leito, com a referência original de cada escala.
// As opções e os pontos são os mesmos do formulário (escalas.js).

import { GLASGOW, RASS, BPS } from './escalas.js';
import { BRISTOL } from './evolucao-esquema.js';

const linhas = (obj, ordem) => (ordem || Object.keys(obj)).map((k) => [k, obj[k]]);

export const INFO_ESCALAS = {
  glasgow: {
    titulo: 'Escala de coma de Glasgow',
    resumo: 'Avalia o nível de consciência pelo melhor resultado em cada um dos três itens. Total de 3 a 15. Use em paciente sem sedação (sob sedação, use o RASS).',
    secoes: [
      { titulo: 'Abertura ocular', itens: linhas(GLASGOW.ocular, ['4', '3', '2', '1']) },
      { titulo: 'Resposta verbal', itens: linhas(GLASGOW.verbal, ['5', '4', '3', '2', '1', 'T']) },
      { titulo: 'Resposta motora', itens: linhas(GLASGOW.motora, ['6', '5', '4', '3', '2', '1']) },
    ],
    dicas: [
      'Estímulo à pressão: na ponta do dedo, no trapézio ou na incisura supraorbitária, por até 10 segundos.',
      'Paciente intubado ou traqueostomizado: verbal "T" (não testável). O total soma só ocular e motora e é mostrado com "T" (ex.: 9T).',
      'Total 13 a 15: leve; 9 a 12: moderado; 3 a 8: grave (considerar proteção de via aérea).',
    ],
    fonte: 'Teasdale G, Jennett B. Lancet. 1974;2(7872):81-4. Versão atual: glasgowcomascale.org.',
  },
  rass: {
    titulo: 'RASS — Richmond Agitation-Sedation Scale',
    resumo: 'Avalia agitação e sedação, de +4 (combativo) a −5 (não despertável). Compare com a meta de RASS prescrita.',
    secoes: [{ titulo: 'Pontuação', itens: linhas(RASS, ['4', '3', '2', '1', '0', '-1', '-2', '-3', '-4', '-5']).map(([k, t]) => [t.split(' ')[0], t.split(' ').slice(1).join(' ')]) }],
    dicas: [
      '1º observe o paciente por 30 segundos: calmo e alerta = 0; inquieto ou agitado = +1 a +4.',
      '2º se não estiver alerta, chame pelo nome e peça que abra os olhos e olhe para você: contato visual por mais de 10 s = −1; menos de 10 s = −2; algum movimento, sem contato visual = −3.',
      '3º sem resposta à voz, estímulo físico (sacudir o ombro, pressão no esterno): algum movimento = −4; nenhuma resposta = −5.',
      'RASS −4 ou −5: o rastreio de delirium (CAM-ICU) não se aplica.',
    ],
    fonte: 'Sessler CN et al. Am J Respir Crit Care Med. 2002;166(10):1338-44.',
  },
  cam: {
    titulo: 'CAM-ICU — rastreio de delirium',
    resumo: 'Aplicável com RASS de −3 a +4. Positivo quando há o critério 1 E o 2 E (o 3 OU o 4).',
    secoes: [{ titulo: 'Critérios', itens: [
      ['1', 'Início agudo ou curso flutuante: mudança do estado mental em relação ao basal, ou flutuação nas últimas 24 h (RASS, Glasgow).'],
      ['2', 'Desatenção: diga 10 letras (ex.: S A V E A H A A R T) e peça que aperte sua mão a cada "A". Mais de 2 erros = desatento.'],
      ['3', 'Nível de consciência alterado: RASS diferente de zero no momento da avaliação.'],
      ['4', 'Pensamento desorganizado: perguntas de sim/não (ex.: "uma pedra flutua na água?") e um comando de dois passos. Mais de 1 erro = desorganizado.'],
    ] }],
    dicas: ['O sistema calcula o resultado a partir das respostas: só registre o que avaliou.'],
    fonte: 'Ely EW et al. JAMA. 2001;286(21):2703-10.',
  },
  dor: {
    titulo: 'Escalas de dor',
    resumo: 'Use a EVN quando o paciente consegue comunicar; a BPS quando está sedado ou em ventilação mecânica e não comunica.',
    secoes: [
      { titulo: 'EVN — escala verbal numérica (0 a 10)', itens: [['0', 'Sem dor'], ['1 a 3', 'Dor leve'], ['4 a 6', 'Dor moderada'], ['7 a 10', 'Dor intensa']] },
      { titulo: 'BPS — expressão facial', itens: linhas(BPS.facial) },
      { titulo: 'BPS — membros superiores', itens: linhas(BPS.membros) },
      { titulo: 'BPS — adaptação à ventilação', itens: linhas(BPS.ventilacao) },
    ],
    dicas: [
      'EVN: pergunte "de 0 a 10, quanto está a sua dor agora?", sendo 0 nenhuma dor e 10 a pior dor imaginável.',
      'BPS: soma dos três itens, de 3 a 12. Até 3 = sem dor; 4 a 5 = dor aceitável; acima de 5 = dor inaceitável (intervir e reavaliar).',
      'Dor de 4 ou mais (EVN) ou BPS acima de 5: registre a conduta e a reavaliação.',
    ],
    fonte: 'BPS: Payen JF et al. Crit Care Med. 2001;29(12):2258-63. EVN: escala numérica de 11 pontos.',
  },
  bristol: {
    titulo: 'Escala de Bristol (consistência das fezes)',
    resumo: 'Classifica a forma das fezes em 7 tipos. Tipos 1 e 2 sugerem constipação; 3 e 4, normais; 5 a 7, fezes amolecidas a diarreicas.',
    secoes: [{ titulo: 'Tipos', itens: linhas(BRISTOL).map(([k, t]) => { const x = t.replace(/^Tipo \d+ — /, ''); return [k, x.charAt(0).toUpperCase() + x.slice(1)]; }) }],
    dicas: ['Paciente sem evacuação há 3 dias ou mais: comunique e avalie conduta (protocolo de constipação).'],
    fonte: 'Lewis SJ, Heaton KW. Scand J Gastroenterol. 1997;32(9):920-4.',
  },
  edema: {
    titulo: 'Grau do edema (sinal de cacifo)',
    resumo: 'Pressione o dedo por cerca de 5 segundos sobre uma superfície óssea (tíbia, maléolo, sacro) e observe a profundidade e o tempo para a pele voltar.',
    secoes: [{ titulo: 'Graduação usual', itens: [
      ['+1', 'Depressão leve (cerca de 2 mm), desaparece rapidamente'],
      ['+2', 'Depressão de cerca de 4 mm, desaparece em até 15 segundos'],
      ['+3', 'Depressão de cerca de 6 mm, pode durar mais de 1 minuto'],
      ['+4', 'Depressão profunda (cerca de 8 mm), dura 2 a 5 minutos'],
    ] }],
    dicas: ['As referências variam nos milímetros e tempos: o importante é usar sempre o mesmo critério na equipe e comparar com a evolução anterior.'],
    fonte: 'Graduação clínica de uso corrente em semiologia de enfermagem (ex.: Jarvis C. Exame físico e avaliação de saúde para enfermagem).',
  },
  tec: {
    titulo: 'Tempo de enchimento capilar (TEC)',
    resumo: 'Pressione o leito ungueal (ou a pele do esterno) por 5 segundos, solte e conte o tempo até a cor voltar.',
    secoes: [{ titulo: 'Interpretação', itens: [['Até 3 s', 'Normal'], ['Mais de 3 s', 'Perfusão periférica diminuída: relacione com pressão, extremidades, lactato e diurese']] }],
    dicas: ['Mão na altura do coração, ambiente aquecido. Frio, vasoconstritor e idade avançada aumentam o tempo.'],
    fonte: 'Hernández G et al. JAMA. 2019;321(7):654-64 (ANDROMEDA-SHOCK).',
  },
};
