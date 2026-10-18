// Montagem e impressão das folhas da UTI no padrão da Liga. Cada folha é uma
// página A4 (retrato ou paisagem); várias folhas saem num único "Imprimir".

import { BH_PAGINA_1, BH_PAGINA_2, OCORRENCIA, ESTILOS_PLANILHA } from './modelos.js';
import { backend } from '../dados/backend.js';
import {
  camposBH, camposOcorrencia, preencherModelo, diaDaSemana, BUNDLES_IRAS, adesaoBundle,
  CHECKLISTS_INSERCAO, OPCOES_SITUACAO, OPCOES_LUMENS, INDICACOES_CVD, avaliarInsercao, normalizarReservas,
} from '../regras/impressos.js';
import { formatarData } from '../regras/datas.js';
import { HORAS, FREQUENCIAS, itensPrescricao, camposPrescricao } from '../regras/prescricao.js';
import { TURNOS } from '../regras/turnos.js';

const LOGO = '<img class="folha-logo" src="assets/logo/logo_liga_cor.png" alt="Liga Contra o Câncer">';
// Figuras da planilha da Liga: aceitação da dieta (prato e garrafa) e o boneco das lesões.
const ACEITACAO = Object.fromEntries(['0', '50', '75', '100'].flatMap((p) => [
  [`prato${p}`, `<img class="aceitacao" src="assets/impressos/prato_${p}.png" alt="prato ${p}%">`],
  [`garrafa${p}`, `<img class="aceitacao" src="assets/impressos/garrafa_${p}.png" alt="garrafa ${p}%">`],
]));
const BONECO = '<img class="oc-boneco" src="assets/impressos/boneco.png" alt="Figura do corpo, frente e costas">';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `
.lote-impressao{display:none}
@media print{
  body.imprimindo-lote>*:not(.lote-impressao){display:none!important}
  body.imprimindo-lote{background:#fff;margin:0;min-height:0!important}
  body.imprimindo-lote .lote-impressao{display:block}
}
@page retrato{size:A4 portrait;margin:7mm}
@page paisagem{size:A4 landscape;margin:6mm}
.folha{font-family:Arial,Helvetica,sans-serif;color:#000;break-after:page;page-break-after:always;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.folha:last-child{break-after:auto;page-break-after:auto}
.folha-retrato{page:retrato;width:196mm}
.folha-paisagem{page:paisagem;width:285mm}
.planilha{width:100%;border-collapse:collapse;table-layout:fixed}
.planilha td{padding:0 2px;overflow:hidden;white-space:nowrap;font-size:7pt;line-height:1.05;vertical-align:middle;font-family:Arial,Helvetica,sans-serif}
.folha-bh .planilha tr{height:4.62mm!important}
.folha-bh .planilha td{font-size:6.5pt}
.folha-oc .planilha tr{height:4.86mm!important}
.folha-oc .planilha td{font-size:7.5pt}
.folha-oc td[data-c="E12"]{white-space:normal;vertical-align:top;font-size:7pt;padding:2px;text-align:center}
.oc-boneco{height:58mm;max-width:100%;display:block;margin:0 auto}
.oc-lesoes{text-align:left;font-size:6.5pt;line-height:1.2}
.aceitacao{height:8mm;display:block;margin:auto}
.folha-logo{height:13mm;display:block;margin:auto}
.planilha td[data-c="A2"] .folha-logo,.planilha td[data-c="A43"] .folha-logo{height:11mm;margin:0 0 0 2mm}
/* tabelas desenhadas (capa, IRAS, inserção) */
.ft{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9pt}
.ft td,.ft th{border:0.6pt solid #000;padding:1.2mm 1.5mm;vertical-align:middle;text-align:left}
.ft th{font-weight:700;text-align:center}
.ft .c{text-align:center}
.ft .cinza{background:#d9d9d9}
.ft .amarelo{background:#ffff00;font-weight:700;text-align:center}
.ft .titulo-sec{font-weight:700;text-align:center;background:#d9d9d9}
.ft small{font-size:7pt;font-weight:400}
.cab-liga{width:100%;border-collapse:collapse;margin-bottom:3mm;font-size:9pt}
.cab-liga td{border:0.6pt solid #000;padding:1.5mm;text-align:center;font-weight:700}
.capa-topo{display:flex;align-items:center;gap:6mm;margin-bottom:3mm}
.capa-topo .folha-logo{height:16mm;margin:0}
.capa-topo h1{font-size:13pt;margin:0;text-align:center;flex:1}
.iras td.m{text-align:center;font-weight:700;width:auto}
.iras .item{font-weight:700;font-size:8pt}
.iras .item small{font-size:6.5pt}
.folha-capa .ft td,.folha-capa .ft th{padding:.8mm 1.5mm;font-size:8pt;line-height:1.25}
.folha-capa .ft tr.capa-res td{height:4.6mm;white-space:normal;line-height:1.3}
.folha-capa .ft td.capa-obs{white-space:pre-wrap;vertical-align:top;font-size:8.5pt;line-height:1.35}
.legenda{display:flex;justify-content:space-between;font-size:8pt;margin-top:2mm}
/* prescrição de enfermagem (padrão da prescrição médica da Liga) */
.folha-presc{font-family:"Gotham Pro",Arial,Helvetica,sans-serif;color:#333}
.presc{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7pt}
.presc thead{display:table-header-group}.presc tfoot{display:table-footer-group}
.presc tr{break-inside:avoid;page-break-inside:avoid}
.presc-cab{border:0!important;padding:0 0 2mm!important}
.presc-topo{display:flex;align-items:center;justify-content:space-between;margin:0 0 2.5mm}
.presc-topo .folha-logo{height:10mm;margin:0}
.presc-topo h1{flex:1;text-align:center;font-size:13pt;letter-spacing:.3pt;margin:0;color:#3c3c3b}
.presc-topo .presc-pag{width:10mm}
.presc-id{display:grid;grid-template-columns:2.3fr 1fr 1.3fr 1.3fr 1.1fr;gap:1.6mm 4mm;font-size:6.6pt;margin-bottom:2mm}
.presc-id b{color:#3c3c3b}.presc-id span{color:#555}
.presc-id .l2{grid-column:span 2}
.presc-alergia{display:inline-block;background:#e0242e;color:#fff;font-weight:700;border-radius:3mm;padding:.6mm 2.4mm;font-size:6.8pt;margin:.5mm 0 1.6mm}
.presc-dx{font-size:6.8pt;margin-bottom:.5mm;line-height:1.3}
.presc th,.presc td{border:0.5pt solid #9a9a9a;padding:.9mm 1mm;vertical-align:middle;text-align:left}
.presc th{font-weight:700;color:#3c3c3b;font-size:6.6pt;border-top:0.9pt solid #555;border-bottom:0.9pt solid #555}
.presc .h{text-align:center;padding:.9mm 0;font-variant-numeric:tabular-nums}
.presc td.h{font-size:7pt;color:#222}
.presc .c{text-align:center}
.presc-grupo td{background:#eee;font-weight:700;color:#3c3c3b;font-size:6.8pt}
.presc-grupo small{font-weight:400;color:#555;font-size:6.3pt}
.presc-obs td{color:#555;font-size:6.5pt;padding:.6mm 1mm}
.presc td.presc-ass{border:0!important;padding:9mm 0 0!important;text-align:right}
.presc-ass span{display:inline-block;width:80mm;border-top:0.6pt solid #333;text-align:center;font-size:6.6pt;padding-top:1mm;color:#333}
.folha-insercao{font-family:"Gotham Pro",Arial,sans-serif;font-size:8.5pt}
.ins-topo{display:flex;justify-content:space-between;align-items:flex-start;margin:2mm 0 5mm}
.ins-topo h1{font-family:"Zona Pro","Gotham Pro",Arial,sans-serif;font-weight:700;font-size:16pt;line-height:1.25;margin:0;color:#3c3c3b}
.ins-topo .folha-logo{height:17mm;margin:0}
.ins-caixa{width:100%;border-collapse:collapse;margin-bottom:2.5mm;font-size:8pt}
.ins-caixa td{border:0.6pt solid #555;padding:1.3mm 1.6mm;vertical-align:top;color:#333}
.ins-caixa td.c{text-align:center;vertical-align:middle}
.ins-caixa small{font-size:6.5pt}
.ins-itens td{padding:.9mm 1.6mm}
.ins-sec td{font-weight:700}
.ins-op{white-space:nowrap;margin-right:3.5mm}
.cx{font-size:10pt;line-height:1}
.ins-val{font-weight:700;color:#000}
.ins-grade{display:flex;gap:4mm;justify-content:space-between;margin:.8mm 0}
.ins-lista div{margin:.5mm 0}
.ins-rodape-campos{font-size:8pt;color:#333;display:flex;flex-direction:column;gap:2.5mm;margin-top:3mm}
.ins-rodape-campos .linha{display:inline-block;border-bottom:0.6pt solid #333;width:70%;height:3mm;vertical-align:bottom}
.ins-resultado{font-size:7pt;color:#555}
.ins-pe{display:flex;justify-content:space-between;align-items:flex-end;font-size:6.5pt;color:#444;margin-top:6mm;text-align:right}
`;

