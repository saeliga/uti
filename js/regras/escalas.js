// Escalas clínicas: opções e cálculo. Funções puras (testáveis no Node).
// O escore é sempre calculado a partir das subescalas, e a classificação
// deriva do escore: não existe campo de classificação para preencher à mão.

// --------------------------------------------------------------------------- Glasgow
export const GLASGOW = {
  ocular: { 4: 'Espontânea', 3: 'Ao som', 2: 'À pressão', 1: 'Ausente' },
  verbal: { 5: 'Orientada', 4: 'Confusa', 3: 'Palavras', 2: 'Sons', 1: 'Ausente', T: 'Não testável (intubado/traqueostomizado)' },
  motora: { 6: 'Obedece a comandos', 5: 'Localiza', 4: 'Flexão normal', 3: 'Flexão anormal', 2: 'Extensão', 1: 'Ausente' },
};

/** { total, texto, completo }. Verbal "T": soma ocular + motora e exibe com "T" (ex.: 9T). */
export function glasgow({ ocular, verbal, motora } = {}) {
  const o = Number(ocular), m = Number(motora);
  if (!o || !m || !verbal) return { total: null, texto: '', completo: false };
  if (verbal === 'T') return { total: o + m, texto: `${o + m}T`, completo: true, intubado: true };
  const v = Number(verbal);
  return { total: o + v + m, texto: String(o + v + m), completo: true, intubado: false };
}

// --------------------------------------------------------------------------- RASS
export const RASS = {
  '4': '+4 Combativo', '3': '+3 Muito agitado', '2': '+2 Agitado', '1': '+1 Inquieto', '0': '0 Alerta e calmo',
  '-1': '−1 Sonolento', '-2': '−2 Sedação leve', '-3': '−3 Sedação moderada', '-4': '−4 Sedação profunda', '-5': '−5 Não despertável',
};
export const camAplicavel = (rass) => rass !== '' && rass != null && Number(rass) >= -3;

/**
 * Rastreio de delirium (método CAM-ICU). Positivo quando há (1) início agudo ou
 * curso flutuante E (2) desatenção E [(3) nível de consciência alterado (RASS ≠ 0)
 * OU (4) pensamento desorganizado]. Só se aplica com RASS ≥ −3.
 */
export function camIcu({ rass, agudo, desatencao, desorganizado, aplicavel, nivelAlterado } = {}) {
  // Sem sedação, o RASS não é registrado: quem informa aplicabilidade e o nível
  // de consciência (critério 3) é o campo "Nível de consciência".
  if (!(aplicavel ?? camAplicavel(rass))) return { aplicavel: false, resultado: 'nao_aplicavel' };
  if (agudo === 'nao' || desatencao === 'nao') return { aplicavel: true, resultado: 'negativo' };
  if (!agudo || !desatencao) return { aplicavel: true, resultado: '' };
  const nivel = nivelAlterado ?? Number(rass) !== 0;
  if (nivel || desorganizado === 'sim') return { aplicavel: true, resultado: 'positivo' };
  if (desorganizado === 'nao') return { aplicavel: true, resultado: 'negativo' };
  return { aplicavel: true, resultado: '' };
}

// Braden e Morse ficam fora do sistema: são preenchidas e acompanhadas no PEP oficial.

// --------------------------------------------------------------------------- Dor
export const BPS = {
  facial: { 1: 'Relaxada', 2: 'Parcialmente contraída', 3: 'Totalmente contraída', 4: 'Careta' },
  membros: { 1: 'Sem movimento', 2: 'Parcialmente fletidos', 3: 'Totalmente fletidos', 4: 'Permanentemente retraídos' },
  ventilacao: { 1: 'Tolera', 2: 'Tosse, mas tolera na maior parte do tempo', 3: 'Briga com o ventilador', 4: 'Impossível manter a ventilação' },
};
export function bps(sub = {}) {
  const chaves = Object.keys(BPS);
  if (!chaves.every((k) => Number(sub[k]))) return { total: null, classe: '', completo: false };
  const total = chaves.reduce((s, k) => s + Number(sub[k]), 0);
  return { total, classe: total <= 3 ? 'Sem dor' : total <= 5 ? 'Dor aceitável' : 'Dor inaceitável', completo: true, comDor: total > 5 };
}
export function evn(valor) {
  if (valor === '' || valor == null || Number.isNaN(Number(valor))) return { total: null, classe: '', completo: false };
  const v = Number(valor);
  return { total: v, classe: v === 0 ? 'Sem dor' : v <= 3 ? 'Dor leve' : v <= 6 ? 'Dor moderada' : 'Dor intensa', completo: true, comDor: v >= 4 };
}

/** Resultado da dor conforme a escala escolhida (EVN/EVA ou BPS). */
export function dor(d = {}) {
  if (d.escala === 'bps') return { escala: 'BPS', ...bps(d.bps || {}) };
  if (d.escala === 'evn' || d.escala === 'eva') return { escala: d.escala.toUpperCase(), ...evn(d.escore) };
  if (d.escala === 'nao_avaliavel') return { escala: '', total: null, classe: 'Não avaliável', completo: true, comDor: false };
  return { escala: '', total: null, classe: '', completo: false };
}
