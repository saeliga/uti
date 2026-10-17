/**
 * Sugestão do Processo de Enfermagem pela IA (Groq), em duas etapas:
 *  1) a IA escolhe diagnósticos SOMENTE da lista de diagnósticos com ligações
 *     (código + título + categoria), em ordem de prioridade;
 *  2) para os escolhidos, a IA marca características definidoras e fatores
 *     pelos IDENTIFICADORES da lista oficial de cada diagnóstico (CD1, FR3, RI2…).
 * O servidor confere tudo contra o catálogo: código ou identificador que não
 * existe é descartado. Nada volta como aceito: o enfermeiro decide cada item.
 *
 * Entrada: { resumo } — texto clínico SEM nome, registro ou data de nascimento
 * (montado no navegador a partir da evolução). Os logs não guardam o resumo.
 */

var SAE_VERSAO_PROMPT = 'sae-1.0';
var SAE_MAX_DIAGNOSTICOS = 8;
var SAE_MAX_RESUMO = 12000;

function extrairJson_(texto) {
  var t = String(texto || '').replace(/<think>[\s\S]*?<\/think>/g, '');
  var ini = t.indexOf('{');
  var fim = t.lastIndexOf('}');
  if (ini < 0 || fim <= ini) throw erro_('ia_resposta_invalida');
  try {
    return JSON.parse(t.slice(ini, fim + 1));
  } catch (e) {
    throw erro_('ia_resposta_invalida');
  }
}

function listaDiagnosticosParaIA_() {
  var nanda = {};
  carregarCatalogo_('nanda').forEach(function (d) { nanda[d.codigo] = d; });
  return carregarCatalogo_('ligacoes').ligacoes
    .filter(function (l) { return nanda[l.codigo_nanda]; })
    .map(function (l) { return l.codigo_nanda + ' | ' + l.titulo + ' | ' + l.categoria; })
    .join('\n');
}

var SAE_SISTEMA_1 =
  'Você é enfermeira especialista em terapia intensiva oncológica adulta e no uso da NANDA-I 2024-2026. ' +
  'Responda APENAS com JSON válido. Escolha diagnósticos de enfermagem SOMENTE da lista fornecida, usando o código exatamente como está. ' +
  'Baseie-se apenas nos dados clínicos recebidos; não invente sinais, exames ou condutas. ' +
  'Prefira diagnósticos com evidência clara nos dados; inclua diagnósticos de risco relevantes para o paciente crítico oncológico ' +
  '(por exemplo, infecção com dispositivos invasivos, lesão por pressão, quedas, aspiração, sangramento) somente quando houver fatores nos dados. ' +
  'Escolha no máximo ' + SAE_MAX_DIAGNOSTICOS + ' diagnósticos, em ordem de prioridade clínica. ' +
  'Para cada um, escreva uma justificativa curta (até 25 palavras) citando os dados que a sustentam.';

var SAE_SISTEMA_2 =
  'Você é enfermeira especialista em terapia intensiva oncológica adulta e no uso da NANDA-I 2024-2026. ' +
  'Responda APENAS com JSON válido. Para cada diagnóstico, marque os itens da lista oficial que estão presentes nos dados clínicos, ' +
  'usando SOMENTE os identificadores fornecidos (ex.: CD2, FR5, RI1). Não invente identificadores nem textos. ' +
  'Regras por categoria: "Com foco no problema" → características definidoras (CD) e fatores relacionados (FR); ' +
  '"Potencial para deteriorar" (risco) → somente fatores de risco (RI), nunca CD; ' +
  '"Potencial para melhorar" → características definidoras (CD). Marque apenas o que os dados sustentam.';

function itensParaIA_(lista) {
  return (lista || []).filter(function (i) { return i.id; }).map(function (i) { return i.id + ': ' + i.texto; }).join('\n');
}