function garantirEstilos() {
  if (document.getElementById('estilos-impressos')) return;
  document.head.append(Object.assign(document.createElement('style'), { id: 'estilos-impressos', textContent: CSS + ESTILOS_PLANILHA }));
}

/**
 * Imprime as folhas: [{ html, orientacao: 'retrato'|'paisagem', classe }].
 * Toda impressão fica no registro de operações (quem, quando, o quê, quantas folhas),
 * porque papel com dados de paciente também é tratamento de dados (LGPD).
 */
export function imprimirFolhas(folhas, meta = {}) {
  garantirEstilos();
  const tipos = [...new Set(folhas.map((f) => (f.classe || '').replace('folha-', '')))].join(',');
  backend.registrarEvento?.('impressao', { tipos, folhas: folhas.length, ...meta });
  document.querySelector('.lote-impressao')?.remove();
  const lote = document.createElement('div');
  lote.className = 'lote-impressao';
  // Lote de uma só orientação usa a página padrão (@page sem nome): o Chrome cria uma
  // página em branco quando uma tabela com rodapé repetido está numa página nomeada.
  const orientacoes = new Set(folhas.map((f) => f.orientacao));
  const pagina = document.getElementById('pagina-lote') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'pagina-lote' }));
  if (orientacoes.size === 1) {
    const o = [...orientacoes][0];
    pagina.textContent = `@media print{@page{size:A4 ${o === 'paisagem' ? 'landscape' : 'portrait'};margin:${o === 'paisagem' ? 6 : 7}mm}.lote-impressao .folha{page:auto}}`;
  } else pagina.textContent = '';
  lote.innerHTML = folhas.map((f) => `<section class="folha folha-${f.orientacao} ${f.classe || ''}">${f.html}</section>`).join('');
  document.body.append(lote);
  document.body.classList.add('imprimindo-lote');
  const limpar = () => {
    lote.remove();
    document.body.classList.remove('imprimindo-lote');
    window.removeEventListener('afterprint', limpar);
  };
  window.addEventListener('afterprint', limpar);
  // Espera as imagens (logotipo) carregarem antes de abrir a impressão.
  const imgs = [...lote.querySelectorAll('img')].map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }))).filter(Boolean);
  Promise.race([Promise.all(imgs), new Promise((r) => setTimeout(r, 1500))]).then(() => window.print());
  return lote;
}

