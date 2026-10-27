// Respostas simuladas do Apps Script no modo demonstração.
// NÃO contém o catálogo NANDA-I/NOC/NIC (protegido por direitos autorais):
// é um mini-catálogo FICTÍCIO, com textos inventados e códigos 9xxxx que não
// existem nas classificações, só para a interface funcionar e treinar o fluxo.

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
function numerar(prefixo, textos) {
  let n = 0;
  return textos.map((t) => (t.startsWith('§') ? { tipo: 'subtitulo', texto: t.slice(1).trim() } : { id: `${prefixo}${++n}`, texto: t }));
}

const NANDA = {
  90001: { titulo: 'Risco de infecção (exemplo fictício)', categoria: 'Potencial para deteriorar', dominio: 'Exemplo — Segurança',
    definicao: 'Texto fictício de demonstração.', fatoresRisco: numerar('RI', ['§ Exemplo de grupo', 'Uso de cateter venoso central (exemplo)', 'Uso de tubo traqueal (exemplo)', 'Uso de cateter vesical (exemplo)', 'Imunossupressão (exemplo)']) },
  90002: { titulo: 'Padrão respiratório ineficaz (exemplo fictício)', categoria: 'Com foco no problema', dominio: 'Exemplo — Respiração',
    definicao: 'Texto fictício de demonstração.', caracteristicasDefinidoras: numerar('CD', ['Frequência respiratória aumentada (exemplo)', 'Uso de musculatura acessória (exemplo)', 'Assincronia com o ventilador (exemplo)']),
    fatoresRelacionados: numerar('FR', ['Fadiga (exemplo)', 'Secreção em vias aéreas (exemplo)']) },
  90003: { titulo: 'Risco de lesão por pressão (exemplo fictício)', categoria: 'Potencial para deteriorar', dominio: 'Exemplo — Pele',
    definicao: 'Texto fictício de demonstração.', fatoresRisco: numerar('RI', ['Imobilidade no leito (exemplo)', 'Sedação contínua (exemplo)', 'Umidade da pele (exemplo)']) },
  90004: { titulo: 'Dor aguda (exemplo fictício)', categoria: 'Com foco no problema', dominio: 'Exemplo — Conforto',
    definicao: 'Texto fictício de demonstração.', caracteristicasDefinidoras: numerar('CD', ['Escore de dor elevado em escala validada (exemplo)', 'Expressão facial de dor (exemplo)']),
    fatoresRelacionados: numerar('FR', ['Agente lesivo físico (exemplo)']) },
};
const NOC = {
  9101: { titulo: 'Controle de infecção (exemplo)', escala: ['Grave', 'Substancial', 'Moderado', 'Leve', 'Nenhum'], indicadores: ['Febre (exemplo)', 'Sinais flogísticos no sítio (exemplo)', 'Secreção purulenta (exemplo)'] },
  9102: { titulo: 'Estado respiratório (exemplo)', escala: ['Gravemente comprometido', 'Muito comprometido', 'Moderadamente comprometido', 'Levemente comprometido', 'Não comprometido'], indicadores: ['Frequência respiratória (exemplo)', 'Sincronia com o ventilador (exemplo)', 'Saturação de oxigênio (exemplo)'] },
  9103: { titulo: 'Integridade da pele (exemplo)', escala: ['Gravemente comprometido', 'Muito comprometido', 'Moderadamente comprometido', 'Levemente comprometido', 'Não comprometido'], indicadores: ['Pele íntegra em proeminências (exemplo)', 'Hidratação da pele (exemplo)'] },
  9104: { titulo: 'Nível de dor (exemplo)', escala: ['Grave', 'Substancial', 'Moderado', 'Leve', 'Nenhum'], indicadores: ['Dor relatada ou observada (exemplo)', 'Expressão facial de dor (exemplo)'] },
};
const NIC = {
  9201: { titulo: 'Cuidados com dispositivos invasivos (exemplo)', nivel: 'Enfermeiro registrado', atividades: ['Avaliar diariamente a necessidade de cada dispositivo (exemplo)', 'Manter curativo íntegro e datado (exemplo)', 'Higienizar as mãos antes de manipular (exemplo)'] },
  9202: { titulo: 'Monitoração respiratória (exemplo)', nivel: 'Enfermeiro registrado', atividades: ['Monitorar frequência e padrão respiratório (exemplo)', 'Aspirar vias aéreas quando necessário (exemplo)', 'Manter cabeceira elevada (exemplo)'] },
  9203: { titulo: 'Prevenção de lesão por pressão (exemplo)', nivel: 'Técnico de enfermagem', atividades: ['Mudar o decúbito a cada 2 horas (exemplo)', 'Proteger proeminências ósseas (exemplo)', 'Manter a pele limpa e seca (exemplo)'] },
  9204: { titulo: 'Controle da dor (exemplo)', nivel: 'Enfermeiro registrado', atividades: ['Avaliar a dor com escala adequada (exemplo)', 'Reavaliar após a intervenção (exemplo)'] },
};
const LIG = { 90001: [[9101], [9201]], 90002: [[9102], [9202]], 90003: [[9103], [9203]], 90004: [[9104], [9204]] };

