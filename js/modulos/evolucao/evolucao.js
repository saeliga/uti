// Tela da evolução de enfermagem: bloco 2 (avaliação), blocos 3 a 5 (Processo de Enfermagem) e bloco 6.
// Um rascunho por paciente e turno, salvo por subbloco enquanto se digita.

import { backend } from '../../dados/backend.js';
import { estado, podeEditar } from '../../nucleo/estado.js';
import { h, limpar, carregando, aviso, abrirJanela, confirmar, campo, lerFormulario, mostrarErros } from '../../nucleo/ui.js';
import { BLOCOS, contextoEvolucao } from '../../regras/evolucao-esquema.js';
import {
  validarFinalizacao, pendenciasAutomaticas, situacaoEvolucao, ROTULO_SITUACAO, textoParaPEP,
  resumoSubbloco, subblocoRegistrado, dadosIniciais,
} from '../../regras/evolucao.js';
import { diaAssistencial, diaAnterior, rotuloDia, idEvolucao, turnoDe, TURNOS } from '../../regras/turnos.js';
import { agoraLocalISO, formatarData, formatarDataHora, idade, contagemDia, somarDias } from '../../regras/datas.js';
import { ISOLAMENTOS } from '../../regras/opcoes.js';
import { formularioSubbloco } from './formulario.js';
import { painelSAE } from '../sae/sae.js';
import { resumoParaIA, anonimizarParaIA } from '../../regras/sae.js';

const horaAgora = () => agoraLocalISO().slice(11, 16);
// Redesenha a tela pelo roteador (sem recarregar a página: no modo demonstração, recarregar apagaria tudo).
const redesenhar = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
const autor = () => ({ nome: estado.perfil.nome, coren: estado.perfil.coren });

/** Procura a evolução mais recente antes do dia informado (até 3 dias para trás). */
async function buscarAnterior(internacaoId, data) {
  let d = data;
  for (let i = 0; i < 3; i++) {
    d = diaAnterior(d);
    const ev = await backend.lerEvolucao(idEvolucao(internacaoId, d)).catch(() => null);
    if (ev) return ev;
  }
  return null;
}