/** Ação ia.sugerirSAE */
function iaSugerirSAE_(dados) {
  var resumo = String(dados.resumo || '').trim();
  if (resumo.length < 40) throw erro_('resumo_insuficiente');
  if (resumo.length > SAE_MAX_RESUMO) resumo = resumo.slice(0, SAE_MAX_RESUMO);
  var inicio = Date.now();

  // Etapa 1: escolha dos diagnósticos.
  var r1 = chamarGroq_([
    { role: 'system', content: SAE_SISTEMA_1 },
    { role: 'user', content: 'DADOS CLÍNICOS:\n' + resumo + '\n\nLISTA DE DIAGNÓSTICOS PERMITIDOS (código | título | categoria):\n' +
      listaDiagnosticosParaIA_() + '\n\nFormato: {"diagnosticos":[{"codigo":"00000","justificativa":"..."}]}' },
  ], { json: true, maxTokens: 1500, temperatura: 0.2 });
  var escolha = extrairJson_(r1.texto).diagnosticos || [];

  var ligados = {};
  carregarCatalogo_('ligacoes').ligacoes.forEach(function (l) { ligados[l.codigo_nanda] = true; });
  var vistos = {};
  var escolhidos = [];
  escolha.forEach(function (e) {
    var c = String(e && e.codigo || '').replace(/\D/g, '');
    while (c.length < 5 && c.length > 0) c = '0' + c;
    if (!c || vistos[c] || !ligados[c] || escolhidos.length >= SAE_MAX_DIAGNOSTICOS) return;
    vistos[c] = true;
    escolhidos.push({ codigo: c, justificativa: String(e.justificativa || '').slice(0, 300) });
  });
  if (!escolhidos.length) return { modelo: r1.modelo, versaoPrompt: SAE_VERSAO_PROMPT, ms: Date.now() - inicio, sugestoes: [] };

  // Etapa 2: evidências pelos identificadores da lista oficial.
  var detalhes = {};
  var blocos = escolhidos.map(function (e) {
    var d = catalogoDetalheNanda_({ codigo: e.codigo });
    detalhes[e.codigo] = d;
    var partes = ['### ' + d.codigo + ' — ' + d.titulo + ' (' + d.categoria + ')'];
    if (d.categoria === 'Potencial para deteriorar') partes.push('Fatores de risco:\n' + itensParaIA_(d.fatoresRisco));
    else {
      partes.push('Características definidoras:\n' + itensParaIA_(d.caracteristicasDefinidoras));
      if (d.categoria === 'Com foco no problema') partes.push('Fatores relacionados:\n' + itensParaIA_(d.fatoresRelacionados));
    }
    return partes.join('\n');
  });
  var r2 = chamarGroq_([
    { role: 'system', content: SAE_SISTEMA_2 },
    { role: 'user', content: 'DADOS CLÍNICOS:\n' + resumo + '\n\nDIAGNÓSTICOS E LISTAS OFICIAIS:\n' + blocos.join('\n\n') +
      '\n\nFormato: {"diagnosticos":[{"codigo":"00000","itens":["CD1","FR2"]}]}' },
  ], { json: true, maxTokens: 2500, temperatura: 0.1 });
  var marcados = {};
  (extrairJson_(r2.texto).diagnosticos || []).forEach(function (e) {
    var c = String(e && e.codigo || '').replace(/\D/g, '');
    while (c.length < 5 && c.length > 0) c = '0' + c;
    marcados[c] = (e.itens || []).map(String);
  });

  var sugestoes = escolhidos.map(function (e) {
    var d = detalhes[e.codigo];
    var ids = marcados[e.codigo] || [];
    var pegar = function (lista, prefixo) {
      return (lista || []).filter(function (i) { return i.id && i.id.indexOf(prefixo) === 0 && ids.indexOf(i.id) >= 0; });
    };
    var risco = d.categoria === 'Potencial para deteriorar';
    return {
      codigo: d.codigo, titulo: d.titulo, categoria: d.categoria, dominio: d.dominio,
      justificativa: e.justificativa,
      evidencias: {
        cd: risco ? [] : pegar(d.caracteristicasDefinidoras, 'CD'),
        fr: d.categoria === 'Com foco no problema' ? pegar(d.fatoresRelacionados, 'FR') : [],
        ri: risco ? pegar(d.fatoresRisco, 'RI') : [],
      },
    };
  });
  return {
    modelo: r1.modelo === r2.modelo ? r1.modelo : r1.modelo + ' / ' + r2.modelo,
    versaoPrompt: SAE_VERSAO_PROMPT,
    versaoLigacoes: catalogoInfo_().ligacoes,
    ms: Date.now() - inicio,
    sugestoes: sugestoes,
  };
}