// --------------------------------------------------------------------------- folhas
export function folhasBH(internacao, ev, { leitoNum, dataFolha }) {
  const c = camposBH(internacao, ev, { leitoNum, dataFolha });
  return [
    { html: preencherModelo(BH_PAGINA_1, c, { logo: LOGO }), orientacao: 'paisagem', classe: 'folha-bh' },
    { html: preencherModelo(BH_PAGINA_2, c, { logo: LOGO, ...ACEITACAO }), orientacao: 'paisagem', classe: 'folha-bh' },
  ];
}

export function folhaOcorrencia(internacao, ev, { leitoNum, data }) {
  const c = camposOcorrencia(internacao, ev, { leitoNum, data });
  return { html: preencherModelo(OCORRENCIA, c, { boneco: BONECO }), orientacao: 'retrato', classe: 'folha-oc' };
}

const EQUIPAMENTOS = ['AMBÚ', 'TESOURA', 'TERMÔMETRO', 'ESTETOSCÓPIO', 'OXÍMETRO e PNI', 'ÓCULOS', 'TENSIÔMETRO', 'BALA DE O2', 'CARRO URGÊNCIA', 'FIO GUIA',
  'RESPIRADOR', 'ECG', 'PRESSURÍMETRO', 'GARRA', 'SISTEMA DE COMPRESSOR PNEUMÁTICO', 'MANTA TÉRMICA', 'MARCAPASSO / CUFFÔMETRO', 'OFTALMOSCÓPIO/OTOSCÓPIO', 'INDICADORES', 'NAS/BRADEN', 'EVOLUÇÃO:', 'BANHOS:'];

