// Prescrição de enfermagem: as atividades das intervenções (NIC) escolhidas no
// Processo de Enfermagem, com aprazamento, impressas no mesmo padrão da
// prescrição médica da Liga (24 colunas de horário, das 07 às 06).
// Funções puras (testáveis no Node).
//
// Aprazamento guardado em cada atividade: { freq, horarios: ['08','14',...], obsPrescricao }.

import { formatarData, idade as idadeEm, somarDias } from './datas.js';
import { camposIdentificacao } from './impressos.js';

/** Colunas de horário da folha, na ordem do plantão (igual à prescrição médica). */
export const HORAS = ['07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '00', '01', '02', '03', '04', '05', '06'];

export const FREQUENCIAS = {
  '01/01H': '01/01H', '02/02H': '02/02H', '03/03H': '03/03H', '04/04H': '04/04H', '06/06H': '06/06H',
  '08/08H': '08/08H', '12/12H': '12/12H', '24/24H': '24/24H',
  TURNO: '1X/TURNO', CONTINUO: 'CONTÍNUO', SN: 'SN', ACM: 'ACM',
};

/**
 * Horários padrão da frequência, no mesmo esquema da farmácia da Liga (o último
 * horário do dia é 06): 06/06H → 12 18 00 06; 08/08H → 14 22 06; 12/12H → 18 06.
 * 1X/TURNO → 08 14 20. Contínuo, SN e ACM não têm horário marcado.
 */
export function horariosPadrao(freq) {
  if (freq === 'TURNO') return ['08', '14', '20'];
  const m = /^(\d{2})\/\d{2}H$/.exec(freq || '');
  if (!m) return [];
  const passo = Number(m[1]);
  const horas = [];
  for (let h = 6; horas.length < 24 / passo; h = (h - passo + 24) % 24) horas.push(String(h).padStart(2, '0'));
  return ordenarHorarios(horas);
}

/** Ordena os horários na sequência do plantão (07 … 23, 00 … 06). */
export const ordenarHorarios = (lista = []) => [...new Set(lista)].filter((h) => HORAS.includes(h)).sort((a, b) => HORAS.indexOf(a) - HORAS.indexOf(b));

/** Texto curto do aprazamento (para a tela): "06/06H · 12 18 00 06". */
export function resumoAprazamento(a = {}) {
  const partes = [];
  if (a.freq) partes.push(FREQUENCIAS[a.freq] || a.freq);
  const hs = ordenarHorarios(a.horarios);
  if (hs.length) partes.push(hs.join(' '));
  return partes.join(' · ');
}

/** Sigla do responsável pela execução, conforme o nível de formação da NIC. */
export const siglaResponsavel = (nivel = '') => (/técnico/i.test(nivel) ? 'TÉC' : 'ENF');

/**
 * Itens da prescrição a partir do PE: diagnósticos ativos → intervenções → atividades.
 * A mesma intervenção ligada a dois diagnósticos sai uma vez só (atividades somadas).
 * Retorna { grupos: [{ codigo, titulo, resp, diagnosticos:[títulos], atividades:[{ texto, freq, horarios, obs }] }], diagnosticos }.
 */
export function itensPrescricao(sae) {
  const ativos = (sae?.diagnosticos || []).filter((d) => d.situacao !== 'resolvido' && d.decisao !== 'encerrar');
  const grupos = new Map();
  for (const d of ativos) {
    for (const x of d.nic || []) {
      if (!grupos.has(x.codigo)) grupos.set(x.codigo, { codigo: x.codigo, titulo: x.titulo, resp: siglaResponsavel(x.nivel), diagnosticos: [], atividades: [], ids: new Set() });
      const g = grupos.get(x.codigo);
      if (!g.diagnosticos.includes(d.titulo)) g.diagnosticos.push(d.titulo);
      for (const a of x.atividades || []) {
        const chave = a.id || a.texto;
        if (g.ids.has(chave)) continue;
        g.ids.add(chave);
        g.atividades.push({ texto: a.texto, freq: a.freq || '', horarios: ordenarHorarios(a.horarios), obs: String(a.obsPrescricao || '').trim() });
      }
    }
  }
  return {
    grupos: [...grupos.values()].filter((g) => g.atividades.length).map(({ ids, ...g }) => g),
    diagnosticos: ativos.map((d) => d.titulo),
  };
}

/** "Nome (Coren 123)": o autor da evolução é guardado como { nome, coren }. */
export function nomeProfissional(autor) {
  if (!autor) return '';
  if (typeof autor === 'string') return autor;
  return `${autor.nome || ''}${autor.coren ? ` (Coren ${autor.coren})` : ''}`.trim();
}

/** Campos do cabeçalho da folha (mesmos rótulos da prescrição médica, no que se aplica). */
export function camposPrescricao(internacao, ev, { leitoNum, unidadeNome = '', data }) {
  const id = camposIdentificacao(internacao, leitoNum);
  const nasc = internacao.paciente?.dataNascimento;
  return {
    ...id,
    nascimento: nasc ? `${formatarData(nasc)} (${idadeEm(nasc, data)} anos)` : '',
    setor: unidadeNome,
    leito: leitoNum ? `LEITO ${leitoNum}` : '',
    profissional: nomeProfissional(ev?.finalizadoPorNome),
    data: formatarData(data),
    validade: formatarData(somarDias(data, 1)),
    alergias: id.alergias,
  };
}
