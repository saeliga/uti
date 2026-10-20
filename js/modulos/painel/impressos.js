// Barra de impressos do painel de leitos: capa da ocorrência, prescrição de
// enfermagem, ocorrências por
// leito (transição), folhas de balanço hídrico, check-list de IRAS e check-lists
// de inserção de CVC e CVD.

import { backend } from '../../dados/backend.js';
import { h, aviso, abrirJanela, emSegundoPlano } from '../../nucleo/ui.js';
import { estado, podeEditar } from '../../nucleo/estado.js';
import { hojeISO, somarDias, formatarData } from '../../regras/datas.js';
import { diaAssistencial, diaAnterior, idEvolucao } from '../../regras/turnos.js';
import { CHECKLISTS_INSERCAO, juntarEvolucoes, novoChecklistInsercao, normalizarReservas } from '../../regras/impressos.js';
import { ativo as dispositivoAtivo } from '../../regras/dispositivos.js';

const carregarImpressos = () => import('../../impressos/impressos.js');

/**
 * Dados mais recentes do paciente: junta as evoluções de hoje e dos 2 dias
 * anteriores, ficando, para cada subbloco, o registro mais novo que tem conteúdo
 * (a evolução de hoje pode estar só começando).
 */
async function evolucaoRecente(internacaoId) {
  const evs = [];
  let d = diaAssistencial();
  for (let k = 0; k < 3; k++, d = diaAnterior(d)) {
    const ev = await backend.lerEvolucao(idEvolucao(internacaoId, d)).catch(() => null);
    if (ev) evs.push(ev);
  }
  return juntarEvolucoes(evs);
}

/** Evolução que traz o PE da data (ou, se ainda não houver, a mais recente dos 3 dias anteriores). */
async function evolucaoComPE(internacaoId, data) {
  let d = data;
  for (let k = 0; k < 4; k++, d = diaAnterior(d)) {
    const ev = await backend.lerEvolucao(idEvolucao(internacaoId, d)).catch(() => null);
    if (ev?.dados?.sae?.diagnosticos?.length) return ev;
  }
  return null;
}

async function dadosDosLeitos(leitos) {
  return Promise.all(leitos.map(async (l) => ({
    leito: l, internacao: await backend.lerInternacao(l.internacaoId), ev: await evolucaoRecente(l.internacaoId),
  })));
}

/** Janela com a escolha dos leitos (todos marcados) e, opcionalmente, mais campos. */
function escolherLeitos({ titulo, leitos, extra, aoConfirmar, textoBotao = 'Imprimir' }) {
  const caixas = leitos.map((l) => {
    const cx = h('input', { type: 'checkbox', checked: true, value: l.id });
    return { l, cx, el: h('label', { class: 'opcao' }, cx, h('span', {}, `Leito ${l.numero} — ${l.resumo?.nome || ''}`)) };
  });
  const corpo = h('div', { class: 'formulario' },
    extra?.el,
    h('div', { class: 'linha-acoes' },
      h('button', { type: 'button', class: 'btn btn-link btn-pequeno', onclick: () => caixas.forEach((c) => { c.cx.checked = true; }) }, 'Marcar todos'),
      h('button', { type: 'button', class: 'btn btn-link btn-pequeno', onclick: () => caixas.forEach((c) => { c.cx.checked = false; }) }, 'Desmarcar todos')),
    h('div', { class: 'lista-leitos-imp' }, caixas.map((c) => c.el)));
  abrirJanela({
    titulo, conteudo: corpo,
    acoes: [
      { texto: 'Cancelar', classe: 'btn-secundario' },
      { texto: textoBotao, classe: 'btn-primario', aoClicar: async () => {
        const escolhidos = caixas.filter((c) => c.cx.checked).map((c) => c.l);
        if (!escolhidos.length) { aviso('Escolha pelo menos um leito.', 'atencao'); return false; }
        try {
          await aoConfirmar(escolhidos, extra?.valor?.());
        } catch (e) {
          aviso(`Não foi possível montar a impressão: ${e.message}`, 'erro', 8000);
          return false;
        }
      } },
    ],
  });
}