/** Capa da ocorrência dos enfermeiros, por UTI (igual ao modelo em Word). */
export function folhaCapa(unidade, data, { observacoes = '', reservas = [] } = {}) {
  const obs = String(observacoes || '').trim();
  const res = normalizarReservas(reservas);
  // Cada linha escrita ocupa o lugar de uma linha em branco do papel (cerca de 115 caracteres por linha).
  const linhasObs = obs ? obs.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 115)), 0) : 0;
  // Uma linha por paciente (texto livre); a linha longa ocupa o lugar das linhas em branco.
  const linhasRes = res.reduce((n, t) => n + Math.max(1, Math.ceil((t.length + 4) / 120)), 0);
  const linhaReserva = (t, k) => `<tr class="capa-res"><td colspan="6">${t ? `${k + 1}. ${esc(t)}` : ''}</td></tr>`;
  const tres = (txt, cls = '') => `<tr>${[0, 1, 2].map(() => `<td colspan="2" class="${cls}">${txt}</td>`).join('')}</tr>`;
  const html = `
    <div class="capa-topo">${LOGO}<h1>OCORRÊNCIA DOS ENFERMEIROS – ${esc(unidade.nome.toUpperCase())}<br>DATA: ${formatarData(data)} - ${diaDaSemana(data)}</h1><span style="width:16mm"></span></div>
    <table class="ft">
      <tr><th colspan="2">MANHÃ</th><th colspan="2">TARDE</th><th colspan="2">NOITE</th></tr>
      ${tres('PLANT:')}${tres('ENF:')}${tres('FISIO:')}
      <tr>${[0, 1, 2].map(() => '<td colspan="2" style="height:15mm;vertical-align:top">EQUIPE:</td>').join('')}</tr>
    </table>
    <table class="ft" style="margin-top:2mm;font-size:8pt">
      <tr><th colspan="2">MANHÃ</th><th colspan="2">TARDE</th><th colspan="2">NOITE</th></tr>
      ${['EXISTIAM', 'ADMISSÃO', 'ADMISSÃO PARA HEMODIÁLISE', 'ALTA', 'TRANSFERÊNCIA', 'ÓBITO', 'EXISTEM'].map((r) => tres(r)).join('')}
      <tr>${[0, 1, 2].map(() => '<td>CONV</td><td>SUS</td>').join('')}</tr>
      ${tres('EQUIPAMENTOS/MATERIAIS', 'amarelo')}
      ${EQUIPAMENTOS.map((e) => tres(e)).join('')}
      <tr><td colspan="6"><strong>RESERVAS</strong> (cirúrgicas e de leito para hemodiálise):</td></tr>
      ${[...res, ...Array.from({ length: Math.max(1, 5 - linhasRes) }, () => '')].map(linhaReserva).join('')}
      <tr><td colspan="6"><strong>OBSERVAÇÕES:</strong></td></tr>
      ${obs ? `<tr><td colspan="6" class="capa-obs">${esc(obs)}</td></tr>` : ''}
      ${Array.from({ length: Math.max(obs ? 0 : 1, 2 - linhasObs) }, () => '<tr><td colspan="6" style="height:5mm"></td></tr>').join('')}
    </table>`;
  return { html, orientacao: 'retrato', classe: 'folha-capa' };
}