/**
 * Ação ia.sugerirAtividades: para UM diagnóstico já aceito pelo enfermeiro e
 * UMA intervenção ligada a ele, a IA escolhe as atividades mais pertinentes
 * (somente pelos identificadores A1, A2… da lista oficial). Pedido pequeno,
 * feito na hora em que o diagnóstico entra no plano, para já trazer as
 * atividades marcadas; o enfermeiro altera o que quiser.
 * Entrada: { resumo, codigoNanda, codigoNic }.
 */
var SAE_MAX_ATIVIDADES = 6;
var SAE_SISTEMA_ATIV =
  'Você é enfermeira especialista em terapia intensiva oncológica adulta e no uso da NIC. ' +
  'Responda APENAS com JSON válido. Da lista oficial de atividades da intervenção, escolha de 3 a ' + SAE_MAX_ATIVIDADES +
  ' atividades mais pertinentes para este paciente na UTI hoje, em ordem de importância, usando SOMENTE os identificadores fornecidos (ex.: A3). ' +
  'Prefira atividades executáveis e verificáveis no plantão; evite atividades de educação para alta ou que não se apliquem ao paciente crítico.';

function iaSugerirAtividades_(dados) {
  var resumo = String(dados.resumo || '').trim();
  if (resumo.length < 40) throw erro_('resumo_insuficiente');
  if (resumo.length > SAE_MAX_RESUMO) resumo = resumo.slice(0, SAE_MAX_RESUMO);
  var nanda = codigo_(dados.codigoNanda, 5);
  var nic = codigo_(dados.codigoNic, 4);
  var lig = carregarCatalogo_('ligacoes').ligacoes.filter(function (l) { return l.codigo_nanda === nanda; })[0];
  if (!lig || !lig.nic.some(function (n) { return n.codigo === nic; })) throw erro_('fora_das_ligacoes');
  var inicio = Date.now();
  var det = catalogoDetalheNic_({ codigo: nic });
  var r = chamarGroq_([
    { role: 'system', content: SAE_SISTEMA_ATIV },
    { role: 'user', content: 'DADOS CLÍNICOS:\n' + resumo + '\n\nDIAGNÓSTICO DE ENFERMAGEM: ' + lig.titulo +
      '\nINTERVENÇÃO: ' + det.codigo + ' — ' + det.titulo + '\nATIVIDADES OFICIAIS:\n' + itensParaIA_(det.atividades) +
      '\n\nFormato: {"atividades":["A1","A2"]}' },
  ], { json: true, maxTokens: 800, temperatura: 0.1 });
  var ids = (extrairJson_(r.texto).atividades || []).map(String);
  var vistos = {};
  var escolhidas = [];
  ids.forEach(function (id) {
    if (vistos[id] || escolhidas.length >= SAE_MAX_ATIVIDADES) return;
    var a = det.atividades.filter(function (x) { return x.id === id; })[0];
    if (!a) return;
    vistos[id] = true;
    escolhidas.push({ id: a.id, texto: a.texto });
  });
  return { modelo: r.modelo, versaoPrompt: SAE_VERSAO_PROMPT, ms: Date.now() - inicio, atividades: escolhidas };
}