export async function telaEvolucao(conteudo, { internacaoId, data }) {
  carregando(conteudo, 'Abrindo a evolução…');
  const dia = data || diaAssistencial();
  const id = idEvolucao(internacaoId, dia);
  let internacao;
  let anterior;
  let ev;
  try {
    internacao = await backend.lerInternacao(internacaoId);
    if (!internacao) throw new Error('Internação não encontrada.');
    anterior = await buscarAnterior(internacaoId, dia);
    ev = await backend.lerEvolucao(id);
    if (!ev) {
      if (internacao.status !== 'ativa' || !podeEditar()) throw new Error('Não há evolução registrada neste dia.');
      // Já nasce com o que continua do dia anterior: pendências abertas, limitação e objetivo
      // de cuidado, pele e lesões, dispositivos ativos, antimicrobianos, plano do PE e última evacuação.
      const dados = dadosIniciais(anterior);
      ev = await backend.abrirEvolucao(id, {
        internacaoId, unidade: internacao.unidade, leitoId: internacao.leitoId, data: dia, turnoInicio: turnoDe(), dados,
      });
    }
  } catch (e) {
    limpar(conteudo).append(h('div', { class: 'vazio' }, h('p', {}, e.message),
      h('a', { class: 'btn btn-secundario', href: `#/${internacao?.unidade || ''}` }, 'Voltar ao painel')));
    return () => {};
  }

  const unidadeNome = estado.unidades.find((u) => u.id === ev.unidade)?.nome || ev.unidade;
  backend.registrarEvento?.('evolucao_aberta', { evolucaoId: id, unidade: ev.unidade }); // registro de acesso (LGPD)
  const formularios = {};
  const timers = {};
  const editadoEm = {};
  let pendentes = 0;
  let blocoAtual = sessionStorage.getItem(`bloco_${id}`) || 'b2';

  const ro = () => ev.status === 'finalizada' || !podeEditar();
  const dadosDosFormularios = () => Object.fromEntries(Object.entries(formularios).map(([k, f]) => [k, f.dados()]));
  // `herdado` (data da última evacuação, subblocos que vieram da anterior) não é formulário.
  const ctx = () => ({
    ...contextoEvolucao({ herdado: ev.dados?.herdado, ...dadosDosFormularios() }, ev.data),
    // Para componentes que abrem outros registros (ex.: check-list de inserção do dispositivo).
    internacao, unidade: { id: ev.unidade, nome: unidadeNome }, leitoNum: String(ev.leitoId).split('_')[1],
  });
  const herdadoDe = (sid) => (ev.dados?.herdado?.subblocos || []).includes(sid);

  // ------------------------------------------------------------------ cabeçalho fixo
  const indicador = h('span', { class: 'salvamento', 'aria-live': 'polite' });
  const situacaoEl = h('span', { class: 'situacao' });
  const avisoOutro = h('div', { class: 'faixa-outro-aparelho', hidden: true });
  const p = internacao.paciente;
  const al = internacao.alergias;
  // Precaução/isolamento: pode ser alterada daqui (vale para a internação e o painel).
  const chipIsolamento = h('button', { type: 'button', class: 'chip chip-isolamento chip-botao', title: 'Alterar precaução/isolamento', onclick: () => alterarIsolamento() });
  const desenharIsolamento = () => {
    const t = internacao.isolamento?.tipo || 'padrao';
    chipIsolamento.textContent = `${t === 'padrao' ? 'Precaução padrão' : `Isolamento: ${ISOLAMENTOS[t].replace(/ \(.*\)$/, '')}`}${podeEditar() && internacao.status === 'ativa' ? ' · alterar' : ''}`;
    chipIsolamento.disabled = !(podeEditar() && internacao.status === 'ativa');
  };
  desenharIsolamento();
  function alterarIsolamento() {
    const form = h('form', { class: 'formulario', novalidate: true },
      campo({ nome: 'tipo', rotulo: 'Precaução / isolamento', tipo: 'select', opcoes: ISOLAMENTOS, valor: internacao.isolamento?.tipo || 'padrao', obrigatorio: true }),
      campo({ nome: 'motivo', rotulo: 'Motivo', valor: internacao.isolamento?.motivo || '' }));
    const sinc = () => { form.querySelector('[data-campo=motivo]').hidden = lerFormulario(form).tipo === 'padrao'; };
    form.addEventListener('change', sinc);
    sinc();
    abrirJanela({
      titulo: 'Alterar precaução / isolamento',
      conteudo: form,
      acoes: [
        { texto: 'Cancelar', classe: 'btn-secundario' },
        { texto: 'Salvar', classe: 'btn-primario', aoClicar: async () => {
          const d = lerFormulario(form);
          const iso = { tipo: d.tipo, motivo: d.tipo === 'padrao' ? '' : d.motivo.trim() };
          const erros = {};
          if (!iso.tipo) erros.tipo = 'Escolha a precaução.';
          if (iso.tipo && iso.tipo !== 'padrao' && !iso.motivo) erros.motivo = 'Informe o motivo do isolamento.';
          if (!mostrarErros(form, erros)) return false;
          try {
            await backend.alterarIsolamento(internacao.id, iso);
            internacao.isolamento = iso;
            internacao.versao = (internacao.versao || 1) + 1;
            desenharIsolamento();
            aviso('Precaução/isolamento atualizado.', 'ok');
          } catch (e) {
            aviso(e.message, 'erro');
            return false;
          }
        } },
      ],
    });
  }
  const leitoNum = String(ev.leitoId).split('_')[1];
  // Celular e tablet em pé: cabeçalho compacto, com os detalhes num toque (ver CSS).
  const botaoMais = h('button', { type: 'button', class: 'btn-icone evo-mais', 'aria-expanded': 'false', 'aria-label': 'Mostrar detalhes do paciente', onclick: () => {
    const aberto = cabecalho.classList.toggle('aberto');
    botaoMais.setAttribute('aria-expanded', String(aberto));
    botaoMais.textContent = aberto ? '▴' : '▾';
  } }, '▾');
  const cabecalho = h('div', { class: 'evo-cabecalho' },
    h('div', { class: 'evo-paciente' },
      h('a', { href: `#/${ev.unidade}`, class: 'btn btn-link btn-pequeno evo-voltar', 'aria-label': 'Voltar ao painel' }, h('span', { class: 'evo-voltar-seta' }, '←'), h('span', { class: 'evo-voltar-texto' }, ' Painel')),
      h('div', { class: 'evo-quem' },
        h('div', { class: 'evo-nome' }, p.nome, h('span', { class: 'evo-curto' }, ` Leito ${leitoNum} · UTI ${contagemDia(internacao.admissaoUti, ev.data)} · ${idade(p.dataNascimento, ev.data)} anos`)),
        h('div', { class: 'evo-ident' }, `${idade(p.dataNascimento, ev.data)} anos · nasc. ${formatarData(p.dataNascimento)} · Reg. ${p.registro} · ${unidadeNome} leito ${String(ev.leitoId).split('_')[1]} · UTI ${contagemDia(internacao.admissaoUti, ev.data)}`)),
      h('div', { class: 'evo-alertas' },
        al?.situacao === 'possui' ? h('span', { class: 'chip chip-alerta' }, '⚠ ALERGIA: ', al.descricao) : h('span', { class: 'chip' }, al?.situacao === 'nega' ? 'Nega alergias' : 'Alergias: sem informação'),
        chipIsolamento),
      botaoMais),
    h('div', { class: 'evo-turno' }, h('strong', {}, rotuloDia(ev.data)), ev.turnoInicio && h('span', { class: 'ajuda evo-iniciada' }, `iniciada no turno da ${TURNOS[ev.turnoInicio].nome.toLowerCase()}`), situacaoEl, indicador),
    avisoOutro);

  // Evolução da admissão: sempre disponível para consulta.
  (async () => {
    if (!internacao.admissaoUti) return;
    let d = diaAssistencial(new Date(internacao.admissaoUti));
    for (let k = 0; k < 4 && d <= ev.data; k++, d = somarDias(d, 1)) {
      const primeira = d === ev.data ? ev : await backend.lerEvolucao(idEvolucao(internacaoId, d)).catch(() => null);
      if (primeira) {
        if (primeira.id === ev.id || d === ev.data) return;
        const botao = h('button', { type: 'button', class: 'btn btn-link btn-pequeno', onclick: () => {
          const area = h('textarea', { class: 'texto-pep', readonly: true, rows: 20 });
          area.value = textoParaPEP(primeira, internacao, { unidadeNome });
          abrirJanela({
            titulo: `Evolução da admissão (${rotuloDia(primeira.data)})`,
            conteudo: h('div', {}, h('p', { class: 'ajuda' }, `Situação: ${ROTULO_SITUACAO[situacaoEvolucao(primeira)]}. Somente consulta.`), area),
            acoes: [
              { texto: 'Abrir a evolução completa', classe: 'btn-secundario', aoClicar: () => { location.hash = `#/evolucao/${internacaoId}/${primeira.data}`; } },
              { texto: 'Fechar', classe: 'btn-primario' },
            ],
          });
        } }, 'Evolução da admissão');
        botao.classList.add('evo-admissao');
        cabecalho.querySelector('.evo-turno').append(botao);
        return;
      }
    }
  })();

  // ------------------------------------------------------------------ navegação por blocos
  const navegacao = h('nav', { class: 'evo-nav', 'aria-label': 'Blocos da evolução' });
  const ABAS = [
    ...BLOCOS.filter((b) => b.id !== 'b6').map((b) => [b.id, b.titulo]),
    ['b345', '3 a 5. Processo de Enfermagem'],
    ['b6', BLOCOS.find((b) => b.id === 'b6').titulo],
    ['fim', 'Finalizar e copiar ao PEP'],
  ];
  const corpo = h('div', { class: 'evo-corpo' });

  function abrirBloco(bid) {
    blocoAtual = bid;
    try { sessionStorage.setItem(`bloco_${id}`, bid); } catch { /* sem armazenamento */ }
    for (const b of navegacao.children) b.setAttribute('aria-current', String(b.dataset.id === bid));
    for (const s of corpo.children) s.hidden = s.dataset.bloco !== bid;
    if (bid === 'fim') desenharFim();
    if (bid === 'b345') formularios.sae?.atualizar();
    window.scrollTo({ top: 0 });
  }
  for (const [bid, t] of ABAS) navegacao.append(h('button', { type: 'button', class: 'evo-aba', dataset: { id: bid }, onclick: () => abrirBloco(bid) }, t));

  // ------------------------------------------------------------------ salvamento
  function marcarSalvando() {
    pendentes += 1;
    indicador.className = 'salvamento salvando';
    indicador.textContent = 'Salvando…';
  }
  function marcarSalvo(ok, erro) {
    pendentes = Math.max(0, pendentes - 1);
    if (pendentes) return;
    if (ok) {
      indicador.className = 'salvamento salvo';
      indicador.textContent = `✓ Salvo às ${horaAgora()}`;
    } else {
      indicador.className = 'salvamento erro';
      indicador.textContent = `Não salvo: ${erro}`;
    }
  }
  function agendarSalvar(subId, imediato = false) {
    editadoEm[subId] = Date.now();
    clearTimeout(timers[subId]);
    const salvar = () => {
      marcarSalvando();
      if (!navigator.onLine) {
        indicador.className = 'salvamento offline';
        indicador.textContent = 'Salvo neste aparelho · ainda não sincronizado';
      }
      backend.salvarSubbloco(id, subId, formularios[subId].dados(), ev.confirmados?.[subId] || null)
        .then(() => marcarSalvo(true), (e) => marcarSalvo(false, e.message));
    };
    if (imediato) salvar(); else timers[subId] = setTimeout(salvar, 700);
  }

  // ------------------------------------------------------------------ subblocos
  const estadosSub = {};
  function atualizarEstadoSub(sid) {
    const el = estadosSub[sid];
    if (!el) return;
    const conf = ev.confirmados?.[sid];
    const atual = { ...ev, dados: { ...(ev.dados || {}), [sid]: formularios[sid].dados() } };
    if (herdadoDe(sid)) {
      el.className = 'sub-estado herdado';
      el.textContent = `↻ Herdado de ${formatarData(ev.dados.herdado.de)} · confira`;
      return;
    }
    el.className = `sub-estado ${conf ? 'confirmado' : subblocoRegistrado(atual, sid) ? 'preenchido' : 'vazio'}`;
    el.textContent = conf ? `Sem alteração · confirmado às ${conf.hora}` : subblocoRegistrado(atual, sid) ? 'Registrado' : 'Sem registro';
  }

  function cartaoSubbloco(s) {
    const anteriorTexto = anterior ? resumoSubbloco(s.id, anterior.dados || {}, anterior.data) : '';
    const form = formularioSubbloco(s, {
      dados: ev.dados?.[s.id] || {},
      contexto: ctx,
      somenteLeitura: ro(),
      aoMudar: () => {
        if (ev.confirmados?.[s.id]) {
          // Alterou um campo: deixa de ser "sem alteração".
          ev.confirmados = { ...ev.confirmados };
          delete ev.confirmados[s.id];
        }
        if (herdadoDe(s.id)) {
          // Editou um subbloco herdado: passa a ser registro deste dia.
          ev.dados = { ...ev.dados, herdado: { ...ev.dados.herdado, subblocos: ev.dados.herdado.subblocos.filter((x) => x !== s.id) } };
          backend.salvarSubbloco(id, 'herdado', ev.dados.herdado, null).catch(() => {});
          corpo.querySelector(`[data-sub="${s.id}"] .sub-herdado`)?.remove();
        }
        atualizarEstadoSub(s.id);
        // Peso e dispositivos mudam cálculos de outros subblocos.
        if (['dispositivos', 'respiratorio', 'renal'].includes(s.id)) for (const f of Object.values(formularios)) f.atualizar();
        agendarSalvar(s.id);
      },
    });
    formularios[s.id] = form;
    estadosSub[s.id] = h('span', { class: 'sub-estado' });

    const semAlteracao = s.copiavel && !herdadoDe(s.id) && anterior?.dados?.[s.id] && !ro() && h('button', {
      type: 'button', class: 'btn btn-secundario btn-pequeno',
      onclick: async () => {
        if (subblocoRegistrado({ dados: { [s.id]: form.dados() } }, s.id)
          && !(await confirmar('Substituir o que já foi preenchido neste subbloco pelos dados da evolução anterior?', { sim: 'Substituir' }))) return;
        form.definirDados(anterior.dados[s.id]);
        ev.confirmados = { ...(ev.confirmados || {}), [s.id]: { hora: horaAgora(), por: estado.perfil.uid, porNome: estado.perfil.nome } };
        atualizarEstadoSub(s.id);
        for (const f of Object.values(formularios)) f.atualizar();
        agendarSalvar(s.id, true);
      },
    }, 'Sem alteração desde a evolução anterior');

    const det = h('details', { class: 'subbloco', open: true, dataset: { sub: s.id } },
      h('summary', {}, h('span', { class: 'sub-titulo' }, s.titulo, s.obrigatorio && h('span', { class: 'obrigatorio', title: 'Obrigatório para finalizar' }, ' *')), estadosSub[s.id]),
      s.descricao && h('p', { class: 'sub-descricao' }, s.descricao),
      anterior && h('div', { class: 'sub-anterior' },
        h('div', { class: 'sub-anterior-titulo' }, `Evolução anterior (${rotuloDia(anterior.data)})`),
        h('div', { class: 'sub-anterior-texto' }, anteriorTexto || 'Sem registro.'),
        s.copiavel === false && anteriorTexto && h('div', { class: 'campo-ajuda' }, 'Este subbloco precisa de valores novos a cada evolução.'),
        semAlteracao),
      herdadoDe(s.id) && !ro() && h('div', { class: 'linha-acoes sub-herdado' },
        h('span', { class: 'ajuda' }, 'Veio preenchido da evolução anterior. Altere o que mudou ou confirme.'),
        h('button', { type: 'button', class: 'btn btn-secundario btn-pequeno', onclick: (e) => {
          ev.dados = { ...ev.dados, herdado: { ...ev.dados.herdado, subblocos: ev.dados.herdado.subblocos.filter((x) => x !== s.id) } };
          ev.confirmados = { ...(ev.confirmados || {}), [s.id]: { hora: horaAgora(), por: estado.perfil.uid, porNome: estado.perfil.nome } };
          backend.salvarSubbloco(id, 'herdado', ev.dados.herdado, null).catch(() => {});
          agendarSalvar(s.id, true);
          atualizarEstadoSub(s.id);
          e.currentTarget.parentElement.remove();
        } }, 'Conferido, sem alteração')),
      form.el);
    atualizarEstadoSub(s.id);
    return det;
  }

  // Botões no fim de cada bloco: seguir sem precisar voltar ao topo da tela.
  const navegacaoRodape = (bid) => {
    const k = ABAS.findIndex((a) => a[0] === bid);
    const ant = ABAS[k - 1];
    const prox = ABAS[k + 1];
    return h('div', { class: 'evo-rodape-nav' },
      ant ? h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => abrirBloco(ant[0]) }, `← ${ant[1]}`) : h('span'),
      prox ? h('button', { type: 'button', class: 'btn btn-primario', onclick: () => abrirBloco(prox[0]) }, `Próximo: ${prox[1]} →`) : h('span'));
  };
  for (const b of BLOCOS) {
    corpo.append(h('section', { class: 'evo-bloco', dataset: { bloco: b.id }, hidden: true },
      h('h2', {}, b.titulo), b.descricao && h('p', { class: 'ajuda' }, b.descricao),
      ...b.subblocos.map(cartaoSubbloco), navegacaoRodape(b.id)));
  }
  // Blocos 3 a 5: Processo de Enfermagem. Fica em dados.sae, salvo como mais um "subbloco".
  const textoParaIA = () => {
    const dados = evolucaoAtual().dados;
    const partes = BLOCOS.flatMap((b) => b.subblocos)
      .filter((s) => !['narrativa', 'pendencias'].includes(s.id)) // texto livre pode conter nomes
      .map((s) => [s.titulo, resumoSubbloco(s.id, dados, ev.data)])
      .filter(([, t]) => t)
      .map(([t, r]) => `${t}: ${r}.`);
    const iso = internacao.isolamento?.tipo;
    // Tira do texto qualquer identificação que tenha escapado nos campos livres.
    return anonimizarParaIA(resumoParaIA({
      idade: idade(p.dataNascimento, ev.data),
      diagnosticoMedico: internacao.diagnosticoMedico,
      comorbidades: internacao.comorbidades,
      isolamento: iso && iso !== 'padrao' ? ISOLAMENTOS[iso] : '',
      textoSubblocos: partes.join('\n'),
    }), { nome: p.nome, registro: p.registro, nascimento: p.dataNascimento });
  };
  const sae = painelSAE({
    dados: ev.dados?.sae,
    somenteLeitura: ro(),
    dadosEvolucao: () => evolucaoAtual().dados,
    resumoIA: textoParaIA,
    aoMudar: (_, { imediato }) => agendarSalvar('sae', imediato),
  });
  formularios.sae = sae;
  corpo.append(h('section', { class: 'evo-bloco', dataset: { bloco: 'b345' }, hidden: true },
    h('h2', {}, '3 a 5. Processo de Enfermagem'),
    h('p', { class: 'ajuda' }, 'Diagnósticos (NANDA-I), resultados (NOC) e intervenções (NIC) somente das ligações aprovadas. A IA sugere; o enfermeiro decide cada item.'),
    h('div', { dataset: { sub: 'sae' } }, sae.el),
    navegacaoRodape('b345')));
  const fim = h('section', { class: 'evo-bloco', dataset: { bloco: 'fim' }, hidden: true });
  corpo.append(fim);

  // ------------------------------------------------------------------ finalizar, PEP, imprimir
  function desenharFim() {
    const atual = evolucaoAtual();
    const { erros, avisos } = validarFinalizacao(atual);
    const sit = situacaoEvolucao(ev);
    limpar(fim).append(...[
      h('h2', {}, 'Finalizar e copiar ao PEP'),
      ev.status === 'rascunho' && h('div', {},
        erros.length ? h('div', { class: 'caixa caixa-erro' }, h('strong', {}, 'Falta para finalizar:'), h('ul', {}, erros.map((e) => h('li', {}, e))))
          : h('div', { class: 'caixa caixa-ok' }, 'Todos os itens obrigatórios estão preenchidos.'),
        avisos.length ? h('div', { class: 'caixa caixa-atencao' }, h('strong', {}, 'Confira antes de finalizar:'), h('ul', {}, avisos.map((a) => h('li', {}, a)))) : null,
        ev.retificacao && h('p', { class: 'ajuda' }, `Retificação em andamento (versão ${ev.versao}): ${ev.retificacao.motivo}`),
        podeEditar() && h('button', { class: 'btn btn-primario', type: 'button', disabled: erros.length > 0, onclick: finalizar }, 'Finalizar evolução')),
      ev.status === 'finalizada' && h('div', {},
        h('div', { class: `caixa ${sit === 'transcrita' ? 'caixa-ok' : 'caixa-atencao'}` },
          h('strong', {}, ROTULO_SITUACAO[sit]), h('br'),
          `Finalizada por ${ev.finalizadoPorNome?.nome || '—'} (Coren ${ev.finalizadoPorNome?.coren || '—'}) ${ev.finalizadoEmTexto ? `em ${ev.finalizadoEmTexto}` : ''}.`,
          ev.transcritoPEP && h('div', {}, `Cópia ao PEP marcada por ${ev.transcritoPEP.porNome?.nome || '—'} em ${ev.transcritoPEP.emTexto} (versão ${ev.transcritoPEP.versao}).`)),
        h('div', { class: 'linha-acoes' },
          h('button', { class: 'btn btn-primario', type: 'button', onclick: copiarPEP }, 'Copiar para o PEP'),
          h('button', { class: 'btn btn-secundario', type: 'button', onclick: imprimir }, 'Imprimir / PDF'),
          h('button', { class: 'btn btn-secundario', type: 'button', onclick: imprimirPrescricao }, 'Imprimir prescrição de enfermagem'),
          podeEditar() && h('button', { class: 'btn btn-perigo', type: 'button', onclick: retificar }, 'Retificar'))),
      ev.status === 'rascunho' && atual.dados?.sae?.diagnosticos?.length && h('div', { class: 'linha-acoes' },
        h('button', { class: 'btn btn-secundario', type: 'button', onclick: imprimirPrescricao }, 'Imprimir prescrição de enfermagem')),
      navegacaoRodape('fim')].filter(Boolean));
  }

  function evolucaoAtual() {
    return { ...ev, dados: { herdado: ev.dados?.herdado, ...dadosDosFormularios() } };
  }

  async function finalizar() {
    const atual = evolucaoAtual();
    const { erros, avisos } = validarFinalizacao(atual);
    if (erros.length) return desenharFim();
    if (avisos.length && !(await confirmar(`Há ${avisos.length} ponto(s) para conferir (veja a lista). Finalizar mesmo assim?`, { sim: 'Finalizar' }))) return;
    if (!navigator.onLine) return aviso('Sem conexão. O rascunho está salvo neste aparelho; finalize quando o Wi-Fi voltar.', 'atencao', 8000);
    // Garante que tudo o que está na tela chegou ao servidor antes de finalizar.
    for (const sid of Object.keys(timers)) clearTimeout(timers[sid]);
    const prazo = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('sem_conexao')), ms))]);
    try {
      await prazo(Promise.all(Object.keys(formularios).map((sid) => backend.salvarSubbloco(id, sid, formularios[sid].dados(), ev.confirmados?.[sid] || null))), 10000);
      await prazo(backend.finalizarEvolucao(id, { autor: autor(), pendenciasAutomaticas: pendenciasAutomaticas(atual), emTexto: formatarDataHora(agoraLocalISO()) }), 10000);
      aviso('Evolução finalizada. Agora copie para o PEP.', 'ok');
      sessionStorage.setItem(`bloco_${id}`, 'fim');
      redesenhar();
    } catch (e) {
      aviso(e.message === 'sem_conexao' ? 'A conexão está instável: a evolução ainda não foi finalizada. Tente de novo em instantes.' : e.message, 'erro', 8000);
    }
  }

  function copiarPEP() {
    backend.registrarEvento?.('evolucao_copiada', { evolucaoId: id, unidade: ev.unidade });
    const texto = textoParaPEP(evolucaoAtual(), internacao, { unidadeNome });
    const area = h('textarea', { class: 'texto-pep', readonly: true, rows: 18 });
    area.value = texto;
    abrirJanela({
      titulo: 'Copiar para o PEP',
      conteudo: h('div', {},
        h('p', { class: 'ajuda' }, 'Texto simples, sem tabelas. Copie, cole no campo de evolução do PEP e depois marque como transcrito.'),
        area),
      acoes: [
        { texto: 'Fechar', classe: 'btn-secundario' },
        { texto: 'Copiar texto', classe: 'btn-secundario', aoClicar: async () => {
          try {
            await navigator.clipboard.writeText(texto);
          } catch {
            area.select();
            document.execCommand('copy');
          }
          aviso('Texto copiado.', 'ok');
          return false;
        } },
        podeEditar() && ev.transcritoPEP?.versao !== ev.versao && { texto: 'Já colei no PEP', classe: 'btn-primario', aoClicar: async () => {
          try {
            await backend.marcarTranscrita(id, { versao: ev.versao, autor: autor(), emTexto: formatarDataHora(agoraLocalISO()) });
            aviso('Marcada como transcrita ao PEP.', 'ok');
          } catch (e) {
            aviso(e.message, 'erro');
            return false;
          }
        } },
      ].filter(Boolean),
    });
    setTimeout(() => area.select(), 50);
  }

  async function imprimirPrescricao() {
    const m = await import('../../impressos/impressos.js');
    m.imprimirFolhas([m.folhaPrescricao(internacao, evolucaoAtual(), { leitoNum, unidadeNome, data: ev.data })], { unidade: ev.unidade, internacaoId: internacao.id });
  }

  function imprimir() {
    backend.registrarEvento?.('impressao', { tipos: 'evolucao', folhas: 1, evolucaoId: id, unidade: ev.unidade });
    const texto = textoParaPEP(evolucaoAtual(), internacao, { unidadeNome });
    const [titulo, ...resto] = texto.split('\n');
    const folha = h('div', { class: 'impressao' },
      h('div', { class: 'impressao-topo' }, h('img', { src: 'assets/logo/logo_liga_cinza.png', alt: 'Liga Contra o Câncer' }), h('h1', {}, titulo)),
      ...resto.map((l) => (l ? h('p', {}, l) : h('div', { class: 'impressao-sep' }))),
      h('div', { class: 'impressao-assinatura' }, '_______________________________________', h('br'), 'Assinatura e carimbo'));
    document.body.append(folha);
    document.body.classList.add('imprimindo');
    const limparImp = () => {
      folha.remove();
      document.body.classList.remove('imprimindo');
      window.removeEventListener('afterprint', limparImp);
    };
    window.addEventListener('afterprint', limparImp);
    setTimeout(() => window.print(), 100);
  }

  async function retificar() {
    const motivo = h('textarea', { rows: 3, id: 'motivo-retif' });
    abrirJanela({
      titulo: 'Retificar evolução',
      conteudo: h('div', {},
        h('p', {}, 'A versão finalizada fica guardada. A evolução volta a ser rascunho; ao finalizar de novo, vira a versão seguinte.'),
        ev.transcritoPEP && h('p', { class: 'caixa caixa-atencao' }, 'Esta evolução já foi copiada ao PEP. Depois de corrigir, será preciso atualizar o PEP.'),
        h('label', { for: 'motivo-retif', class: 'campo-rotulo' }, 'Motivo da retificação *'), motivo),
      acoes: [
        { texto: 'Cancelar', classe: 'btn-secundario' },
        { texto: 'Retificar', classe: 'btn-perigo', aoClicar: async () => {
          if (!motivo.value.trim()) { aviso('Informe o motivo.', 'atencao'); return false; }
          try {
            await backend.retificarEvolucao(id, { motivo: motivo.value.trim(), autor: autor(), emTexto: formatarDataHora(agoraLocalISO()) });
            setTimeout(redesenhar, 50);
          } catch (e) {
            aviso(e.message, 'erro');
            return false;
          }
        } },
      ],
    });
  }

  // ------------------------------------------------------------------ montagem e sincronização
  limpar(conteudo).append(...[cabecalho, navegacao,
    ro() && h('div', { class: 'faixa-somente-leitura' }, ev.status === 'finalizada' ? 'Evolução finalizada: somente leitura. Para corrigir, use "Retificar" em Finalizar.' : 'Seu perfil é somente consulta.'),
    corpo].filter(Boolean));
  situacaoEl.textContent = ROTULO_SITUACAO[situacaoEvolucao(ev)];
  situacaoEl.className = `situacao sit-${situacaoEvolucao(ev)}`;
  indicador.textContent = ro() ? '' : 'Salvamento automático';
  abrirBloco(ABAS.some((a) => a[0] === blocoAtual) ? blocoAtual : 'b2');

  const parar = backend.observarEvolucao(id, (novo, meta) => {
    const statusMudou = novo.status !== ev.status || novo.versao !== ev.versao;
    ev = { ...ev, ...novo, confirmados: novo.confirmados || {} };
    situacaoEl.textContent = ROTULO_SITUACAO[situacaoEvolucao(ev)];
    situacaoEl.className = `situacao sit-${situacaoEvolucao(ev)}`;
    if (meta.pendente && !pendentes) {
      indicador.className = 'salvamento offline';
      indicador.textContent = 'Salvo neste aparelho · ainda não sincronizado';
    } else if (!meta.pendente && indicador.classList.contains('offline')) {
      indicador.className = 'salvamento salvo';
      indicador.textContent = `✓ Sincronizado às ${horaAgora()}`;
    }
    if (meta.deOutroAparelho) {
      const recente = Object.values(editadoEm).some((t) => Date.now() - t < 4000);
      if (statusMudou) {
        avisoOutro.hidden = false;
        avisoOutro.replaceChildren('Esta evolução mudou de situação em outro aparelho. ', h('button', { class: 'btn btn-pequeno', type: 'button', onclick: redesenhar }, 'Atualizar'));
      } else if (!recente) {
        // Atualiza os subblocos que este aparelho não está editando.
        for (const [sid, f] of Object.entries(formularios)) {
          const remoto = JSON.stringify(novo.dados?.[sid] || {});
          if (remoto !== JSON.stringify(f.dados()) && !corpo.querySelector(`[data-sub="${sid}"]`)?.contains(document.activeElement)) {
            f.definirDados(novo.dados?.[sid] || {});
            atualizarEstadoSub(sid);
          }
        }
      }
    }
    if (blocoAtual === 'fim') desenharFim();
  });

  // O cabeçalho do paciente fica fixo logo abaixo da barra superior (que muda de altura no tablet).
  const ajustarTopo = () => {
    const topo = document.querySelector('.topo');
    // No celular a barra superior não fica fixa (ver CSS): o cabeçalho cola no topo da tela.
    cabecalho.style.top = `${topo && getComputedStyle(topo).position === 'sticky' ? topo.offsetHeight : 0}px`;
  };
  // Ao rolar para baixo, o cabeçalho compacto se recolhe (fica só o nome e a alergia); ao subir, volta.
  // A mudança de altura mexe na rolagem (o navegador compensa): depois de recolher ou
  // abrir, espera a página assentar antes de olhar a rolagem de novo, para não "piscar".
  let ultimaRolagem = window.scrollY;
  let travado = false;
  const aoRolar = () => {
    if (travado) return;
    const y = window.scrollY;
    const dy = y - ultimaRolagem;
    if (Math.abs(dy) < 30) return;
    ultimaRolagem = y;
    const recolher = dy > 0 && y > 160 && !cabecalho.classList.contains('aberto');
    if (recolher === cabecalho.classList.contains('recolhido')) return;
    cabecalho.classList.toggle('recolhido', recolher);
    travado = true;
    setTimeout(() => { travado = false; ultimaRolagem = window.scrollY; }, 400);
  };
  window.addEventListener('scroll', aoRolar, { passive: true });
  ajustarTopo();
  window.addEventListener('resize', ajustarTopo);

  const antesDeSair = (e) => {
    if (pendentes) { e.preventDefault(); e.returnValue = ''; }
  };
  window.addEventListener('beforeunload', antesDeSair);
  return () => {
    // Ao sair da tela, envia o que estiver aguardando.
    for (const [sid, t] of Object.entries(timers)) {
      clearTimeout(t);
      if (Date.now() - (editadoEm[sid] || 0) < 800) backend.salvarSubbloco(id, sid, formularios[sid].dados(), ev.confirmados?.[sid] || null).catch(() => {});
    }
    parar?.();
    window.removeEventListener('beforeunload', antesDeSair);
    window.removeEventListener('resize', ajustarTopo);
    window.removeEventListener('scroll', aoRolar);
  };
}

export { TURNOS };