const resumoNanda = (c) => ({ codigo: c, titulo: NANDA[c].titulo, dominio: NANDA[c].dominio, classe: '—', categoria: NANDA[c].categoria, temLigacoes: true });

// Testes de segurança operacional: ?demo=1&falhaia=erro|tempo simula a IA falhando
// (resposta fora do formato ou servidor que não responde). A evolução e o PE manual
// devem continuar funcionando.
const FALHA_IA = new URLSearchParams(location.search).get('falhaia');

export async function responder(acao, dados = {}) {
  if (FALHA_IA && acao.startsWith('ia.')) {
    const { ErroApi } = await import('./appsscript.js');
    await espera(FALHA_IA === 'tempo' ? 2500 : 300);
    if (FALHA_IA === 'tempo') throw new ErroApi('tempo_esgotado', 'O servidor demorou para responder. Tente de novo.');
    throw new ErroApi('ia_resposta_invalida', 'A IA respondeu fora do formato. Tente de novo.');
  }
  await espera(acao === 'ia.sugerirSAE' ? 1800 : acao === 'ia.sugerirAtividades' ? 900 : 350);
  switch (acao) {
    case 'ping':
      return { ok: true, usuario: 'demonstracao@exemplo.org', perfil: 'admin', demo: true };
    case 'catalogo.versao':
      return { nanda: 'demonstração', noc: 'demonstração', nic: 'demonstração', ligacoes: 'demonstração' };
    case 'catalogo.nanda.buscar': {
      const t = String(dados.texto || '').toLowerCase();
      return Object.keys(NANDA).filter((c) => NANDA[c].titulo.toLowerCase().includes(t) || c.includes(t))
        .filter((c) => !dados.categoria || NANDA[c].categoria === dados.categoria).map(resumoNanda);
    }
    case 'catalogo.nanda.detalhe': {
      const d = NANDA[dados.codigo];
      return d && { codigo: dados.codigo, ...d, caracteristicasDefinidoras: d.caracteristicasDefinidoras || [], fatoresRelacionados: d.fatoresRelacionados || [], fatoresRisco: d.fatoresRisco || [], populacoesRisco: [], condicoesAssociadas: [], temLigacoes: true };
    }
    case 'catalogo.ligacoes':
      return {
        versao: 'demonstração',
        ligacoes: (dados.codigos || []).map((c) => (LIG[c] ? {
          codigo_nanda: c, titulo: NANDA[c].titulo, categoria: NANDA[c].categoria,
          noc: LIG[c][0].map((n) => ({ codigo: String(n), titulo: NOC[n].titulo, papel: 'principal', indicadores_sugeridos: [`${n}01`] })),
          nic: LIG[c][1].map((n) => ({ codigo: String(n), titulo: NIC[n].titulo, papel: 'principal', nivel_formacao: NIC[n].nivel })),
        } : { codigo_nanda: c, semLigacoes: true, noc: [], nic: [] })),
      };
    case 'catalogo.noc.detalhe': {
      const r = NOC[dados.codigo];
      return r && { codigo: dados.codigo, titulo: r.titulo, definicao: 'Texto fictício.', escala_principal: 'exemplo',
        indicadores: r.indicadores.map((t, k) => ({ codigo: `${dados.codigo}0${k + 1}`, texto: t, escala: 'exemplo' })), escalas: { exemplo: r.escala } };
    }
    case 'catalogo.nic.detalhe': {
      const x = NIC[dados.codigo];
      return x && { codigo: dados.codigo, titulo: x.titulo, definicao: 'Texto fictício.', nivel_formacao: x.nivel, tempo_estimado: '—', atividades: numerar('A', x.atividades) };
    }
    case 'ia.sugerirSAE':
      return {
        modelo: 'demonstração', versaoPrompt: 'sae-1.0', versaoLigacoes: 'demonstração', ms: 1800,
        sugestoes: [
          { ...resumoNanda('90001'), prioridade: 1, justificativa: 'Exemplo: dispositivos invasivos registrados na avaliação.', evidencias: { cd: [], fr: [], ri: NANDA[90001].fatoresRisco.filter((i) => ['RI1', 'RI2'].includes(i.id)) } },
          { ...resumoNanda('90002'), prioridade: 2, justificativa: 'Exemplo: frequência respiratória elevada e assincronia.', evidencias: { cd: NANDA[90002].caracteristicasDefinidoras.slice(0, 1), fr: NANDA[90002].fatoresRelacionados.slice(1, 2), ri: [] } },
          { ...resumoNanda('90003'), prioridade: 3, justificativa: 'Exemplo: paciente sedado e imóvel.', evidencias: { cd: [], fr: [], ri: NANDA[90003].fatoresRisco.slice(0, 2) } },
        ],
      };
    case 'ia.sugerirAtividades': {
      const x = NIC[dados.codigoNic];
      return { modelo: 'demonstração', versaoPrompt: 'sae-1.0', ms: 900, atividades: x ? numerar('A', x.atividades).slice(0, 2) : [] };
    }
    case 'ia.teste':
      return { modelo: 'demonstração', ms: 600 };
    default:
      return null;
  }
}

