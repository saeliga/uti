// Tela do Processo de Enfermagem (blocos 3 a 5 da evolução).
// O enfermeiro decide tudo: sugestões da IA chegam como propostas, a biblioteca
// NANDA-I permite acrescentar diagnósticos, e NOC/NIC são escolhidos SOMENTE
// entre os ligados a cada diagnóstico na tabela de ligações.

import { h, limpar, aviso, abrirJanela, confirmar } from '../../nucleo/ui.js';
import * as cat from '../../api/catalogo.js';
import {
  CATEGORIA, ORIGEM, STATUS_ATIVIDADE, DECISOES, ROTULO_STATUS_PE,
  validarEvidencias, novoDiagnostico, validarConclusao, avisosRisco, enunciado,
} from '../../regras/sae.js';
import { agoraLocalISO, formatarDataHora } from '../../regras/datas.js';

const clone = (o) => JSON.parse(JSON.stringify(o ?? null));
const responsavel = (nivel = '') => (/técnico/i.test(nivel) ? 'Técnico de enfermagem' : /pós/i.test(nivel) ? 'Enfermeiro (pós-graduado)' : 'Enfermeiro');
const ROT_CAT = { [CATEGORIA.problema]: 'Foco no problema', [CATEGORIA.risco]: 'Risco', [CATEGORIA.promocao]: 'Promoção da saúde' };

/**
 * opcoes: {
 *   dados: sae inicial, somenteLeitura, aoMudar(sae, { imediato }),
 *   dadosEvolucao(): dados atuais da avaliação (para avisos),
 *   resumoIA(): texto sem identificação para a IA,
 * }
 * Devolve { el, dados(), definirDados(sae), atualizar() } — mesmo formato dos subblocos.
 */
