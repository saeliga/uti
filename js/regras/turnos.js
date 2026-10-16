// Dia assistencial e turnos da UTI.
// A evolução é UMA POR DIA por paciente (decidido pelo Tercio em 16/10/2026):
// qualquer turno pode fazê-la, e o que ficar pendente passa para o turno seguinte.
// O dia assistencial vai das 07h às 07h do dia seguinte (mesmo corte da folha
// de BH: controle das 07h às 06h). Ex.: 03h de 17/10 ainda pertence ao dia 16/10.

import { hojeISO, somarDias, formatarData } from './datas.js';

export const HORA_VIRADA = 7;

export const TURNOS = {
  M: { nome: 'Manhã', inicio: 7, fim: 13 },
  T: { nome: 'Tarde', inicio: 13, fim: 19 },
  N: { nome: 'Noite', inicio: 19, fim: 7 },
};

/** Data do dia assistencial do momento informado ('AAAA-MM-DD'). */
export function diaAssistencial(momento = new Date()) {
  const d = hojeISO(momento);
  return momento.getHours() < HORA_VIRADA ? somarDias(d, -1) : d;
}

/** Turno do momento (só informativo: registra em que turno a evolução foi feita). */
export function turnoDe(momento = new Date()) {
  const h = momento.getHours();
  return h >= 7 && h < 13 ? 'M' : h >= 13 && h < 19 ? 'T' : 'N';
}

export const diaAnterior = (data) => somarDias(data, -1);

export const rotuloDia = (data) => `Dia ${formatarData(data)}`;

/** Identificador do documento: uma evolução por internação e dia assistencial. */
export const idEvolucao = (internacaoId, data) => `${internacaoId}_${data}`;
