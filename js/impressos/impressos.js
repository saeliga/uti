// Montagem e impressão das folhas da UTI no padrão da Liga. Cada folha é uma
// página A4 (retrato ou paisagem); várias folhas saem num único "Imprimir".

import { BH_PAGINA_1, BH_PAGINA_2, OCORRENCIA, ESTILOS_PLANILHA } from './modelos.js';
import {
  camposBH, camposOcorrencia, camposIdentificacao, preencherModelo, diaDaSemana, BUNDLES_IRAS, adesaoBundle, CHECKLISTS_INSERCAO,
} from '../regras/impressos.js';
import { formatarData, idade } from '../regras/datas.js';
import { TURNOS } from '../regras/turnos.js';
import { LUMENS } from '../regras/dispositivos.js';

const LOGO = '<img class="folha-logo" src="assets/logo/logo_liga_cor.png" alt="Liga Contra o Câncer">';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `
.lote-impressao{display:none}
@media print{
  body.imprimindo-lote>*:not(.lote-impressao){display:none!important}
  body.imprimindo-lote{background:#fff;margin:0}
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
.folha-oc td[data-c="E12"]{white-space:normal;vertical-align:top;font-size:8pt;padding:3px}
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
.folha-insercao .ft td,.folha-insercao .ft th{padding:.8mm 1.5mm}
.legenda{display:flex;justify-content:space-between;font-size:8pt;margin-top:2mm}
.ins-opcoes{display:flex;flex-wrap:wrap;gap:1mm 5mm;font-size:8pt}
.ins-assin{display:flex;gap:8mm;margin-top:10mm;font-size:7.5pt;text-align:center}
.ins-assin div{flex:1;border-top:0.6pt solid #000;padding-top:1mm}
`;

function garantirEstilos() {
  if (document.getElementById('estilos-impressos')) return;
  document.head.append(Object.assign(document.createElement('style'), { id: 'estilos-impressos', textContent: CSS + ESTILOS_PLANILHA }));
}

/** Imprime as folhas: [{ html, orientacao: 'retrato'|'paisagem', classe }] */
export function imprimirFolhas(folhas) {
  garantirEstilos();
  document.querySelector('.lote-impressao')?.remove();
  const lote = document.createElement('div');
  lote.className = 'lote-impressao';
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
    { html: preencherModelo(BH_PAGINA_2, c, { logo: LOGO }), orientacao: 'paisagem', classe: 'folha-bh' },
  ];
}

export function folhaOcorrencia(internacao, ev, { leitoNum, data }) {
  const c = camposOcorrencia(internacao, ev, { leitoNum, data });
  return { html: preencherModelo(OCORRENCIA, c), orientacao: 'retrato', classe: 'folha-oc' };
}

const EQUIPAMENTOS = ['AMBÚ', 'TESOURA', 'TERMÔMETRO', 'ESTETOSCÓPIO', 'OXÍMETRO e PNI', 'ÓCULOS', 'TENSIÔMETRO', 'BALA DE O2', 'CARRO URGÊNCIA', 'FIO GUIA',
  'RESPIRADOR', 'ECG', 'PRESSURÍMETRO', 'GARRA', 'SISTEMA DE COMPRESSOR PNEUMÁTICO', 'MANTA TÉRMICA', 'MARCAPASSO / CUFFÔMETRO', 'OFTALMOSCÓPIO/OTOSCÓPIO', 'INDICADORES', 'NAS/BRADEN', 'EVOLUÇÃO:', 'BANHOS:'];

