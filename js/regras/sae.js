// Regras do Processo de Enfermagem (blocos 3 a 5). Funções puras (testáveis no Node).
//
// Estrutura guardada em evolucao.dados.sae:
// {
//   status: 'nao_iniciado' | 'sugerido' | 'pendente' | 'em_revisao' | 'concluido',
//   sugestao: { modelo, versaoPrompt, versaoLigacoes, emTexto, itens: [{ ...diagnóstico sugerido, decisao }] },
//   diagnosticos: [{
//     codigo, titulo, categoria, dominio, origem, situacao: 'ativo'|'resolvido', confirmado,
//     evidencias: { cd: [{id, texto}], fr, ri, pr, ca }, observacao,
//     noc: [{ codigo, titulo, indicadores: [{ codigo, texto, niveis: [5 rótulos], meta, pontuacao, anterior }] }],
//     nic: [{ codigo, titulo, nivel, atividades: [{ id, texto, status, justificativa }] }],
//     decisao: 'manter'|'modificar'|'encerrar', decisaoMotivo,
//   }],
//   versaoLigacoes,
// }

export const CATEGORIA = {
  problema: 'Com foco no problema',
  risco: 'Potencial para deteriorar',
  promocao: 'Potencial para melhorar',
};

export const ORIGEM = {
  ia_aceito: 'Sugestão da IA aceita sem edição',
  ia_editado: 'Sugestão da IA aceita com edição',
  enfermeiro: 'Acrescentado pelo enfermeiro',
  plano_anterior: 'Plano do dia anterior',
};

export const STATUS_ATIVIDADE = { realizado: 'Realizado', nao_realizado: 'Não realizado', nao_se_aplica: 'Não se aplica' };
export const DECISOES = { manter: 'Manter o plano', modificar: 'Modificar o plano', encerrar: 'Encerrar o diagnóstico' };
export const ROTULO_STATUS_PE = {
  nao_iniciado: 'PE não iniciado',
  sugerido: 'PE sugerido · revisar',
  pendente: 'PE pendente',
  em_revisao: 'PE em revisão',
  concluido: 'PE concluído',
};

const n = (l) => (Array.isArray(l) ? l.length : 0);

/** Validação mínima por categoria (mínimo 1, não "3 obrigatórios"). Devolve lista de erros. */
export function validarEvidencias(categoria, ev = {}) {
  const e = [];
  if (categoria === CATEGORIA.problema) {
    if (!n(ev.cd)) e.push('marque pelo menos 1 característica definidora');
    if (!n(ev.fr)) e.push('marque pelo menos 1 fator relacionado');
  } else if (categoria === CATEGORIA.risco) {
    if (!n(ev.ri)) e.push('marque pelo menos 1 fator de risco');
    if (n(ev.cd)) e.push('diagnóstico de risco não tem características definidoras');
  } else if (categoria === CATEGORIA.promocao) {
    if (!n(ev.cd)) e.push('marque pelo menos 1 característica definidora');
  }
  return e;
}

/** Diagnóstico novo a partir de uma sugestão da IA ou da biblioteca. */
export function novoDiagnostico(base, origem) {
  return {
    codigo: base.codigo, titulo: base.titulo, categoria: base.categoria, dominio: base.dominio || '',
    evidencias: { cd: [], fr: [], ri: [], pr: [], ca: [], ...(base.evidencias || {}) },
    observacao: base.observacao || '', origem, situacao: 'ativo', confirmado: true,
    noc: [], nic: [], decisao: '', decisaoMotivo: '',
  };
}

/**
 * Plano que passa para o dia seguinte: diagnósticos ativos continuam, com NOC/NIC
 * escolhidos, mas pontuações, situação das atividades e decisão começam vazias,
 * e cada diagnóstico precisa ser confirmado de novo. A pontuação de ontem vira "anterior".
 */
export function planoParaNovoDia(saeAnterior) {
  const diagnosticos = (saeAnterior?.diagnosticos || [])
    .filter((d) => d.situacao !== 'resolvido' && d.decisao !== 'encerrar')
    .map((d) => ({
      ...d,
      origem: d.origem,
      confirmado: false,
      decisao: '', decisaoMotivo: '',
      noc: (d.noc || []).map((r) => ({ ...r, indicadores: (r.indicadores || []).map((i) => ({ ...i, anterior: i.pontuacao || i.anterior || '', pontuacao: '' })) })),
      nic: (d.nic || []).map((x) => ({ ...x, atividades: (x.atividades || []).map((a) => ({
        id: a.id, texto: a.texto, status: '', justificativa: '',
        // O aprazamento (prescrição) continua no dia seguinte.
        ...(a.freq ? { freq: a.freq } : {}), ...(a.horarios?.length ? { horarios: a.horarios } : {}), ...(a.obsPrescricao ? { obsPrescricao: a.obsPrescricao } : {}),
      })) })),
    }));
  return { status: 'nao_iniciado', sugestao: null, diagnosticos, versaoLigacoes: saeAnterior?.versaoLigacoes || '' };
}