/**
 * Prescrição de enfermagem de um paciente, no leiaute da prescrição médica da Liga:
 * cabeçalho repetido em cada página, itens numerados com frequência, responsável
 * e os horários marcados nas 24 colunas (07 às 06), observação abaixo do item.
 */
export function folhaPrescricao(internacao, ev, { leitoNum, unidadeNome, data }) {
  const c = camposPrescricao(internacao, ev, { leitoNum, unidadeNome, data });
  const { grupos, diagnosticos } = itensPrescricao(ev?.dados?.sae);
  const ncol = 3 + HORAS.length;
  const campo = (rot, val, cls = '') => `<div class="${cls}"><b>${rot}:</b> <span>${esc(val || '')}</span></div>`;
  let n = 0;
  const corpo = grupos.map((g) => `<tr class="presc-grupo"><td colspan="${ncol}">${esc(g.titulo)} <small>· ${esc(g.diagnosticos.join('; '))}</small></td></tr>${g.atividades.map((a) => {
    n += 1;
    return `<tr><td>${n}. ${esc(a.texto)}</td><td class="c">${g.resp}</td><td class="c">${esc(FREQUENCIAS[a.freq] || '')}</td>${HORAS.map((hh) => `<td class="h">${a.horarios.includes(hh) ? hh : ''}</td>`).join('')}</tr>${a.obs ? `<tr class="presc-obs"><td colspan="${ncol}">Obs: ${esc(a.obs)}</td></tr>` : ''}`;
  }).join('')}`).join('') || `<tr><td colspan="${ncol}" class="c" style="padding:4mm">Sem atividades de enfermagem no Processo de Enfermagem deste dia.</td></tr>`;
  const html = `
    <table class="presc">
      <colgroup><col style="width:86mm"><col style="width:9mm"><col style="width:17mm">${HORAS.map(() => '<col>').join('')}</colgroup>
      <thead>
        <tr><td colspan="${ncol}" class="presc-cab">
          <div class="presc-topo">${LOGO}<h1>PRESCRIÇÃO DE ENFERMAGEM</h1><span class="presc-pag"></span></div>
          <div class="presc-id">
            ${campo('PACIENTE', c.nome)}${campo('ARQUIVO', c.registro)}${campo('CONVÊNIO', c.convenio)}${campo('SETOR', c.setor)}${campo('LEITO', c.leito)}
            ${campo('NASCIMENTO', c.nascimento)}${campo('DIAGNÓSTICO MÉDICO', c.diagnostico, 'l2')}${campo('DATA DA PRESCRIÇÃO', c.data)}${campo('DATA VALIDADE', c.validade)}
            ${campo('ENFERMEIRO(A)', c.profissional, 'l2')}${c.isolamento ? campo('ISOLAMENTO', c.isolamento, 'l2') : ''}
          </div>
          ${c.alergias && c.alergias !== 'NEGA' ? `<div class="presc-alergia">ALERGIA: ${esc(c.alergias)}</div>` : c.alergias === 'NEGA' ? '<div class="presc-dx"><b>ALERGIA:</b> NEGA</div>' : ''}
          ${diagnosticos.length ? `<div class="presc-dx"><b>DIAGNÓSTICOS DE ENFERMAGEM:</b> ${diagnosticos.map((t, k) => `${k + 1}. ${esc(t)}`).join('; ')}</div>` : ''}
        </td></tr>
        <tr><th>CUIDADOS DE ENFERMAGEM / ORIENTAÇÕES</th><th class="c">RESP.</th><th class="c">FREQ.</th>${HORAS.map((hh) => `<th class="h">${hh}</th>`).join('')}</tr>
      </thead>
      <tbody>${corpo}</tbody>
      <tfoot><tr><td colspan="${ncol}" class="presc-ass"><span>ASSINATURA E CARIMBO DO(A) ENFERMEIRO(A)</span></td></tr></tfoot>
    </table>`;
  return { html, orientacao: 'paisagem', classe: 'folha-presc' };
}