/** Capa da ocorrência dos enfermeiros, por UTI (igual ao modelo em Word). */
export function folhaCapa(unidade, data) {
  const tres = (txt, cls = '') => `<tr>${[0, 1, 2].map(() => `<td colspan="2" class="${cls}">${txt}</td>`).join('')}</tr>`;
  const html = `
    <div class="capa-topo">${LOGO}<h1>OCORRÊNCIA DOS ENFERMEIROS – ${esc(unidade.nome.toUpperCase())}<br>DATA: ${formatarData(data)} - ${diaDaSemana(data)}</h1><span style="width:16mm"></span></div>
    <table class="ft">
      <tr><th colspan="2">MANHÃ</th><th colspan="2">TARDE</th><th colspan="2">NOITE</th></tr>
      ${tres('PLANT:')}${tres('ENF:')}${tres('FISIO:')}
      <tr>${[0, 1, 2].map(() => '<td colspan="2" style="height:20mm;vertical-align:top">EQUIPE:</td>').join('')}</tr>
    </table>
    <table class="ft" style="margin-top:2mm;font-size:8pt">
      <tr><th colspan="2">MANHÃ</th><th colspan="2">TARDE</th><th colspan="2">NOITE</th></tr>
      ${['EXISTIAM', 'ADMISSÃO', 'ADMISSÃO PARA HEMODIÁLISE', 'ALTA', 'TRANSFERÊNCIA', 'ÓBITO', 'EXISTEM'].map((r) => tres(r)).join('')}
      <tr>${[0, 1, 2].map(() => '<td>CONV</td><td>SUS</td>').join('')}</tr>
      ${tres('EQUIPAMENTOS/MATERIAIS', 'amarelo')}
      ${EQUIPAMENTOS.map((e) => tres(e)).join('')}
      <tr><td colspan="6"><strong>RESERVAS:</strong></td></tr>
      ${Array.from({ length: 6 }, () => '<tr><td colspan="6" style="height:5mm"></td></tr>').join('')}
    </table>`;
  return { html, orientacao: 'retrato', classe: 'folha-capa' };
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

/** Check-list de inserção (CVC ou CVD) com a identificação do paciente já preenchida. */
export function folhaInsercao(tipo, internacao, { leitoNum, unidadeNome, data, dispositivo }) {
  const ck = CHECKLISTS_INSERCAO[tipo];
  const id = camposIdentificacao(internacao, leitoNum);
  const marcado = (campo, opcao) => {
    if (!dispositivo || !campo) return false;
    if (campo === 'local') return (dispositivo.local || '').startsWith(opcao.split(' ')[0]) || (opcao.startsWith('PERIFÉRICA') && dispositivo.tipo === 'picc');
    if (campo === 'lado') return (opcao === 'DIREITO' && dispositivo.lado === 'D') || (opcao === 'ESQUERDO' && dispositivo.lado === 'E');
    if (campo === 'lumens') return opcao.startsWith(`${dispositivo.lumens} `) || (opcao.startsWith('CATETER DE HEMODIÁLISE') && dispositivo.tipo === 'cateter_dialise');
    return false;
  };
  const cab = ck.cabecalho.map(([rot, opcoes, campo]) => `<tr><td style="width:30%"><strong>${rot}</strong></td><td><div class="ins-opcoes">${opcoes.map((o) => {
    if (campo === 'numero') return `<span>Nº ${esc(dispositivo?.numero || '______')}</span>`;
    return `<span>(${marcado(campo, o) ? ' X ' : '&nbsp;&nbsp;&nbsp;'}) ${o}</span>`;
  }).join('')}</div></td></tr>`).join('');
  const secoes = ck.secoes.map(([titulo, itens]) => `<tr><td class="titulo-sec">${titulo}</td><th>SIM</th><th>SIM, APÓS LEMBRAR</th><th>NÃO</th><th>NA</th></tr>
    ${itens.map((t) => `<tr><td>${t}</td><td></td><td></td><td></td><td></td></tr>`).join('')}`).join('');
  const html = `${cabecalhoProtocolo(`${ck.titulo}<br><span style="font-weight:400;font-size:8pt">${ck.subtitulo}</span>`)}
    <table class="ft" style="font-size:8.5pt">
      <tr><td colspan="3"><strong>PACIENTE:</strong> ${esc(id.nome)}</td><td><strong>REG.:</strong> ${esc(id.registro)}</td></tr>
      <tr><td><strong>NASC.:</strong> ${esc(id.nascimento)}${internacao.paciente?.dataNascimento ? ` (${idade(internacao.paciente.dataNascimento, data)} anos)` : ''}</td><td><strong>SETOR:</strong> ${esc(unidadeNome)}</td><td><strong>LEITO:</strong> ${esc(leitoNum)}</td>
        <td><strong>DATA:</strong> ${dispositivo?.insercao ? formatarData(dispositivo.insercao) : formatarData(data)}&nbsp;&nbsp;<strong>HORA:</strong> ____:____</td></tr>
    </table>
    <table class="ft" style="margin-top:2mm;font-size:8.5pt">${cab}</table>
    <table class="ft" style="margin-top:2mm;font-size:8.5pt"><colgroup><col style="width:58%"><col><col><col><col></colgroup>${secoes}
      <tr><td colspan="5" style="height:14mm;vertical-align:top"><strong>OBSERVAÇÕES:</strong></td></tr></table>
    <div class="ins-assin">${ck.assinaturas.map((a) => `<div>${a}</div>`).join('')}</div>
    <p style="font-size:7pt;margin-top:4mm">Procedimento só é considerado conforme quando todos os itens forem cumpridos (ou não se aplicarem). Em caso de não conformidade, interromper e corrigir antes de prosseguir.</p>`;
  return { html, orientacao: 'retrato', classe: 'folha-insercao' };
}

export { LUMENS };