export function painelSAE({ dados, somenteLeitura, aoMudar, dadosEvolucao, resumoIA }) {
  let sae = clone(dados) || {};
  sae.status ||= 'nao_iniciado';
  sae.diagnosticos ||= [];
  const el = h('div', { class: 'sae' });
  const ligacoes = {}; // codigo NANDA → ligação (cache da tela)
  let aguardandoIA = false;
  const preenchendo = new Set(); // "nanda" ou "nanda|nic" em preenchimento automático (não é salvo)

  // Qualquer mudança depois de concluído volta o PE para revisão.
  const mudou = (imediato = false, { manterStatus = false } = {}) => {
    if (sae.status === 'concluido' && !manterStatus) sae.status = 'em_revisao';
    aoMudar?.(clone(sae), { imediato });
    desenhar();
  };

  async function ligacaoDe(codigo) {
    if (!ligacoes[codigo]) {
      const r = await cat.ligacoes([codigo]);
      ligacoes[codigo] = r.ligacoes[0];
      if (r.versao) sae.versaoLigacoes = r.versao;
    }
    return ligacoes[codigo];
  }

  // ------------------------------------------------------------------ IA
  async function pedirSugestao() {
    if (!navigator.onLine) return aviso('Sem conexão: a sugestão da IA precisa de internet. A evolução continua normalmente.', 'atencao', 7000);
    const resumo = resumoIA();
    if (resumo.length < 80) return aviso('Preencha a avaliação (bloco 2) antes de pedir a sugestão.', 'atencao', 6000);
    if (sae.sugestao?.itens?.some((s) => !s.decisao) && !(await confirmar('Já há sugestões sem decisão. Pedir uma nova sugestão substitui as pendentes.', { sim: 'Pedir nova' }))) return;
    aguardandoIA = true;
    desenhar();
    try {
      const r = await cat.sugerirPE(resumo);
      const jaNoPlano = new Set(sae.diagnosticos.map((d) => d.codigo));
      sae.sugestao = {
        modelo: r.modelo, versaoPrompt: r.versaoPrompt, versaoLigacoes: r.versaoLigacoes || '', emTexto: formatarDataHora(agoraLocalISO()),
        itens: (r.sugestoes || []).map((s) => ({ ...s, decisao: jaNoPlano.has(s.codigo) ? 'ja_no_plano' : '' })),
      };
      aguardandoIA = false;
      const novas = sae.sugestao.itens.filter((s) => !s.decisao).length;
      if (!novas) {
        aviso('A IA não trouxe diagnósticos novos para este paciente.', 'info', 6000);
        mudou(true);
        return;
      }
      sae.status = 'sugerido';
      mudou(true);
      abrirJanela({
        titulo: 'Processo de Enfermagem sugerido',
        conteudo: h('p', {}, `A IA sugeriu ${novas} diagnóstico(s). Nada foi aceito: você revisa cada um.`),
        acoes: [
          { texto: 'Deixar para depois', classe: 'btn-secundario', aoClicar: () => { sae.status = 'pendente'; mudou(true); } },
          { texto: 'Revisar agora', classe: 'btn-primario', aoClicar: () => { sae.status = 'em_revisao'; mudou(true); el.querySelector('.sae-sugestoes')?.scrollIntoView({ behavior: 'smooth' }); } },
        ],
      });
    } catch (e) {
      aguardandoIA = false;
      desenhar();
      aviso(`A IA não respondeu (${e.message}). Faça o PE pela biblioteca; a evolução não foi afetada.`, 'atencao', 9000);
    }
  }

  function decidirSugestao(s, decisao) {
    if (decisao === 'descartado') {
      s.decisao = 'descartado';
      mudou();
      return;
    }
    if (decisao === 'aceito') {
      const erros = validarEvidencias(s.categoria, s.evidencias);
      if (erros.length) {
        aviso(`Complete as evidências antes de aceitar: ${erros.join('; ')}.`, 'atencao', 7000);
        return editarEvidencias({ ...s }, (ev, obs) => aceitar(s, ev, obs, 'ia_editado'));
      }
      return aceitar(s, s.evidencias, '', 'ia_aceito');
    }
    editarEvidencias({ ...s }, (ev, obs) => aceitar(s, ev, obs, 'ia_editado'));
  }
  function aceitar(s, evidencias, observacao, origem) {
    if (sae.diagnosticos.some((d) => d.codigo === s.codigo)) return aviso('Este diagnóstico já está no plano.', 'atencao');
    sae.diagnosticos.push(novoDiagnostico({ ...s, evidencias, observacao }, origem));
    s.decisao = origem === 'ia_aceito' ? 'aceito' : 'editado';
    if (sae.status === 'sugerido' || sae.status === 'pendente' || sae.status === 'nao_iniciado') sae.status = 'em_revisao';
    mudou();
    preencherPadrao(s.codigo);
  }

  // ------------------------------------------------------------------ resultados e intervenções por padrão
  // Ao entrar no plano, o diagnóstico já recebe o NOC principal (com os indicadores
  // sugeridos na tabela de ligações) e a NIC principal (com atividades escolhidas
  // pela IA entre as oficiais). O enfermeiro só ajusta.
  const diagAtual = (codigo) => sae.diagnosticos.find((x) => x.codigo === codigo);
  const novoIndicador = (i, det) => ({
    codigo: i.codigo, texto: i.texto, niveis: det.escalas[i.escala] || det.escalas[det.escala_principal] || [], meta: '', pontuacao: '', anterior: '',
  });

  /** Acrescenta um NOC ligado. Com indicadores sugeridos, já vêm marcados; sem eles, abre a escolha. */
  async function adicionarNoc(codigo, item, { abrirSeVazio = true } = {}) {
    const det = await cat.detalheResultado(item.codigo);
    const d = diagAtual(codigo);
    if (!d || d.noc.some((r) => r.codigo === item.codigo)) return;
    const sug = new Set(item.indicadores_sugeridos || []);
    const r = { codigo: item.codigo, titulo: item.titulo, padrao: true, indicadores: det.indicadores.filter((i) => sug.has(i.codigo)).map((i) => novoIndicador(i, det)) };
    d.noc.push(r);
    mudou();
    if (!r.indicadores.length && abrirSeVazio) escolherIndicadores(d, r);
  }

  /** Acrescenta uma NIC ligada e pede à IA as atividades pertinentes; se a IA falhar, abre a escolha. */
  async function adicionarNic(codigo, item, { abrirSeFalhar = true } = {}) {
    let d = diagAtual(codigo);
    if (!d || d.nic.some((x) => x.codigo === item.codigo)) return;
    d.nic.push({ codigo: item.codigo, titulo: item.titulo, nivel: item.nivel_formacao, padrao: true, atividades: [] });
    const chave = `${codigo}|${item.codigo}`;
    preenchendo.add(chave);
    mudou();
    let falhou = '';
    try {
      const r = await cat.sugerirAtividades(resumoIA(), codigo, item.codigo);
      d = diagAtual(codigo);
      const x = d?.nic.find((n) => n.codigo === item.codigo);
      if (x && !x.atividades.length) {
        x.atividades = (r.atividades || []).map((a) => ({ id: a.id, texto: a.texto, status: '', justificativa: '', sugeridaIA: true }));
        x.modeloIA = r.modelo;
      }
      if (!r.atividades?.length) falhou = 'a IA não indicou atividades';
    } catch (e) {
      falhou = e.message;
    } finally {
      preenchendo.delete(chave);
      mudou();
    }
    if (falhou) {
      aviso(`Atividades de "${item.titulo}": ${falhou}. Escolha na lista.`, 'atencao', 7000);
      const x = diagAtual(codigo)?.nic.find((n) => n.codigo === item.codigo);
      if (x && !x.atividades.length && abrirSeFalhar) escolherAtividades(diagAtual(codigo), x);
    }
  }

  async function preencherPadrao(codigo) {
    preenchendo.add(codigo);
    desenhar();
    try {
      const lig = await ligacaoDe(codigo);
      if (!lig || lig.semLigacoes) return;
      const principal = (lista) => lista.find((x) => x.papel === 'principal') || lista[0];
      const noc = principal(lig.noc);
      const nic = principal(lig.nic);
      preenchendo.delete(codigo);
      await Promise.all([
        noc && adicionarNoc(codigo, noc, { abrirSeVazio: false }),
        nic && adicionarNic(codigo, nic, { abrirSeFalhar: false }),
      ]);
    } catch (e) {
      aviso(`Não foi possível trazer o resultado e a intervenção padrão (${e.message}). Escolha nas opções do diagnóstico.`, 'atencao', 8000);
    } finally {
      preenchendo.delete(codigo);
      desenhar();
    }
  }

  // ------------------------------------------------------------------ evidências (catálogo oficial)
  async function editarEvidencias(base, aoSalvar) {
    const corpo = h('div', {}, h('div', { class: 'carregando' }, h('span', { class: 'giro' }), 'Carregando o diagnóstico…'));
    const janela = abrirJanela({ titulo: base.titulo, conteudo: corpo, acoes: [] });
    let d;
    try {
      d = await cat.detalheDiagnostico(base.codigo);
    } catch (e) {
      corpo.replaceChildren(h('p', {}, e.message));
      return;
    }
    const sel = { cd: new Set(), fr: new Set(), ri: new Set(), pr: new Set(), ca: new Set() };
    for (const k of Object.keys(sel)) for (const i of base.evidencias?.[k] || []) sel[k].add(i.id);
    const obs = h('textarea', { rows: 2, placeholder: 'Observação (opcional, não cria itens fora da taxonomia)' });
    obs.value = base.observacao || '';
    const grupo = (k, titulo, itens) => {
      if (!itens?.length) return null;
      return h('fieldset', { class: 'secao' }, h('legend', {}, titulo),
        itens.map((i) => (i.tipo === 'subtitulo'
          ? h('div', { class: 'sae-subtitulo' }, i.texto)
          : h('label', { class: 'opcao sae-item' },
            h('input', { type: 'checkbox', checked: sel[k].has(i.id), onchange: (e) => (e.target.checked ? sel[k].add(i.id) : sel[k].delete(i.id)) }),
            h('span', {}, i.texto)))));
    };
    const risco = d.categoria === CATEGORIA.risco;
    const erroEl = h('div', { class: 'campo-erro' });
    corpo.replaceChildren(
      h('p', { class: 'ajuda' }, h('strong', {}, `${d.codigo} · ${ROT_CAT[d.categoria] || d.categoria}`), ` — ${d.definicao}`),
      !d.temLigacoes && h('p', { class: 'caixa caixa-atencao' }, 'Este diagnóstico não tem NOC/NIC na tabela de ligações; não será possível planejar resultados e intervenções.'),
      risco ? grupo('ri', 'Fatores de risco', d.fatoresRisco) : grupo('cd', 'Características definidoras', d.caracteristicasDefinidoras),
      d.categoria === CATEGORIA.problema && grupo('fr', 'Fatores relacionados', d.fatoresRelacionados),
      grupo('pr', 'Populações em risco', d.populacoesRisco),
      grupo('ca', 'Condições associadas', d.condicoesAssociadas),
      obs, erroEl,
      h('div', { class: 'linha-acoes' },
        h('button', { class: 'btn btn-secundario', type: 'button', onclick: () => janela.fechar() }, 'Cancelar'),
        h('button', { class: 'btn btn-primario', type: 'button', onclick: () => {
          const pegar = (k, lista) => (lista || []).filter((i) => i.id && sel[k].has(i.id)).map((i) => ({ id: i.id, texto: i.texto }));
          const ev = {
            cd: risco ? [] : pegar('cd', d.caracteristicasDefinidoras), fr: pegar('fr', d.fatoresRelacionados),
            ri: risco ? pegar('ri', d.fatoresRisco) : [], pr: pegar('pr', d.populacoesRisco), ca: pegar('ca', d.condicoesAssociadas),
          };
          const erros = validarEvidencias(d.categoria, ev);
          if (erros.length) { erroEl.textContent = `Para salvar: ${erros.join('; ')}.`; return; }
          janela.fechar();
          aoSalvar(ev, obs.value.trim(), d);
        } }, 'Salvar evidências')));
  }

  // ------------------------------------------------------------------ biblioteca
  function abrirBiblioteca() {
    const busca = h('input', { type: 'search', placeholder: 'Buscar por título, foco ou código', 'aria-label': 'Buscar diagnóstico' });
    let categoria = '';
    const filtros = h('div', { class: 'chips' }, [['', 'Todas'], [CATEGORIA.problema, 'Foco no problema'], [CATEGORIA.risco, 'Risco'], [CATEGORIA.promocao, 'Promoção da saúde']]
      .map(([v, t]) => h('button', { type: 'button', class: `chip-op${v === '' ? ' on' : ''}`, dataset: { v }, onclick: (e) => {
        categoria = v;
        for (const b of filtros.children) b.classList.toggle('on', b.dataset.v === v);
        procurar();
      } }, t)));
    const resultados = h('div', { class: 'sae-resultados' }, h('p', { class: 'ajuda' }, 'Digite pelo menos 2 letras.'));
    const buscar = cat.buscaComPausa(cat.buscarDiagnosticos);
    async function procurar() {
      const t = busca.value.trim();
      if (t.length < 2) return resultados.replaceChildren(h('p', { class: 'ajuda' }, 'Digite pelo menos 2 letras.'));
      resultados.replaceChildren(h('div', { class: 'carregando' }, h('span', { class: 'giro' }), 'Buscando…'));
      try {
        const lista = await buscar(t, { categoria });
        if (!lista.length) return resultados.replaceChildren(h('p', { class: 'ajuda' }, 'Nenhum diagnóstico encontrado.'));
        resultados.replaceChildren(...lista.map((r) => {
          const noPlano = sae.diagnosticos.some((d) => d.codigo === r.codigo);
          return h('button', { type: 'button', class: 'sae-resultado', disabled: noPlano || !r.temLigacoes, onclick: () => {
            janela.fechar();
            editarEvidencias({ ...r, evidencias: {} }, (ev, obs, det) => {
              sae.diagnosticos.push(novoDiagnostico({ ...det, evidencias: ev, observacao: obs }, 'enfermeiro'));
              if (sae.status !== 'concluido') sae.status = 'em_revisao';
              mudou();
              preencherPadrao(det.codigo);
            });
          } },
          h('strong', {}, r.titulo), h('span', {}, `${r.codigo} · ${ROT_CAT[r.categoria] || r.categoria} · ${r.dominio}`),
          noPlano ? h('em', {}, 'Já está no plano') : !r.temLigacoes ? h('em', {}, 'Sem NOC/NIC na tabela de ligações') : null);
        }));
      } catch (e) {
        resultados.replaceChildren(h('p', { class: 'caixa caixa-erro' }, e.message));
      }
    }
    busca.addEventListener('input', procurar);
    const janela = abrirJanela({ titulo: 'Biblioteca de diagnósticos (NANDA-I)', conteudo: h('div', { class: 'formulario' }, busca, filtros, resultados) });
  }

  // ------------------------------------------------------------------ NOC e NIC (restritos às ligações)
  async function escolherIndicadores(d, r) {
    const corpo = h('div', {}, h('div', { class: 'carregando' }, h('span', { class: 'giro' }), 'Carregando o resultado…'));
    const janela = abrirJanela({ titulo: r.titulo, conteudo: corpo });
    try {
      const det = await cat.detalheResultado(r.codigo);
      const lig = await ligacaoDe(d.codigo);
      const sugeridos = new Set(lig?.noc?.find((x) => x.codigo === r.codigo)?.indicadores_sugeridos || []);
      const atuais = new Map((r.indicadores || []).map((i) => [i.codigo, i]));
      const marcados = new Set(atuais.size ? atuais.keys() : sugeridos);
      corpo.replaceChildren(
        h('p', { class: 'ajuda' }, det.definicao),
        !atuais.size && sugeridos.size ? h('p', { class: 'ajuda' }, 'Os indicadores sugeridos pela tabela de ligações vêm marcados; ajuste como quiser.') : null,
        h('div', { class: 'sae-lista-marcar' }, det.indicadores.map((i) => h('label', { class: 'opcao sae-item' },
          h('input', { type: 'checkbox', checked: marcados.has(i.codigo), onchange: (e) => (e.target.checked ? marcados.add(i.codigo) : marcados.delete(i.codigo)) }),
          h('span', {}, i.texto, sugeridos.has(i.codigo) ? h('em', { class: 'sae-sugerido' }, ' sugerido') : null)))),
        h('div', { class: 'linha-acoes' },
          h('button', { class: 'btn btn-secundario', type: 'button', onclick: () => janela.fechar() }, 'Cancelar'),
          h('button', { class: 'btn btn-primario', type: 'button', onclick: () => {
            if (!marcados.size) return aviso('Marque pelo menos um indicador.', 'atencao');
            r.indicadores = det.indicadores.filter((i) => marcados.has(i.codigo)).map((i) => atuais.get(i.codigo) || {
              codigo: i.codigo, texto: i.texto, niveis: det.escalas[i.escala] || det.escalas[det.escala_principal] || [], meta: '', pontuacao: '', anterior: '',
            });
            janela.fechar();
            mudou();
          } }, 'Usar indicadores')));
    } catch (e) {
      corpo.replaceChildren(h('p', {}, e.message));
    }
  }

  async function escolherAtividades(d, x) {
    const corpo = h('div', {}, h('div', { class: 'carregando' }, h('span', { class: 'giro' }), 'Carregando a intervenção…'));
    const janela = abrirJanela({ titulo: x.titulo, conteudo: corpo });
    try {
      const det = await cat.detalheIntervencao(x.codigo);
      const atuais = new Map((x.atividades || []).map((a) => [a.id, a]));
      const marcados = new Set(atuais.keys());
      const filtro = h('input', { type: 'search', placeholder: 'Filtrar atividades', 'aria-label': 'Filtrar atividades' });
      const lista = h('div', { class: 'sae-lista-marcar' }, det.atividades.filter((a) => a.id).map((a) => h('label', { class: 'opcao sae-item', dataset: { texto: a.texto.toLowerCase() } },
        h('input', { type: 'checkbox', checked: marcados.has(a.id), onchange: (e) => (e.target.checked ? marcados.add(a.id) : marcados.delete(a.id)) }),
        h('span', {}, a.texto))));
      filtro.addEventListener('input', () => {
        const t = filtro.value.toLowerCase();
        for (const l of lista.children) l.hidden = t && !l.dataset.texto.includes(t);
      });
      corpo.replaceChildren(
        h('p', { class: 'ajuda' }, det.definicao, ' ', h('strong', {}, `Responsável mínimo: ${responsavel(det.nivel_formacao)}.`)),
        filtro, lista,
        h('div', { class: 'linha-acoes' },
          h('button', { class: 'btn btn-secundario', type: 'button', onclick: () => janela.fechar() }, 'Cancelar'),
          h('button', { class: 'btn btn-primario', type: 'button', onclick: () => {
            if (!marcados.size) return aviso('Marque pelo menos uma atividade.', 'atencao');
            x.atividades = det.atividades.filter((a) => a.id && marcados.has(a.id)).map((a) => atuais.get(a.id) || { id: a.id, texto: a.texto, status: '', justificativa: '' });
            janela.fechar();
            mudou();
          } }, 'Usar atividades')));
    } catch (e) {
      corpo.replaceChildren(h('p', {}, e.message));
    }
  }

  // ------------------------------------------------------------------ desenho
  function chips(opcoes, valor, aoEscolher, extra = '') {
    return h('div', { class: `chips ${extra}` }, Object.entries(opcoes).map(([v, t]) =>
      h('button', { type: 'button', class: `chip-op chip-mini${String(valor) === v ? ' on' : ''}`, disabled: somenteLeitura, onclick: () => aoEscolher(String(valor) === v ? '' : v) }, t)));
  }

  function cartaoSugestao(s) {
    const ev = s.evidencias || {};
    const lista = (t, l) => (l?.length ? h('div', {}, h('strong', {}, `${t}: `), l.map((i) => i.texto).join('; ')) : null);
    return h('div', { class: 'sae-sugestao' },
      h('div', { class: 'sae-sug-topo' }, h('span', { class: 'etiqueta-ia' }, 'Sugestão da IA'), h('strong', {}, s.titulo), h('span', { class: 'ajuda' }, `${s.codigo} · ${ROT_CAT[s.categoria] || s.categoria}`)),
      s.justificativa && h('p', { class: 'sae-just' }, s.justificativa),
      lista('Características definidoras', ev.cd), lista('Fatores relacionados', ev.fr), lista('Fatores de risco', ev.ri),
      !somenteLeitura && h('div', { class: 'linha-acoes' },
        h('button', { class: 'btn btn-primario btn-pequeno', type: 'button', onclick: () => decidirSugestao(s, 'aceito') }, 'Aceitar'),
        h('button', { class: 'btn btn-secundario btn-pequeno', type: 'button', onclick: () => decidirSugestao(s, 'editar') }, 'Revisar evidências e aceitar'),
        h('button', { class: 'btn btn-link btn-pequeno', type: 'button', onclick: () => decidirSugestao(s, 'descartado') }, 'Descartar')));
  }

  function cartaoDiagnostico(d, k) {
    const total = sae.diagnosticos.length;
    const mover = (delta) => {
      const j = k + delta;
      if (j < 0 || j >= total) return;
      [sae.diagnosticos[k], sae.diagnosticos[j]] = [sae.diagnosticos[j], sae.diagnosticos[k]];
      mudou();
    };
    const ativo = d.situacao !== 'resolvido';
    const secaoNoc = h('div', { class: 'sae-secao' }, h('h4', {}, 'Resultados esperados (NOC) e pontuação de hoje'));
    const secaoNic = h('div', { class: 'sae-secao' }, h('h4', {}, 'Intervenções (NIC) e atividades realizadas'));
    if (ativo) {
      // Opções vêm da tabela de ligações (carregadas sob demanda e guardadas na tela).
      const opcoesNoc = h('div', { class: 'chips' });
      const opcoesNic = h('div', { class: 'chips' });
      const botao = (item, tipo) => {
        const on = d[tipo].some((e) => e.codigo === item.codigo);
        return h('button', { type: 'button', class: `chip-op chip-mini${on ? ' on' : ''}`, onclick: async () => {
          if (on) {
            if (!(await confirmar(`Retirar "${item.titulo}" do plano deste diagnóstico?`, { sim: 'Retirar' }))) return;
            d[tipo] = d[tipo].filter((e) => e.codigo !== item.codigo);
            return mudou();
          }
          try {
            if (tipo === 'noc') await adicionarNoc(d.codigo, item); else await adicionarNic(d.codigo, item);
          } catch (e) {
            aviso(e.message, 'erro');
          }
        } }, `${on ? '✓ ' : '+ '}${item.titulo}${item.papel === 'principal' ? ' (principal)' : ''}`);
      };
      const preencherOpcoes = (lig) => {
        if (!lig || lig.semLigacoes) {
          opcoesNoc.replaceChildren(h('span', { class: 'caixa caixa-atencao' }, 'Sem NOC na tabela de ligações para este diagnóstico.'));
          opcoesNic.replaceChildren(h('span', { class: 'caixa caixa-atencao' }, 'Sem NIC na tabela de ligações para este diagnóstico.'));
          return;
        }
        opcoesNoc.replaceChildren(...lig.noc.map((x) => botao(x, 'noc')));
        opcoesNic.replaceChildren(...lig.nic.map((x) => botao(x, 'nic')));
      };
      if (!somenteLeitura) {
        secaoNoc.append(opcoesNoc);
        secaoNic.append(opcoesNic);
        if (ligacoes[d.codigo]) preencherOpcoes(ligacoes[d.codigo]);
        else {
          opcoesNoc.append(h('span', { class: 'ajuda' }, 'Carregando opções…'));
          ligacaoDe(d.codigo).then(preencherOpcoes).catch((e) => {
            opcoesNoc.replaceChildren(h('span', { class: 'campo-erro' }, `Não foi possível carregar as ligações: ${e.message}`));
          });
        }
      }
      if (preenchendo.has(d.codigo)) secaoNoc.append(h('p', { class: 'sae-preenchendo' }, h('span', { class: 'giro' }), 'Trazendo o resultado e a intervenção principais…'));
      for (const r of d.noc) {
        secaoNoc.append(h('div', { class: 'sae-noc' },
          h('div', { class: 'sae-noc-topo' }, h('strong', {}, r.titulo), !somenteLeitura && h('button', { type: 'button', class: 'btn btn-link btn-pequeno', onclick: () => escolherIndicadores(d, r) }, 'Escolher indicadores')),
          ...(r.indicadores || []).map((i) => {
            const niveis = Object.fromEntries((i.niveis || []).map((t, n) => [String(n + 1), `${n + 1} · ${t}`]));
            return h('div', { class: 'sae-indicador' },
              h('div', { class: 'sae-ind-texto' }, i.texto, i.anterior ? h('span', { class: 'ajuda' }, ` · anterior: ${i.anterior === 'NA' ? 'não avaliado' : i.anterior}`) : null),
              h('div', { class: 'sae-ind-linha' },
                h('label', { class: 'mini' }, 'Meta', h('select', { disabled: somenteLeitura, onchange: (e) => { i.meta = e.target.value; mudou(); } },
                  h('option', { value: '' }, '—'), Object.keys(niveis).map((v) => h('option', { value: v, selected: i.meta === v }, v)))),
                h('div', { class: 'mini' }, 'Hoje', chips({ ...niveis, NA: 'Não avaliado' }, i.pontuacao, (v) => { i.pontuacao = v; mudou(); }, 'sae-escala'))));
          }),
          !(r.indicadores || []).length && h('p', { class: 'campo-erro' }, 'Escolha os indicadores.')));
      }
      for (const x of d.nic) {
        secaoNic.append(h('div', { class: 'sae-nic' },
          h('div', { class: 'sae-noc-topo' }, h('strong', {}, x.titulo), h('span', { class: 'chip' }, responsavel(x.nivel)),
            !somenteLeitura && h('button', { type: 'button', class: 'btn btn-link btn-pequeno', onclick: () => escolherAtividades(d, x) }, 'Escolher atividades')),
          ...(x.atividades || []).map((a) => h('div', { class: 'sae-atividade' },
            h('div', {}, a.texto, a.sugeridaIA ? h('span', { class: 'etiqueta-ia etiqueta-mini', title: 'Atividade marcada pela IA; altere se não se aplicar' }, 'IA') : null),
            chips(STATUS_ATIVIDADE, a.status, (v) => { a.status = v; mudou(); }),
            a.status === 'nao_realizado' && h('input', { type: 'text', value: a.justificativa || '', placeholder: 'Justificativa (obrigatória)', disabled: somenteLeitura,
              onchange: (e) => { a.justificativa = e.target.value; mudou(); } }))),
          !(x.atividades || []).length && (preenchendo.has(`${d.codigo}|${x.codigo}`)
            ? h('p', { class: 'sae-preenchendo' }, h('span', { class: 'giro' }), 'A IA está escolhendo as atividades…')
            : h('p', { class: 'campo-erro' }, 'Escolha as atividades.'))));
      }
    }
    return h('article', { class: `sae-diagnostico${ativo ? '' : ' resolvido'}${d.confirmado ? '' : ' a-confirmar'}` },
      h('div', { class: 'sae-diag-topo' },
        h('span', { class: 'sae-prioridade', title: 'Prioridade' }, k + 1),
        h('div', { class: 'sae-diag-titulo' }, h('strong', {}, d.titulo), h('span', { class: 'ajuda' }, `${d.codigo} · ${ROT_CAT[d.categoria] || d.categoria} · ${ORIGEM[d.origem] || ''}`)),
        !somenteLeitura && h('div', { class: 'sae-ordem' },
          h('button', { type: 'button', class: 'btn-icone', 'aria-label': 'Subir prioridade', disabled: k === 0, onclick: () => mover(-1) }, '▲'),
          h('button', { type: 'button', class: 'btn-icone', 'aria-label': 'Descer prioridade', disabled: k === total - 1, onclick: () => mover(1) }, '▼'))),
      !d.confirmado && !somenteLeitura && h('div', { class: 'caixa caixa-atencao sae-confirmar' }, 'Diagnóstico do plano anterior: confirme hoje.',
        h('button', { type: 'button', class: 'btn btn-primario btn-pequeno', onclick: () => { d.confirmado = true; d.situacao = 'ativo'; mudou(); } }, 'Continua ativo'),
        h('button', { type: 'button', class: 'btn btn-secundario btn-pequeno', onclick: () => { d.confirmado = true; d.situacao = 'resolvido'; mudou(); } }, 'Resolvido')),
      h('p', { class: 'sae-enunciado' }, enunciado(d), d.observacao ? h('em', {}, ` (${d.observacao})`) : null),
      !somenteLeitura && h('div', { class: 'linha-acoes' },
        h('button', { type: 'button', class: 'btn btn-link btn-pequeno', onclick: () => editarEvidencias(d, (ev, obs) => { d.evidencias = ev; d.observacao = obs; if (d.origem === 'ia_aceito') d.origem = 'ia_editado'; mudou(); }) }, 'Editar evidências'),
        d.confirmado && h('button', { type: 'button', class: 'btn btn-link btn-pequeno', onclick: () => { d.situacao = ativo ? 'resolvido' : 'ativo'; mudou(); } }, ativo ? 'Marcar como resolvido' : 'Reativar'),
        (d.origem !== 'plano_anterior') && h('button', { type: 'button', class: 'btn btn-link btn-pequeno', onclick: async () => {
          if (!(await confirmar(`Retirar "${d.titulo}" do plano? (para um diagnóstico de dias anteriores, prefira "Marcar como resolvido")`, { sim: 'Retirar', perigo: true }))) return;
          sae.diagnosticos.splice(k, 1);
          const s = sae.sugestao?.itens?.find((x) => x.codigo === d.codigo);
          if (s) s.decisao = 'descartado';
          mudou();
        } }, 'Retirar')),
      ativo && secaoNoc, ativo && secaoNic,
      ativo && h('div', { class: 'sae-secao' }, h('h4', {}, 'Avaliação do dia'),
        chips(DECISOES, d.decisao, (v) => { d.decisao = v; mudou(); }),
        d.decisao === 'modificar' && h('input', { type: 'text', value: d.decisaoMotivo || '', placeholder: 'O que muda e por quê (obrigatório)', disabled: somenteLeitura,
          onchange: (e) => { d.decisaoMotivo = e.target.value; mudou(); } })));
  }

  function desenhar() {
    // Redesenhar não pode mover a tela: guarda a rolagem e segura a altura durante a troca.
    const y = window.scrollY;
    if (el.isConnected && el.offsetHeight) el.style.minHeight = `${el.offsetHeight}px`;
    montar();
    el.style.minHeight = '';
    if (el.isConnected && window.scrollY !== y) window.scrollTo(0, y);
  }

  function montar() {
    const pendentesIA = (sae.sugestao?.itens || []).filter((s) => !s.decisao);
    const decididas = (sae.sugestao?.itens || []).filter((s) => s.decisao);
    const riscos = avisosRisco(dadosEvolucao(), sae);
    limpar(el).append(...[
      h('div', { class: 'sae-topo' },
        h('span', { class: `situacao sae-status-${sae.status}` }, ROTULO_STATUS_PE[sae.status] || sae.status),
        !somenteLeitura && h('button', { type: 'button', class: 'btn btn-ia', disabled: aguardandoIA, onclick: pedirSugestao },
          aguardandoIA ? 'A IA está analisando… (pode continuar a evolução)' : sae.sugestao ? 'Pedir nova sugestão da IA' : 'Sugerir PE com IA'),
        !somenteLeitura && h('button', { type: 'button', class: 'btn btn-secundario', onclick: abrirBiblioteca }, '+ Diagnóstico da biblioteca')),
      sae.sugestao && h('p', { class: 'ajuda' }, `Sugestão de ${sae.sugestao.emTexto} · modelo ${sae.sugestao.modelo} · prompt ${sae.sugestao.versaoPrompt}`),
      riscos.length ? h('div', { class: 'caixa caixa-atencao' }, h('strong', {}, 'Confira:'), h('ul', {}, riscos.map((r) => h('li', {}, r.texto)))) : null,
      pendentesIA.length ? h('section', { class: 'sae-sugestoes' }, h('h3', {}, `Sugestões da IA para revisar (${pendentesIA.length})`), ...pendentesIA.map(cartaoSugestao)) : null,
      decididas.length ? h('details', { class: 'sae-decididas' }, h('summary', {}, `Sugestões já decididas (${decididas.length})`),
        h('ul', {}, decididas.map((s) => h('li', {}, `${s.titulo}: ${({ aceito: 'aceita sem edição', editado: 'aceita com edição', descartado: 'descartada', ja_no_plano: 'já estava no plano' })[s.decisao]}`)))) : null,
      h('h3', {}, `Plano de cuidados (${sae.diagnosticos.length} diagnóstico${sae.diagnosticos.length === 1 ? '' : 's'})`),
      sae.diagnosticos.length ? null : h('p', { class: 'vazio' }, 'Nenhum diagnóstico no plano. Use "Sugerir PE com IA" ou a biblioteca.'),
      ...sae.diagnosticos.map(cartaoDiagnostico),
      !somenteLeitura && h('div', { class: 'sae-concluir' },
        sae.status === 'concluido'
          ? h('div', { class: 'caixa caixa-ok' }, 'Processo de Enfermagem concluído. Qualquer alteração volta o PE para revisão.')
          : h('button', { type: 'button', class: 'btn btn-primario', onclick: concluir }, 'Concluir Processo de Enfermagem')),
    ].filter(Boolean));
  }

  function concluir() {
    const erros = validarConclusao(sae);
    if (erros.length) {
      abrirJanela({ titulo: 'Falta para concluir o PE', conteudo: h('ul', {}, erros.map((e) => h('li', {}, e))), acoes: [{ texto: 'Entendi', classe: 'btn-primario' }] });
      return;
    }
    sae.status = 'concluido';
    sae.concluidoEmTexto = formatarDataHora(agoraLocalISO());
    mudou(true, { manterStatus: true });
    aviso('Processo de Enfermagem concluído.', 'ok');
  }

  desenhar();
  return {
    el,
    dados: () => clone(sae),
    definirDados(novo) {
      sae = clone(novo) || {};
      sae.status ||= 'nao_iniciado';
      sae.diagnosticos ||= [];
      desenhar();
    },
    atualizar: desenhar,
  };
}