export function barraImpressos(unidade, leitos) {
  const ocupados = leitos.filter((l) => l.internacaoId);
  const semPacientes = () => { aviso('Não há pacientes internados nesta unidade.', 'atencao'); };

  // Campo de data para os impressos (padrão: hoje).
  const campoData = (rotulo, ajuda) => {
    const input = h('input', { type: 'date', value: hojeISO(), required: true });
    return { input, el: h('div', { class: 'campo' }, h('label', { class: 'campo-rotulo' }, rotulo), input, ajuda && h('p', { class: 'ajuda' }, ajuda)) };
  };

  // Capa: data, reservas (uma linha por paciente, como o NIR manda no WhatsApp) e
  // observações administrativas, salvas por unidade e dia para o plantão seguinte completar.
  const capa = () => {
    const d = campoData('Data da capa');
    const ro = !podeEditar();
    const res = h('textarea', { rows: 8, maxlength: 12000, disabled: true, class: 'capa-reservas-texto',
      placeholder: 'Cole aqui o aviso de reservas do NIR ou digite um paciente por linha (pode deixar uma linha em branco entre eles).\nEx.: Paciente Exemplo / 70 anos / SUS / Cirurgia … / Dr. … (Pré às 08h00)' });
    const contagem = h('p', { class: 'ajuda', 'aria-live': 'polite' });
    const obs = h('textarea', { rows: 3, maxlength: 4000, disabled: true, placeholder: 'Ex.: Respirador 3 em manutenção.' });
    const situacao = h('p', { class: 'ajuda', 'aria-live': 'polite' }, 'Carregando…');
    let salvo = '';
    const estadoAtual = () => JSON.stringify({ o: obs.value.trim(), r: normalizarReservas(res.value) });
    const contar = () => {
      const n = normalizarReservas(res.value).length;
      contagem.textContent = n ? `${n} reserva(s) reconhecida(s): cada uma sai numa linha numerada da capa.` : 'Nenhuma reserva para este dia.';
    };
    // Ao colar o aviso inteiro, já mostra uma reserva por linha (sem cabeçalho e sem numeração).
    res.addEventListener('paste', () => setTimeout(() => { res.value = normalizarReservas(res.value).join('\n\n'); contar(); }, 0));
    res.addEventListener('input', contar);
    const carregar = async () => {
      if (!d.input.value) return;
      obs.disabled = true;
      res.disabled = true;
      situacao.textContent = 'Carregando…';
      try {
        const doc = await backend.lerCapaOcorrencia(`${unidade.id}_${d.input.value}`);
        obs.value = doc?.observacoes || '';
        res.value = normalizarReservas(doc?.reservas).join('\n\n');
        salvo = estadoAtual();
        situacao.textContent = !doc ? 'Nada registrado para este dia.' : doc.atualizadoEm?.toDate ? `Salvo por último em ${doc.atualizadoEm.toDate().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.` : 'Já há registro salvo para este dia.';
      } catch (e) {
        situacao.textContent = `Não foi possível carregar: ${e.message}`;
      }
      obs.disabled = ro;
      res.disabled = ro;
      contar();
    };
    const gravar = async () => {
      if (ro || estadoAtual() === salvo) return;
      const reservas = normalizarReservas(res.value);
      const dados = { unidade: unidade.id, data: d.input.value, observacoes: obs.value.trim(), reservas };
      await Promise.race([backend.salvarCapaOcorrencia(`${unidade.id}_${d.input.value}`, dados), new Promise((r) => setTimeout(r, 4000))]);
      res.value = reservas.join('\n\n');
      salvo = estadoAtual();
      aviso('Capa salva.', 'ok');
    };
    d.input.addEventListener('change', carregar);
    abrirJanela({
      titulo: `Capa da ocorrência — ${unidade.nome}`,
      conteudo: h('div', { class: 'formulario' }, d.el,
        h('div', { class: 'campo' }, h('label', { class: 'campo-rotulo' }, 'Reservas (cirúrgicas e de leito para hemodiálise)'), res, contagem),
        h('div', { class: 'campo' }, h('label', { class: 'campo-rotulo' }, 'Observações'), obs,
          h('p', { class: 'ajuda' }, 'Observações administrativas. Tudo fica guardado para este dia.')),
        situacao),
      acoes: [
        { texto: 'Cancelar', classe: 'btn-secundario' },
        !ro && { texto: 'Salvar', classe: 'btn-secundario', aoClicar: async () => {
          if (!d.input.value) { aviso('Escolha a data.', 'atencao'); return false; }
          try { await gravar(); } catch (e) { aviso(e.message, 'erro', 8000); return false; }
        } },
        { texto: ro ? 'Imprimir' : 'Salvar e imprimir', classe: 'btn-primario', aoClicar: async () => {
          if (!d.input.value) { aviso('Escolha a data.', 'atencao'); return false; }
          try { await gravar(); } catch (e) { aviso(e.message, 'erro', 8000); return false; }
          const m = await carregarImpressos();
          m.imprimirFolhas([m.folhaCapa(unidade, d.input.value, { observacoes: obs.value.trim(), reservas: normalizarReservas(res.value) })], { unidade: unidade.id });
        } },
      ].filter(Boolean),
    });
    emSegundoPlano(carregar());
  };

  const ocorrencias = () => {
    if (!ocupados.length) return semPacientes();
    escolherLeitos({
      titulo: 'Ocorrências de enfermagem (fase de transição)',
      leitos: ocupados,
      extra: (() => {
        const d = campoData('Data da ocorrência', 'Uma folha por leito. Os dias de UTI e de antimicrobianos são contados para esta data. Identificação, dispositivos, infusões, antimicrobianos, dieta, eliminações e lesões vêm da evolução mais recente.');
        return { el: d.el, valor: () => d.input.value };
      })(),
      aoConfirmar: async (escolhidos, data) => {
        if (!data) throw new Error('escolha a data');
        const [m, dados] = await Promise.all([carregarImpressos(), dadosDosLeitos(escolhidos)]);
        m.imprimirFolhas(dados.map(({ leito, internacao, ev }) => m.folhaOcorrencia(internacao, ev, { leitoNum: leito.numero, data })), { unidade: unidade.id });
      },
    });
  };

  const prescricao = () => {
    if (!ocupados.length) return semPacientes();
    escolherLeitos({
      titulo: 'Prescrição de enfermagem',
      leitos: ocupados,
      extra: (() => {
        const d = campoData('Data da prescrição', 'Uma prescrição por leito, com as atividades do Processo de Enfermagem e o aprazamento definido nele. Se o PE do dia ainda não foi feito, sai o plano mais recente.');
        return { el: d.el, valor: () => d.input.value };
      })(),
      aoConfirmar: async (escolhidos, data) => {
        if (!data) throw new Error('escolha a data');
        const [m, dados] = await Promise.all([carregarImpressos(), Promise.all(escolhidos.map(async (l) => ({
          leito: l, internacao: await backend.lerInternacao(l.internacaoId), ev: await evolucaoComPE(l.internacaoId, data),
        })))]);
        const semPE = dados.filter((x) => !x.ev).map((x) => x.leito.numero);
        if (semPE.length) aviso(`Sem Processo de Enfermagem registrado: leito(s) ${semPE.join(', ')}. A folha sai sem itens.`, 'atencao', 8000);
        m.imprimirFolhas(dados.map(({ leito, internacao, ev }) => m.folhaPrescricao(internacao, ev, { leitoNum: leito.numero, unidadeNome: unidade.nome, data, quemImprime: estado.perfil && { nome: estado.perfil.nome, coren: estado.perfil.coren } })), { unidade: unidade.id });
      },
    });
  };

  const balanco = () => {
    if (!ocupados.length) return semPacientes();
    const hoje = hojeISO();
    const amanha = somarDias(hoje, 1);
    let data = new Date().getHours() >= 18 ? amanha : hoje;
    const opc = (valor, rotulo) => h('label', { class: 'opcao' },
      h('input', { type: 'radio', name: 'data-bh', value: valor, checked: data === valor, onchange: () => { data = valor; } }), h('span', {}, rotulo));
    escolherLeitos({
      titulo: 'Folhas de balanço hídrico',
      leitos: ocupados,
      extra: {
        el: h('div', {}, h('div', { class: 'campo-rotulo' }, 'Data da folha'), h('div', { class: 'opcoes' }, opc(hoje, `Hoje (${formatarData(hoje)})`), opc(amanha, `Amanhã (${formatarData(amanha)})`)),
          h('p', { class: 'ajuda' }, 'Duas páginas em paisagem por leito (frente e verso). Os dias de UTI, de dispositivos e de antimicrobianos são contados para a data da folha.')),
        valor: () => data,
      },
      aoConfirmar: async (escolhidos, dataFolha) => {
        const [m, dados] = await Promise.all([carregarImpressos(), dadosDosLeitos(escolhidos)]);
        m.imprimirFolhas(dados.flatMap(({ leito, internacao, ev }) => m.folhasBH(internacao, ev, { leitoNum: leito.numero, dataFolha })), { unidade: unidade.id });
      },
    });
  };

  const insercao = () => {
    const sel = h('select', { 'aria-label': 'Paciente' },
      ocupados.map((l) => h('option', { value: l.id }, `Leito ${l.numero} — ${l.resumo?.nome || ''}`)),
      h('option', { value: '' }, 'Em branco (sem paciente, para preencher à mão)'));
    let tipo = 'cvc';
    const salvos = h('div', { class: 'ins-lista-salvos' });
    const tipos = h('div', { class: 'opcoes' }, Object.entries({ cvc: 'Cateter venoso central (CVC)', cvd: 'Cateter vesical de demora (CVD)' }).map(([v, t]) =>
      h('label', { class: 'opcao' }, h('input', { type: 'radio', name: 'tipo-ins', value: v, checked: v === tipo, onchange: () => { tipo = v; emSegundoPlano(listar()); } }), h('span', {}, t))));
    let janela = null;

    async function contexto() {
      const l = ocupados.find((x) => x.id === sel.value);
      if (!l) return null;
      const [internacao, ev] = await Promise.all([backend.lerInternacao(l.internacaoId), evolucaoRecente(l.internacaoId)]);
      const disp = (ev?.dados?.dispositivos?.itens || []).filter(dispositivoAtivo).filter((i) => CHECKLISTS_INSERCAO[tipo].tipos.includes(i.tipo))
        .sort((a, b) => String(b.insercao || '').localeCompare(String(a.insercao || '')))[0];
      return { l, internacao, disp };
    }
    async function listar() {
      const l = ocupados.find((x) => x.id === sel.value);
      if (!l) return salvos.replaceChildren(h('p', { class: 'ajuda' }, 'Folha em branco, para preencher à mão.'));
      salvos.replaceChildren(h('p', { class: 'ajuda' }, 'Procurando check-lists já preenchidos…'));
      try {
        const lista = (await backend.listarChecklistsInsercao(unidade.id, l.internacaoId)).filter((c) => c.tipo === tipo);
        const { abrirChecklistInsercao, ROTULO_STATUS_INSERCAO } = await import('../insercao/insercao.js');
        salvos.replaceChildren(...(lista.length ? [h('div', { class: 'campo-rotulo' }, 'Já preenchidos para este paciente'), ...lista.map((c) => h('div', { class: 'ins-salvo' },
          h('strong', {}, formatarData(c.data || '')), h('span', {}, ROTULO_STATUS_INSERCAO[c.avaliacao] || ''), h('span', { class: 'ajuda' }, c.responsavel || ''),
          h('button', { type: 'button', class: 'btn btn-link btn-pequeno', onclick: async () => {
            const internacao = await backend.lerInternacao(l.internacaoId);
            janela?.fechar();
            abrirChecklistInsercao({ tipo, internacao, unidade, leitoNum: l.numero, existente: c });
          } }, 'Abrir'),
          h('button', { type: 'button', class: 'btn btn-link btn-pequeno', onclick: async () => {
            const [m, internacao] = await Promise.all([carregarImpressos(), backend.lerInternacao(l.internacaoId)]);
            m.imprimirFolhas([m.folhaInsercao(internacao, c)], { unidade: unidade.id });
          } }, 'Imprimir')))] : [h('p', { class: 'ajuda' }, 'Nenhum check-list deste tipo preenchido para este paciente.')]));
      } catch (e) {
        salvos.replaceChildren(h('p', { class: 'campo-erro' }, e.message));
      }
    }
    sel.addEventListener('change', listar);
    janela = abrirJanela({
      titulo: 'Check-list de inserção',
      conteudo: h('div', { class: 'formulario' },
        h('div', {}, h('div', { class: 'campo-rotulo' }, 'Dispositivo'), tipos),
        h('div', { class: 'campo' }, h('label', { class: 'campo-rotulo' }, 'Paciente'), sel),
        salvos,
        h('p', { class: 'ajuda' }, 'Ao preencher no sistema, o que a evolução já registra do dispositivo (tipo de cateter, lúmens, local, lado e data) vem marcado.')),
      acoes: [
        { texto: 'Fechar', classe: 'btn-secundario' },
        { texto: 'Imprimir para preencher à mão', classe: 'btn-secundario', aoClicar: async () => {
          const m = await carregarImpressos();
          const c = await contexto().catch(() => null);
          m.imprimirFolhas([m.folhaInsercao(c?.internacao || { paciente: {} }, novoChecklistInsercao(tipo))], { unidade: unidade.id });
        } },
        podeEditar() && { texto: 'Preencher no sistema', classe: 'btn-primario', aoClicar: async () => {
          const c = await contexto();
          if (!c) { aviso('Escolha o paciente para preencher no sistema.', 'atencao'); return false; }
          const { abrirChecklistInsercao } = await import('../insercao/insercao.js');
          setTimeout(() => abrirChecklistInsercao({ tipo, internacao: c.internacao, unidade, leitoNum: c.l.numero, dispositivo: c.disp }), 50);
        } },
      ].filter(Boolean),
    });
    emSegundoPlano(listar());
  };

  return h('div', { class: 'barra-impressos', role: 'toolbar', 'aria-label': 'Impressos da unidade' },
    h('span', { class: 'barra-rotulo' }, 'Impressos'),
    h('button', { type: 'button', class: 'btn btn-secundario btn-pequeno', onclick: capa }, 'Capa da ocorrência'),
    h('button', { type: 'button', class: 'btn btn-secundario btn-pequeno', onclick: prescricao }, 'Prescrição de enfermagem'),
    h('button', { type: 'button', class: 'btn btn-secundario btn-pequeno', onclick: ocorrencias }, 'Ocorrências (transição)'),
    h('button', { type: 'button', class: 'btn btn-secundario btn-pequeno', onclick: balanco }, 'Balanço hídrico'),
    h('a', { class: 'btn btn-secundario btn-pequeno', href: `#/iras/${unidade.id}` }, 'Check-list de IRAS'),
    h('button', { type: 'button', class: 'btn btn-secundario btn-pequeno', onclick: insercao }, 'Check-list de inserção'));
}

export { evolucaoRecente };
