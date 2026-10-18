// Check-list diário das medidas preventivas de PAV, ITU-AC e IPCS (padrão da
// Liga): marcação 1, 0 ou NA por leito e turno, adesão ao bundle calculada,
// salvamento automático (também sem Wi-Fi) e impressão no modelo da Liga.

import { backend } from '../../dados/backend.js';
import { estado, podeEditar } from '../../nucleo/estado.js';
import { h, limpar, carregando, anexar } from '../../nucleo/ui.js';
import { diaAssistencial, diaAnterior, turnoDe, TURNOS, idEvolucao } from '../../regras/turnos.js';
import { formatarData } from '../../regras/datas.js';
import { BUNDLES_IRAS, MARCAS_IRAS, adesaoBundle, irasInicial, resumoIras, juntarEvolucoes } from '../../regras/impressos.js';

const ciclo = (v) => ['', ...MARCAS_IRAS][(['', ...MARCAS_IRAS].indexOf(v || '') + 1) % (MARCAS_IRAS.length + 1)];
const ordenar = (a, b) => a.numero.localeCompare(b.numero, 'pt', { numeric: true });

export async function telaIras(conteudo, unidade) {
  carregando(conteudo, 'Abrindo o check-list…');
  let data = diaAssistencial();
  let turno = turnoDe();
  let leitos = [];
  let doc = null;
  let timer = null;
  // Leitos alterados desde o último envio: só eles são gravados (outro enfermeiro pode
  // estar marcando outros leitos do mesmo turno).
  let alterados = new Set();
  const ro = !podeEditar();
  const pararLeitos = backend.observarLeitos(unidade.id, (ls) => {
    const primeira = !leitos.length;
    leitos = ls.sort(ordenar);
    if (primeira) carregar();
  }, (e) => limpar(conteudo).append(h('p', { class: 'vazio' }, e.message)));

  const idDoc = () => `${unidade.id}_${data}_${turno}`;

  async function carregar() {
    carregando(conteudo, 'Carregando o turno…');
    try {
      doc = await backend.lerChecklistIras(idDoc());
      if (!doc) {
        // Turno novo: leito vago e bundles sem dispositivo já vêm marcados (VAGO / NA).
        const evs = {};
        await Promise.all(leitos.filter((l) => l.internacaoId).map(async (l) => {
          evs[l.internacaoId] = juntarEvolucoes(await Promise.all([data, diaAnterior(data)].map((d) => backend.lerEvolucao(idEvolucao(l.internacaoId, d)).catch(() => null))));
        }));
        doc = { unidade: unidade.id, data, turno, respostas: irasInicial(leitos, evs), enfermeiro: '', novo: true };
      }
      desenhar();
    } catch (e) {
      limpar(conteudo).append(h('p', { class: 'vazio' }, e.message));
    }
  }

  function enviar() {
    timer = null;
    const nome = `${estado.perfil.nome}${estado.perfil.coren ? ` (Coren ${estado.perfil.coren})` : ''}`;
    doc.enfermeiro = nome;
    const leitosEnvio = [...alterados];
    alterados = new Set();
    backend.salvarChecklistIras(idDoc(), { unidade: unidade.id, data, turno, respostas: doc.respostas, enfermeiro: nome }, { leitos: leitosEnvio, novo: doc.novo })
      .then(() => { situacao.textContent = `✓ Salvo às ${new Date().toTimeString().slice(0, 5)}`; }, (e) => { situacao.textContent = `Não salvo: ${e.message}`; });
    situacao.textContent = navigator.onLine ? 'Salvando…' : 'Salvo neste aparelho · ainda não sincronizado';
    doc.novo = false;
    document.getElementById('iras-nao-salvo')?.remove();
  }
  function salvar(leito) {
    if (ro) return;
    if (leito) alterados.add(leito);
    clearTimeout(timer);
    timer = setTimeout(enviar, 500);
  }

  const situacao = h('span', { class: 'salvamento', 'aria-live': 'polite' });

  function desenhar() {
    const nums = leitos.map((l) => l.numero);
    const resp = doc.respostas;
    const resumo = resumoIras(resp);
    const selData = h('input', { type: 'date', value: data, max: diaAssistencial(), onchange: (e) => { if (e.target.value) { if (timer) { clearTimeout(timer); enviar(); } data = e.target.value; carregar(); } } });
    const selTurno = h('select', { onchange: (e) => { if (timer) { clearTimeout(timer); enviar(); } turno = e.target.value; carregar(); } },
      Object.entries(TURNOS).map(([k, t]) => h('option', { value: k, selected: k === turno }, t.nome)));
    const tabela = h('table', { class: 'iras-tabela' });
    const cab = h('tr', {}, h('th', {}, ''), nums.map((n) => h('th', {}, `L${Number(n)}`)));
    tabela.append(cab);
    for (const b of BUNDLES_IRAS) {
      tabela.append(h('tr', { class: 'iras-sec' }, h('td', { colspan: nums.length + 1 }, b.titulo)));
      for (const [id, texto, detalhe] of b.itens) {
        tabela.append(h('tr', {}, h('td', { class: 'iras-item' }, texto, detalhe ? h('small', {}, ` ${detalhe}`) : null),
          nums.map((n) => {
            const c = resp[n] ||= {};
            if (c.vago) return h('td', { class: 'iras-vago' }, '—');
            const v = c[b.id]?.[id] || '';
            return h('td', {}, h('button', { type: 'button', class: 'iras-cel', disabled: ro, dataset: { v }, 'aria-label': `Leito ${n}: ${texto}`, onclick: () => {
              c[b.id] ||= {};
              c[b.id][id] = ciclo(c[b.id][id]);
              if (!c[b.id][id]) delete c[b.id][id];
              salvar(n);
              desenhar();
            } }, v || '·'));
          })));
      }
      tabela.append(h('tr', { class: 'iras-adesao' }, h('td', { class: 'iras-item' }, b.adesao),
        nums.map((n) => { const c = resp[n] || {}; return h('td', {}, c.vago ? '' : adesaoBundle(b, c[b.id]) || '…'); })));
    }
    // Atalhos por leito: vago / tudo conforme nos bundles que se aplicam
    tabela.append(h('tr', {}, h('td', { class: 'iras-item' }, h('small', {}, 'Atalhos do leito')), nums.map((n) => {
      const c = resp[n] ||= {};
      // Leito vago vem do painel de leitos: aqui não se ocupa nem se esvazia leito.
      return h('td', {}, !ro && !c.vago && h('button', { type: 'button', class: 'btn btn-link btn-pequeno', title: 'Marca 1 em tudo que ainda está em branco', onclick: () => {
        for (const b of BUNDLES_IRAS) { c[b.id] ||= {}; for (const [id] of b.itens) if (!c[b.id][id]) c[b.id][id] = '1'; }
        salvar(n); desenhar();
      } }, 'Tudo 1'));
    })));

    anexar(limpar(conteudo), 
      h('div', { class: 'painel-cabecalho' }, h('h1', {}, `Check-list de IRAS — ${unidade.nome}`), h('a', { class: 'btn btn-link', href: `#/${unidade.id}` }, '← Painel')),
      h('p', { class: 'ajuda' }, 'Toque na célula para alternar: 1 (conforme) → 0 (não conforme) → NA (não se aplica) → em branco. Leito vago e bundle sem o dispositivo já vêm marcados. A adesão ao bundle é calculada.'),
      h('div', { class: 'iras-topo' },
        h('label', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Dia assistencial'), selData),
        h('label', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Turno'), selTurno),
        h('button', { type: 'button', class: 'btn btn-primario', onclick: imprimir }, 'Imprimir'),
        h('button', { type: 'button', class: 'btn btn-secundario', title: 'Folha com data, turno e leitos vagos; as marcações ficam em branco', onclick: imprimirEmBranco }, 'Imprimir para preencher à mão'),
        situacao),
      h('div', { class: 'iras-resumo' }, BUNDLES_IRAS.map((b) => {
        const r = resumo[b.id];
        return h('span', {}, h('strong', {}, b.id === 'pav' ? 'PAV' : b.id === 'cvc' ? 'CVC' : 'CVD'), `: ${r.avaliados ? `${Math.round((r.conformes / r.avaliados) * 100)}% de adesão (${r.conformes}/${r.avaliados})` : 'sem leitos avaliados'}${r.pendentes ? ` · ${r.pendentes} incompleto(s)` : ''}`);
      })),
      h('div', { class: 'iras-tabela-caixa' }, tabela),
      doc.novo && !ro ? h('p', { class: 'ajuda', id: 'iras-nao-salvo' }, `Turno ainda não salvo (${formatarData(data)}, ${TURNOS[turno].nome.toLowerCase()}). Ao marcar a primeira célula, ele é gravado.`) : null);
  }

  // Folha para preencher à mão: data, turno e leitos vagos (VAGO); marcações em branco.
  async function imprimirEmBranco() {
    const m = await import('../../impressos/impressos.js');
    const respostas = Object.fromEntries(leitos.map((l) => [l.numero, l.internacaoId ? {} : { vago: true }]));
    m.imprimirFolhas([m.folhaIras(unidade, leitos, { data, turno, respostas, enfermeiro: '' })], { unidade: unidade.id });
  }

  async function imprimir() {
    const m = await import('../../impressos/impressos.js');
    m.imprimirFolhas([m.folhaIras(unidade, leitos, { ...doc, data, turno })], { unidade: unidade.id });
  }

  return () => {
    pararLeitos?.();
    if (timer) { clearTimeout(timer); enviar(); } // envia o que estava aguardando
  };
}
