// Turnos da UTI. Padrão provisório (questão em aberto na especificação):
// uma evolução por turno — manhã 07–13, tarde 13–19, noite 19–07.
// O turno da noite pertence à data em que começou (ex.: noite de 16/10 vai até 07h de 17/10).

import { hojeISO, somarDias, formatarData } from './datas.js';

export const TURNOS = {
  M: { nome: 'Manhã', inicio: 7, fim: 13 },
  T: { nome: 'Tarde', inicio: 13, fim: 19 },
  N: { nome: 'Noite', inicio: 19, fim: 7 },
};
const ORDEM = ['M', 'T', 'N'];

/** { data: 'AAAA-MM-DD', turno: 'M'|'T'|'N' } do momento informado. */
export function turnoDe(momento = new Date()) {
  const h = momento.getHours();
  if (h >= 7 && h < 13) return { data: hojeISO(momento), turno: 'M' };
  if (h >= 13 && h < 19) return { data: hojeISO(momento), turno: 'T' };
  const data = h < 7 ? somarDias(hojeISO(momento), -1) : hojeISO(momento);
  return { data, turno: 'N' };
}

export function turnoAnterior({ data, turno }) {
  const i = ORDEM.indexOf(turno);
  return i > 0 ? { data, turno: ORDEM[i - 1] } : { data: somarDias(data, -1), turno: 'N' };
}

export function rotuloTurno({ data, turno }) {
  return `${TURNOS[turno].nome} de ${formatarData(data)}`;
}

/** Identificador do documento: uma evolução por internação, data e turno. */
export const idEvolucao = (internacaoId, { data, turno }) => `${internacaoId}_${data}_${turno}`;