/** Cabeçalho institucional dos protocolos (igual ao do check-list diário). */
function cabecalhoProtocolo(titulo, { codigo = '', rev = '' } = {}) {
  return `<table class="cab-liga">
    <tr><td rowspan="4" style="width:22%">${LOGO}</td><td rowspan="2">PROTOCOLO DE SEGURANÇA DO PACIENTE</td><td colspan="2" style="width:22%">${esc(codigo) || '&nbsp;'}</td></tr>
    <tr><td colspan="2">INTERNO</td></tr>
    <tr><td rowspan="2">${titulo}</td><td>REV.:</td><td>${esc(rev) || '&nbsp;'}</td></tr>
    <tr><td>FOLHA:</td><td>1 / 1</td></tr></table>`;
}

/** Check-list diário das medidas preventivas de PAV, ITU-AC e IPCS (marcações 1, 0 ou NA). */
export function folhaIras(unidade, leitos, doc) {
  const nums = leitos.map((l) => l.numero);
  const resp = doc?.respostas || {};
  const turno = doc?.turno ? TURNOS[doc.turno].nome.toUpperCase() : '';
  const VAGO = ['V', 'A', 'G', 'O'];
  const blocos = BUNDLES_IRAS.map((b, kb) => {
    const linhas = b.itens.map(([id, texto, detalhe], k) => `<tr><td class="item">${texto}${detalhe ? ` <small>${detalhe}</small>` : ''}</td>${nums.map((n) => {
      const c = resp[n] || {};
      return `<td class="m">${c.vago ? (VAGO[k] || '') : esc(c[b.id]?.[id] || '')}</td>`;
    }).join('')}</tr>`).join('');
    const adesao = `<tr><td class="item">${b.adesao.replace('Bundle', '<em>Bundle</em>')}</td>${nums.map((n) => {
      const c = resp[n] || {};
      return `<td class="m">${c.vago ? '' : adesaoBundle(b, c[b.id])}</td>`;
    }).join('')}</tr>`;
    const dataTxt = kb === 0 ? `DATA: ${doc?.data ? formatarData(doc.data) : ''}${turno ? ` - ${turno}` : ''}` : 'DATA';
    return `<tr><td colspan="${nums.length + 1}" class="titulo-sec">${b.titulo}</td></tr>
      <tr><td class="item">${dataTxt}</td>${nums.map((n) => `<th>L${Number(n)}</th>`).join('')}</tr>${linhas}${adesao}`;
  }).join('');
  const html = `${cabecalhoProtocolo('CHECK-LIST DE AVALIAÇÃO DIÁRIA DAS MEDIDAS PREVENTIVAS DE PAV, ITU-AC E IPCS', { codigo: 'PTQLD0005:03', rev: '03' })}
    <div style="font-size:8pt;margin-bottom:1mm"><strong>${esc(unidade.nome.toUpperCase())}</strong></div>
    <table class="ft iras"><colgroup><col style="width:40%">${nums.map(() => `<col style="width:${60 / nums.length}%">`).join('')}</colgroup>
      ${blocos}
      <tr><td class="item" style="height:16mm;vertical-align:top">Assinatura do Enfermeiro (a):${doc?.enfermeiro ? `<br><span style="font-weight:400">${esc(doc.enfermeiro)}</span>` : ''}</td>${nums.map(() => '<td></td>').join('')}</tr>
    </table>
    <div class="legenda"><strong>S*A adesão ao <em>Bundle</em> será considerada conforme, quando todas as boas práticas tiverem sido cumpridas.</strong>
      <span><strong>Legenda</strong><br>1 – Item conforme<br>0 – Item não conforme<br>NA – Não se aplica</span></div>`;
  return { html, orientacao: 'retrato', classe: 'folha-iras' };
}

