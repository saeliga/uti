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
export function camIcu({ rass, agudo, desatencao, desorganizado } = {}) {
  if (!camAplicavel(rass)) return { aplicavel: false, resultado: 'nao_aplicavel' };
  if (agudo === 'nao' || desatencao === 'nao') return { aplicavel: true, resultado: 'negativo' };
  if (!agudo || !desatencao) return { aplicavel: true, resultado: '' };
  const nivel = Number(rass) !== 0;
  if (nivel || desorganizado === 'sim') return { aplicavel: true, resultado: 'positivo' };
  if (desorganizado === 'nao') return { aplicavel: true, resultado: 'negativo' };
  return { aplicavel: true, resultado: '' };
}

// --------------------------------------------------------------------------- Braden
export const BRADEN = {
  percepcao: { 1: 'Totalmente limitada', 2: 'Muito limitada', 3: 'Levemente limitada', 4: 'Nenhuma limitação' },
  umidade: { 1: 'Completamente molhada', 2: 'Muito molhada', 3: 'Ocasionalmente molhada', 4: 'Raramente molhada' },
  atividade: { 1: 'Acamado', 2: 'Confinado à cadeira', 3: 'Anda ocasionalmente', 4: 'Anda frequentemente' },
  mobilidade: { 1: 'Totalmente imóvel', 2: 'Bastante limitada', 3: 'Levemente limitada', 4: 'Não apresenta limitações' },
  nutricao: { 1: 'Muito pobre', 2: 'Provavelmente inadequada', 3: 'Adequada', 4: 'Excelente' },
  friccao: { 1: 'Problema', 2: 'Problema em potencial', 3: 'Nenhum problema' },
};
export function braden(sub = {}) {
  const chaves = Object.keys(BRADEN);
  if (!chaves.every((k) => Number(sub[k]))) return { total: null, risco: '', completo: false };
  const total = chaves.reduce((s, k) => s + Number(sub[k]), 0);
  const risco = total <= 9 ? 'Risco muito alto' : total <= 12 ? 'Risco alto' : total <= 14 ? 'Risco moderado' : total <= 18 ? 'Risco baixo' : 'Sem risco';
  return { total, risco, completo: true };
}

// --------------------------------------------------------------------------- Morse
export const MORSE = {
  historico: { 0: 'Não', 25: 'Sim' },
  diagnosticoSecundario: { 0: 'Não', 15: 'Sim' },
  auxilio: { 0: 'Nenhum / acamado / auxiliado pela enfermagem', 15: 'Muletas, bengala ou andador', 30: 'Apoia-se no mobiliário' },
  terapiaVenosa: { 0: 'Não', 20: 'Sim' },
  marcha: { 0: 'Normal / acamado / cadeira de rodas', 10: 'Fraca', 20: 'Comprometida / cambaleante' },
  estadoMental: { 0: 'Orientado / reconhece a própria capacidade', 15: 'Superestima a capacidade / esquece limitações' },
};
export function morse(sub = {}) {
  const chaves = Object.keys(MORSE);
  if (!chaves.every((k) => sub[k] !== undefined && sub[k] !== '')) return { total: null, risco: '', completo: false };
  const total = chaves.reduce((s, k) => s + Number(sub[k]), 0);
  const risco = total >= 45 ? 'Risco alto' : total >= 25 ? 'Risco moderado' : 'Risco baixo';
  return { total, risco, completo: true };
}

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