/** Erros que impedem concluir o PE. */
export function validarConclusao(sae) {
  const erros = [];
  const ativos = (sae?.diagnosticos || []).filter((d) => d.situacao !== 'resolvido');
  if (!(sae?.diagnosticos || []).length) erros.push('Inclua pelo menos um diagnóstico de enfermagem.');
  for (const d of ativos) {
    const nome = d.titulo;
    if (!d.confirmado) erros.push(`${nome}: confirme se o diagnóstico continua ativo (ou marque como resolvido).`);
    for (const x of validarEvidencias(d.categoria, d.evidencias)) erros.push(`${nome}: ${x}.`);
    const inds = (d.noc || []).flatMap((r) => r.indicadores || []);
    if (!inds.length) erros.push(`${nome}: escolha um resultado (NOC) e pelo menos um indicador.`);
    if (inds.some((i) => !i.pontuacao)) erros.push(`${nome}: pontue todos os indicadores NOC (ou "não avaliado").`);
    const ativs = (d.nic || []).flatMap((x) => x.atividades || []);
    if (!ativs.length) erros.push(`${nome}: escolha uma intervenção (NIC) e pelo menos uma atividade.`);
    if (ativs.some((a) => !a.status)) erros.push(`${nome}: registre a situação de todas as atividades.`);
    if (ativs.some((a) => a.status === 'nao_realizado' && !String(a.justificativa || '').trim())) erros.push(`${nome}: justifique as atividades não realizadas.`);
    if (!d.decisao) erros.push(`${nome}: registre a decisão (manter, modificar ou encerrar).`);
    if (d.decisao === 'modificar' && !String(d.decisaoMotivo || '').trim()) erros.push(`${nome}: informe o que muda no plano e por quê.`);
  }
  if ((sae?.sugestao?.itens || []).some((s) => !s.decisao)) erros.push('Há sugestões da IA sem decisão (aceitar ou descartar).');
  return erros;
}

// --------------------------------------------------------------------------- avisos de risco
const COD = { infeccao: '00004', lpp: '00304', aspiracao: '00039' };

/**
 * Avisos (não bloqueiam): achados da avaliação que costumam pedir um diagnóstico
 * de risco ainda ausente no plano. Mostrados na tela do PE.
 */
export function avisosRisco(dados = {}, sae = {}) {
  const tem = new Set((sae.diagnosticos || []).filter((d) => d.situacao !== 'resolvido').map((d) => d.codigo));
  const avisos = [];
  const disp = (dados.dispositivos?.itens || []).filter((i) => i?.tipo && !i.retirada).map((i) => i.tipo);
  const invasivos = disp.filter((t) => ['cvc', 'picc', 'cti', 'cateter_dialise', 'cvd', 'tot', 'tqt', 'pai'].includes(t));
  const vmi = ['vmi_tot', 'vmi_tqt'].includes(dados.respiratorio?.suporte);
  if ((invasivos.length || vmi || dados.renal?.modo === 'cvd') && !tem.has(COD.infeccao))
    avisos.push({ codigo: COD.infeccao, texto: 'Há dispositivo invasivo ou ventilação mecânica na avaliação e o plano não tem "Risco de infecção".' });
  const consc = dados.neuro?.consciencia;
  if (['sedado', 'comatoso', 'torporoso'].includes(consc) && !tem.has(COD.lpp))
    avisos.push({ codigo: COD.lpp, texto: 'Paciente sedado ou com rebaixamento do nível de consciência e o plano não tem "Risco de lesão por pressão no adulto".' });
  const sonda = disp.some((t) => ['sne', 'sng', 'soe', 'sog'].includes(t)) || (dados.gi?.via || []).some((v) => ['sne', 'sng', 'soe'].includes(v));
  if (sonda && ['sedado', 'comatoso', 'torporoso', 'sonolento'].includes(consc) && !tem.has(COD.aspiracao))
    avisos.push({ codigo: COD.aspiracao, texto: 'Sonda para dieta com rebaixamento do nível de consciência e o plano não tem "Risco de aspiração".' });
  return avisos;
}

// --------------------------------------------------------------------------- textos
const lista = (itens) => (itens || []).map((i) => i.texto).join('; ');

/** Uma linha por diagnóstico, no formato usual da enfermagem. */
export function enunciado(d) {
  const ev = d.evidencias || {};
  if (d.categoria === CATEGORIA.risco) return `${d.titulo}${n(ev.ri) ? `, evidenciado por fatores de risco: ${lista(ev.ri)}` : ''}`;
  const rel = n(ev.fr) ? ` relacionado a ${lista(ev.fr)}` : '';
  const evid = n(ev.cd) ? `, evidenciado por ${lista(ev.cd)}` : '';
  return `${d.titulo}${rel}${evid}`;
}

