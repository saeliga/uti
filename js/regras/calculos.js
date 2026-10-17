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
