// Cálculos e checagens de faixa. Funções puras (testáveis no Node).
// Os limites de alerta são PROVISÓRIOS até a equipe da UTI definir os oficiais.

const num = (v) => (v === '' || v == null || Number.isNaN(Number(String(v).replace(',', '.'))) ? null : Number(String(v).replace(',', '.')));
export { num };

export function pam(pas, pad) {
  const s = num(pas), d = num(pad);
  if (s == null || d == null) return null;
  return Math.round((s + 2 * d) / 3);
}

// Faixa plausível (fora dela = provável erro de digitação → pedir confirmação)
// e faixa de alerta (valor crítico → destacar com rótulo).
export const SINAIS = {
  t: { rotulo: 'Temperatura', unidade: '°C', plausivel: [30, 43], alerta: (v) => v >= 38.5 || v < 35 },
  fc: { rotulo: 'FC', unidade: 'bpm', plausivel: [20, 250], alerta: (v) => v < 50 || v > 130 },
  fr: { rotulo: 'Frequência respiratória', unidade: 'irpm', plausivel: [4, 70], alerta: (v) => v < 8 || v > 30 },
  pas: { rotulo: 'Pressão sistólica', unidade: 'mmHg', plausivel: [40, 260], alerta: (v) => v < 90 || v > 180 },
  pad: { rotulo: 'Pressão diastólica', unidade: 'mmHg', plausivel: [20, 160], alerta: (v) => v > 110 },
  pam: { rotulo: 'PAM', unidade: 'mmHg', plausivel: [30, 200], alerta: (v) => v < 65 },
  spo2: { rotulo: 'SpO2', unidade: '%', plausivel: [50, 100], alerta: (v) => v < 90 },
  hgt: { rotulo: 'HGT', unidade: 'mg/dL', plausivel: [15, 700], alerta: (v) => v < 70 || v > 250 },
};

/** 'implausivel' | 'alerta' | 'ok' | '' (vazio). */
export function checarSinal(chave, valor) {
  const v = num(valor);
  const s = SINAIS[chave];
  if (v == null || !s) return '';
  if (v < s.plausivel[0] || v > s.plausivel[1]) return 'implausivel';
  return s.alerta(v) ? 'alerta' : 'ok';
}

/** Irrigação vesical: diurese real = drenado − infundido (nunca negativa). */
export function diureseReal(drenado, infundido) {
  const d = num(drenado), i = num(infundido) ?? 0;
  if (d == null) return null;
  return Math.max(0, d - i);
}

/** Débito urinário em mL/kg/h. */
export function debitoUrinario(volume, pesoKg, horas) {
  const v = num(volume), p = num(pesoKg), h = num(horas);
  if (v == null || !p || !h) return null;
  return Math.round((v / p / h) * 100) / 100;
}

// --------------------------------------------------------------------------- infusões
export const FINALIDADES = {
  analgesia: 'Analgesia',
  sedacao: 'Sedação',
  bloqueio: 'Bloqueio neuromuscular',
  vasopressor: 'Vasopressor',
  inotropico: 'Inotrópico',
  vasodilatador: 'Vasodilatador',
  antiarritmico: 'Antiarrítmico',
  insulina: 'Insulina',
  hidratacao: 'Hidratação e eletrólitos',
  outra: 'Outra',
};

// Sugestões por finalidade (nome genérico → unidade de dose usual). Lista
// provisória até a farmácia/CCIH da Liga enviar a padronização oficial.
export const MEDICAMENTOS = {
  analgesia: { fentanil: 'mcg/h', morfina: 'mg/h', remifentanil: 'mcg/kg/min', cetamina: 'mg/kg/h' },
  sedacao: { midazolam: 'mg/h', propofol: 'mg/kg/h', dexmedetomidina: 'mcg/kg/h', cetamina: 'mg/kg/h' },
  bloqueio: { cisatracúrio: 'mcg/kg/min', atracúrio: 'mcg/kg/min', rocurônio: 'mcg/kg/min' },
  vasopressor: { noradrenalina: 'mcg/kg/min', vasopressina: 'UI/min', adrenalina: 'mcg/kg/min', dopamina: 'mcg/kg/min' },
  inotropico: { dobutamina: 'mcg/kg/min', milrinona: 'mcg/kg/min' },
  vasodilatador: { nitroprussiato: 'mcg/kg/min', nitroglicerina: 'mcg/min' },
  antiarritmico: { amiodarona: 'mg/h' },
  insulina: { 'insulina regular': 'UI/h' },
  hidratacao: {},
  outra: {},
};
export const UNIDADES_DOSE = ['mcg/kg/min', 'mcg/min', 'mcg/kg/h', 'mcg/h', 'mg/kg/h', 'mg/h', 'UI/min', 'UI/h', 'UI/kg/h'];

const PARA_MCG = { mg: 1000, mcg: 1, g: 1e6 };

/**
 * Dose a partir de concentração (quantidade em volume), vazão e peso.
 * quantidade: número na unidadeQtd (mg, mcg, g ou UI); volume em mL; vazão em mL/h.
 * Devolve número arredondado ou null (dados insuficientes ou unidades incompatíveis).
 */
export function doseInfusao({ quantidade, unidadeQtd, volume, vazao, peso, unidadeDose }) {
  const q = num(quantidade), vol = num(volume), vz = num(vazao), p = num(peso);
  if (q == null || !vol || vz == null || !unidadeDose || !unidadeQtd) return null;
  const porKg = unidadeDose.includes('/kg/');
  if (porKg && !p) return null;
  const ehUI = unidadeQtd === 'UI';
  if (ehUI !== unidadeDose.startsWith('UI')) return null;
  // quantidade por hora na unidade base (mcg ou UI)
  const base = ehUI ? q : q * PARA_MCG[unidadeQtd];
  if (base == null || Number.isNaN(base)) return null;
  let porHora = (base / vol) * vz;
  const [alvo] = unidadeDose.split('/');
  if (!ehUI) porHora /= PARA_MCG[alvo]; // mcg → mg, se preciso
  let dose = porKg ? porHora / p : porHora;
  if (unidadeDose.endsWith('/min')) dose /= 60;
  return Math.round(dose * 1000) / 1000;
}