/**
 * Check-list de inserção de CVC ou CVD no leiaute atual da Liga (Versão 2, 07/04/2026).
 * `reg` é o registro preenchido no sistema (ou vazio, para imprimir em branco).
 */
export function folhaInsercao(internacao, reg) {
  const ck = CHECKLISTS_INSERCAO[reg.tipo];
  const p = internacao?.paciente || {};
  const cx = (on) => `<span class="cx">${on ? '&#9746;' : '&#9744;'}</span>`;
  const op = (on, texto) => `<span class="ins-op">${cx(on)} ${texto}</span>`;
  const val = (t) => `<span class="ins-val">${esc(t || '')}</span>`;
  const linhaResp = (i) => {
    const r = reg.respostas?.[i.id] || '';
    const det = i.detalhe && reg.detalhes?.[i.id] ? ` <span class="ins-val">${esc(reg.detalhes[i.id])}</span>` : '';
    return `<tr><td>${esc(i.texto)}${i.nota ? `<br><small>${esc(i.nota)}</small>` : ''}${det}</td><td class="c">${r === 'sim' ? 'SIM' : ''}</td><td class="c">${r === 'nao' ? 'NÃO' : ''}</td></tr>`;
  };
  const tabelaItens = ck.secoes.map((s) => `<tr class="ins-sec"><td>${esc(s.titulo)}</td><td class="c">SIM</td><td class="c">NÃO</td></tr>${s.itens.map(linhaResp).join('')}`).join('');
  let meio;
  if (reg.tipo === 'cvc') {
    const lado = (l, fem = true) => `${op(reg.lado === 'D' && l, fem ? 'Direita' : 'Direito')} ${op(reg.lado === 'E' && l, fem ? 'Esquerda' : 'Esquerdo')}`;
    meio = `
    <table class="ins-caixa"><tr><td style="width:37%"><strong>O CATETER FOI PASSADO NA UTI/ UCI?</strong><br>${op(reg.naUti === 'sim', '<strong>SIM</strong>')} &nbsp; ${op(reg.naUti === 'nao', '<strong>NÃO</strong>')}</td>
      <td><strong>SE NÃO FOI NA UTI, EM QUAL SETOR FOI PASSADO?</strong> ${val(reg.naUti === 'nao' ? reg.setor : '')}</td></tr></table>
    <table class="ins-caixa">
      <tr><td><strong>Situação de inserção?</strong> ${Object.entries(OPCOES_SITUACAO).map(([k, t]) => op(reg.situacao === k, t)).join(' ')} Motivo: ${val(reg.situacao === 'reinsercao' ? reg.situacaoMotivo : '') || '________________________'}</td></tr>
      <tr><td><strong>Tipo de cateter</strong><br>
        <span class="ins-grade">${op(reg.cateter === 'cvc', 'Cateter venoso central')}<span>${Object.entries(OPCOES_LUMENS).map(([k, t]) => op(reg.cateter === 'cvc' && reg.lumens === k, t)).join(' ')}</span></span>
        <span class="ins-grade">${op(reg.cateter === 'hd', 'Cateter venoso central de HD')}<span>${['duplo', 'triplo'].map((k) => op(reg.cateter === 'hd' && reg.lumens === k, OPCOES_LUMENS[k])).join(' ')}</span></span>
        Outros: ${val(reg.cateterOutro)}</td></tr></table>
    <table class="ins-caixa">
      <tr><td colspan="3"><strong>Indicação:</strong> ${Object.entries(OPCOES_SITUACAO).map(([k, t]) => op(reg.indicacao === k, t)).join(' ')} Motivo: ${val(reg.indicacao === 'reinsercao' ? reg.indicacaoMotivo : '') || '________________________'}</td></tr>
      <tr><td colspan="3"><strong>Local de inserção do cateter</strong></td></tr>
      <tr><td>${op(reg.local === 'jugular', 'Jugular')} ${lado(reg.local === 'jugular')}</td><td>${op(reg.local === 'subclavia', 'Subclávia')} ${lado(reg.local === 'subclavia')}</td><td>${op(reg.local === 'femoral', 'Femoral')} ${lado(reg.local === 'femoral')}</td></tr>
      <tr><td>${op(reg.local === 'mmss', 'MMSS')} ${lado(reg.local === 'mmss', false)}</td><td>${op(reg.local === 'mmii', 'MMII')} ${lado(reg.local === 'mmii', false)}</td><td>Outro: ${val(reg.localOutro)}</td></tr></table>`;
  } else {
    meio = `
    <table class="ins-caixa"><tr><td><strong>O cateter foi passado em qual SETOR?</strong> ${val(reg.setor)}</td></tr>
      <tr><td><strong>Indicação de inserção</strong></td></tr>
      <tr><td class="ins-lista">${Object.entries(INDICACOES_CVD).map(([k, t]) => `<div>${cx((reg.indicacoes || []).includes(k))} ${t}${k === 'monitorizacao' && reg.indicacaoEspecifique ? ` ${val(reg.indicacaoEspecifique)}` : ''}</div>`).join('')}</td></tr></table>`;
  }
  const av = reg.respostas && Object.keys(reg.respostas).length ? avaliarInsercao(reg) : null;
  const html = `
    <div class="ins-topo"><h1>${ck.titulo.join('<br>')}</h1>${LOGO}</div>
    <table class="ins-caixa">
      <tr><td colspan="3"><strong>PACIENTE:</strong> ${val(p.nome)}</td></tr>
      <tr><td style="width:37%"><strong>DATA NASCIMENTO:</strong> ${val(p.dataNascimento ? formatarData(p.dataNascimento) : '')}</td><td><strong>ARQUIVO:</strong> ${val(p.registro)}</td><td style="width:25%"><strong>DATA:</strong> ${val(reg.data ? formatarData(reg.data) : '')}</td></tr></table>
    ${meio}
    <table class="ins-caixa ins-itens"><colgroup><col><col style="width:9%"><col style="width:9%"></colgroup>${tabelaItens}</table>
    <div class="ins-rodape-campos">
      <div>Equipe participante: ${val(reg.equipe) || '<span class="linha"></span>'}</div>
      <div>Observações: ${val(reg.observacoes) || '<span class="linha"></span>'}</div>
      <div>Responsável pelo preenchimento: ${val(reg.responsavel) || '<span class="linha"></span>'}</div>
      ${av ? `<div class="ins-resultado">Registrado no sistema: ${av.status === 'conforme' ? 'bundle conforme' : av.status === 'nao_conforme' ? `bundle não conforme (${av.conformes}/${av.total} itens conformes)` : `incompleto (${av.respondidos}/${av.total} respondidos)`}</div>` : ''}
    </div>
    <div class="ins-pe"><span>Versão 2 (07/04/2026)</span><span>Pasta setorial &gt; Recolhimento - para Pasta Arquivo SCIH &gt;<br>Encaminhamento - Arquivo Central LIGA</span></div>`;
  return { html, orientacao: 'retrato', classe: 'folha-insercao' };
}

