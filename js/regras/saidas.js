// Desfazer uma saída da UTI registrada por engano (alta, transferência ou óbito indevidos).
// Regra: enfermeiro da unidade em até 24 h depois do registro; administrador a qualquer
// momento. O paciente volta para um leito livre da mesma UTI (de preferência o mesmo),
// com motivo obrigatório. Nada é apagado: a saída desfeita fica no histórico da internação.

export const PRAZO_DESFAZER_HORAS = 24;
export const MOTIVO_MIN = 10;
export const MOTIVO_MAX = 500;

/** Milissegundos de um Timestamp do Firestore, Date, número ou texto ISO. */
export function msTempo(t) {
  if (t == null) return NaN;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (t instanceof Date) return t.getTime();
  if (typeof t === 'number') return t;
  if (typeof t.seconds === 'number') return t.seconds * 1000;
  return Date.parse(t);
}

/** A saída ainda pode ser desfeita? (administrador não tem prazo) */
export function podeDesfazerSaida(registradoEm, { admin = false, agora = Date.now() } = {}) {
  if (admin) return true;
  const ms = msTempo(registradoEm);
  return Number.isFinite(ms) && agora - ms < PRAZO_DESFAZER_HORAS * 3600 * 1000;
}

/** Quanto falta para acabar o prazo, em texto curto ("até 18/10 22:10"). */
export function limiteDesfazer(registradoEm) {
  const ms = msTempo(registradoEm);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms + PRAZO_DESFAZER_HORAS * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function validarReversao({ motivo, leitoId } = {}) {
  const e = {};
  const m = String(motivo || '').trim();
  if (m.length < MOTIVO_MIN) e.motivo = `Explique o motivo (mínimo de ${MOTIVO_MIN} letras).`;
  else if (m.length > MOTIVO_MAX) e.motivo = `Motivo muito longo (máximo de ${MOTIVO_MAX} letras).`;
  if (!leitoId) e.leitoId = 'Escolha o leito.';
  return e;
}

/**
 * Histórico de leitos depois de desfazer a saída: no mesmo leito, o último trecho volta a
 * ficar aberto (como se não tivesse saído); em outro leito, fecha o trecho na hora da
 * reversão e abre um novo.
 */
export function historicoAposReversao(hist = [], leitoId, unidade, quando) {
  const h = hist.map((x) => ({ ...x }));
  const ult = h[h.length - 1];
  if (ult && ult.leitoId === leitoId) { ult.ate = ''; return h; }
  if (ult) ult.ate = quando;
  h.push({ leitoId, unidade, de: quando, ate: '' });
  return h;
}

/** Leitos livres da unidade para voltar, com o leito de origem primeiro. */
export function leitosParaVoltar(leitos = [], unidade, leitoOrigem) {
  return leitos
    .filter((l) => l.unidade === unidade && !l.internacaoId && !l.bloqueado)
    .sort((a, b) => (a.id === leitoOrigem ? -1 : b.id === leitoOrigem ? 1 : String(a.numero).localeCompare(String(b.numero), 'pt', { numeric: true })));
}

/** Saídas recentes guardadas nos leitos (a última de cada leito), mais nova primeiro. */
export function saidasRecentes(leitos = [], opcoes = {}) {
  return leitos.filter((l) => l.ultimaSaida?.internacaoId && podeDesfazerSaida(l.ultimaSaida.registradoEm, opcoes))
    .map((l) => ({ ...l.ultimaSaida, leitoId: l.id, leitoNumero: l.numero, leitoLivre: !l.internacaoId && !l.bloqueado }))
    .sort((a, b) => (msTempo(b.registradoEm) || 0) - (msTempo(a.registradoEm) || 0));
}