/** Bloco do PE para o texto do PEP (só o que foi confirmado; sugestões da IA não entram). */
export function textoSAE(sae) {
  const ds = (sae?.diagnosticos || []);
  if (!ds.length) return '';
  const linhas = ['PROCESSO DE ENFERMAGEM:'];
  ds.forEach((d, k) => {
    if (d.situacao === 'resolvido') {
      linhas.push(`${k + 1}) ${d.titulo}: resolvido.`);
      return;
    }
    linhas.push(`${k + 1}) Diagnóstico: ${enunciado(d)}.`);
    for (const r of d.noc || []) {
      const inds = (r.indicadores || []).map((i) => {
        const p = i.pontuacao === 'NA' ? 'não avaliado' : i.pontuacao ? `${i.pontuacao} (${i.niveis?.[Number(i.pontuacao) - 1] || ''})` : 'sem pontuação';
        return `${i.texto}: ${p}${i.meta ? `, meta ${i.meta}` : ''}${i.anterior && i.anterior !== 'NA' ? `, anterior ${i.anterior}` : ''}`;
      });
      linhas.push(`   Resultado: ${r.titulo} - ${inds.join('; ')}.`);
    }
    for (const x of d.nic || []) {
      const ativs = (x.atividades || []).map((a) => `${a.texto} (${(STATUS_ATIVIDADE[a.status] || 'sem registro').toLowerCase()}${a.justificativa ? `: ${a.justificativa}` : ''})`);
      linhas.push(`   Intervenção: ${x.titulo} - ${ativs.join('; ')}.`);
    }
    if (d.decisao) linhas.push(`   Avaliação: ${DECISOES[d.decisao].toLowerCase()}${d.decisaoMotivo ? ` (${d.decisaoMotivo})` : ''}.`);
  });
  return linhas.join('\n');
}

/**
 * Resumo clínico SEM identificação (sem nome, registro, data de nascimento ou
 * leito) para enviar à IA. `textoSubblocos` vem pronto da evolução.
 */
export function resumoParaIA({ idade, diagnosticoMedico, comorbidades, isolamento, textoSubblocos }) {
  // Idade muito alta identifica (poucas pessoas): vai como faixa.
  const idadeTxt = idade == null || idade === '' ? '' : Number(idade) >= 90 ? ', 90 anos ou mais' : `, ${idade} anos`;
  return [
    `Paciente adulto em terapia intensiva oncológica${idadeTxt}.`,
    diagnosticoMedico && `Diagnóstico médico / motivo da internação: ${diagnosticoMedico}.`,
    comorbidades && `Comorbidades: ${comorbidades}.`,
    isolamento && `Precaução: ${isolamento}.`,
    textoSubblocos,
  ].filter(Boolean).join('\n');
}

const semAcento = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const escRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Última barreira antes de enviar texto à IA (LGPD: só dado anonimizado sai do
 * sistema). Remove: partes do nome do paciente, registro, data de nascimento,
 * CPF, CNS/cartão do SUS, telefones, e-mails e nomes depois de "Dr./Dra./Enf.".
 */
export function anonimizarParaIA(texto, { nome = '', registro = '', nascimento = '' } = {}) {
  let t = String(texto || '');
  const partes = semAcento(nome).split(/\s+/).filter((x) => x.length >= 3 && !/^(DOS|DAS|DES|DEL)$/i.test(x));
  for (const parte of partes) {
    // compara sem acento, letra a letra (o texto pode ter ou não acento)
    const padrao = [...parte].map((c) => {
      const variantes = { A: 'AÁÀÂÃÄ', E: 'EÉÈÊË', I: 'IÍÌÎÏ', O: 'OÓÒÔÕÖ', U: 'UÚÙÛÜ', C: 'CÇ', N: 'NÑ' }[c.toUpperCase()];
      return variantes ? `[${variantes}${variantes.toLowerCase()}]` : escRegex(c);
    }).join('');
    t = t.replace(new RegExp(`(^|[^\\p{L}])${padrao}(?=$|[^\\p{L}])`, 'giu'), '$1[paciente]');
  }
  if (registro && String(registro).trim().length >= 3) t = t.split(String(registro).trim()).join('[registro]');
  if (nascimento && /^\d{4}-\d{2}-\d{2}$/.test(nascimento)) {
    const [a, m, d] = nascimento.split('-');
    t = t.split(`${d}/${m}/${a}`).join('[data]').split(nascimento).join('[data]');
  }
  return t
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[documento]') // CPF
    .replace(/\b\d{3}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, '[documento]') // CNS
    .replace(/\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/g, '[telefone]')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[e-mail]')
    .replace(/\b(Dr|Dra|Enf|Enfa|Téc|Tec)\.?\s+[A-ZÁ-Ú][\p{L}]+(\s+[A-ZÁ-Ú][\p{L}]+)?/gu, '$1. [profissional]');
}
