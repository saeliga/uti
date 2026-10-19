// Infusões contínuas por finalidade. Nomes sempre pelo princípio ativo, em caixa
// alta. Os da lista não são editáveis; "+ Outra" permite incluir outro medicamento.
// Item gravado: { grupo, medicamento, vazao, livre }.

export const GRUPOS_INFUSAO = [
  { id: 'hv', titulo: 'Hidratação venosa', texto: 'hidratação venosa', selecao: ['SORO FISIOLÓGICO 0,9%', 'SORO GLICOSADO 5%', 'SORO GLICOSADO 10%', 'RINGER LACTATO', 'SORO GLICOFISIOLÓGICO'] },
  { id: 'dva', titulo: 'DVA em uso', texto: 'DVA', fixos: ['NORADRENALINA', 'ADRENALINA', 'VASOPRESSINA', 'DOPAMINA', 'DOBUTAMINA', 'NITROGLICERINA', 'NITROPRUSSIATO', 'AMIODARONA'], livre: '+ Outra DVA' },
  { id: 'sedo', titulo: 'Sedoanalgesia', texto: 'sedoanalgesia', fixos: ['FENTANIL', 'MIDAZOLAM', 'PROPOFOL', 'CETAMINA', 'DEXMEDETOMIDINA'], livre: '+ Outra sedoanalgesia' },
  { id: 'outras', titulo: 'Outras infusões venosas', texto: 'outras infusões', fixos: ['INSULINA REGULAR'], livre: '+ Adicionar infusão' },
];

export const MEDICAMENTOS_FIXOS = GRUPOS_INFUSAO.flatMap((g) => [...(g.fixos || []), ...(g.selecao || [])]);

export const caixaAlta = (s) => String(s || '').toLocaleUpperCase('pt-BR').trim();
const comVazao = (i) => (i.vazao === '' || i.vazao == null ? `${caixaAlta(i.medicamento)} (vazão não informada)` : `${caixaAlta(i.medicamento)} a ${String(i.vazao).replace('.', ',')} mL/h`);

/** Itens antigos (sem grupo) vão para o grupo do medicamento (ou "outras"), em caixa alta. */
export function normalizarInfusoes(itens = []) {
  return (itens || []).filter(Boolean).map((i) => {
    if (i.grupo) return i;
    const nome = caixaAlta(i.medicamento);
    const g = GRUPOS_INFUSAO.find((x) => [...(x.fixos || []), ...(x.selecao || [])].includes(nome));
    return { grupo: g?.id || 'outras', medicamento: nome, vazao: i.vazao ?? '', livre: !g };
  });
}

/** Texto agrupado por finalidade: "DVA: NORADRENALINA a 15 mL/h; sedoanalgesia: FENTANIL a 5 mL/h". */
export function textoInfusoes(itens = []) {
  const lista = normalizarInfusoes(itens).filter((i) => i.medicamento);
  return GRUPOS_INFUSAO.map((g) => {
    const doGrupo = lista.filter((i) => i.grupo === g.id);
    return doGrupo.length ? `${g.texto}: ${doGrupo.map(comVazao).join(', ')}` : '';
  }).filter(Boolean).join('; ');
}
