// Funções puras de data. Sem dependência do navegador (testáveis no Node).
// Datas clínicas são guardadas como texto local: 'AAAA-MM-DD' ou
// 'AAAA-MM-DDTHH:MM' (fuso de Natal, sem horário de verão).

const p2 = (n) => String(n).padStart(2, '0');

export function hojeISO(ref = new Date()) {
  return `${ref.getFullYear()}-${p2(ref.getMonth() + 1)}-${p2(ref.getDate())}`;
}

export function agoraLocalISO(ref = new Date()) {
  return `${hojeISO(ref)}T${p2(ref.getHours())}:${p2(ref.getMinutes())}`;
}

export function somarDias(dataISO, n) {
  const [a, m, d] = dataISO.slice(0, 10).split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + n));
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`;
}

export function dataValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(texto)) return false;
  const [a, m, d] = texto.slice(0, 10).split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  if (t.getUTCFullYear() !== a || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return false;
  if (texto.length > 10) {
    const [h, mi] = texto.slice(11).split(':').map(Number);
    if (h > 23 || mi > 59) return false;
  }
  return true;
}

/** Diferença em dias de calendário entre duas datas (ignora a hora). */
export function diasEntre(inicioISO, refISO) {
  const u = (s) => {
    const [a, m, d] = s.slice(0, 10).split('-').map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((u(refISO) - u(inicioISO)) / 86400000);
}

/**
 * Contagem no padrão da folha de BH da Liga: "D" + (data de referência − data
 * de início). O dia da admissão é D0. Para imprimir a folha de amanhã, passe a
 * data de amanhã como referência.
 */
export function contagemDia(inicioISO, refISO) {
  if (!inicioISO || !refISO) return '';
  const n = diasEntre(inicioISO, refISO);
  return n >= 0 ? `D${n}` : '';
}

/** Idade em anos completos na data de referência. */
export function idade(nascISO, refISO) {
  if (!dataValida(nascISO) || !refISO) return null;
  const [a, m, d] = nascISO.split('-').map(Number);
  const [ra, rm, rd] = refISO.slice(0, 10).split('-').map(Number);
  let anos = ra - a;
  if (rm < m || (rm === m && rd < d)) anos -= 1;
  return anos;
}

export function formatarData(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function formatarDataHora(iso) {
  if (!iso) return '';
  return iso.length > 10 ? `${formatarData(iso)} ${iso.slice(11, 16)}` : formatarData(iso);
}

/** Compara textos 'AAAA-MM-DD[THH:MM]' (ordem lexicográfica = cronológica). */
export function antes(a, b) {
  const n = (s) => (s.length === 10 ? `${s}T00:00` : s);
  return n(a) < n(b);
}
