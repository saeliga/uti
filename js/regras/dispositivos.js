// Dispositivos: catálogo por tipo (campos que cada um pede), texto para o PEP e
// alertas. Baseado no modal do piloto do Hospital dos Pescadores, com localização
// em lista, lado, lúmens, calibre, curativo, avaliação do sítio e retirada.
// Funções puras (testáveis no Node).

import { contagemDia, diasEntre, formatarData } from './datas.js';

const CENTRAIS = ['JUGULAR INTERNA', 'SUBCLÁVIA', 'FEMORAL'];
const PERIFERICOS = ['CEFÁLICA', 'BASÍLICA', 'MEDIANA', 'DORSO DA MÃO', 'ANTEBRAÇO', 'JUGULAR EXTERNA', 'MEMBRO INFERIOR', 'OUTRO'];

/**
 * campos: local, lado, lumens, calibre, numero, fixacao, subtipo, descricao.
 * curativo: acompanha tipo e data do curativo; sitio: avalia o sítio de inserção;
 * debito: registra volume e aspecto no período (drenos).
 */
export const CATALOGO_DISPOSITIVOS = {
  cvc: { nome: 'Cateter venoso central (CVC)', curto: 'CVC', campos: ['local', 'lado', 'lumens', 'calibre'], locais: CENTRAIS, curativo: true, sitio: true, central: true },
  cateter_dialise: { nome: 'Cateter de hemodiálise', curto: 'cateter de hemodiálise', campos: ['local', 'lado', 'lumens'], locais: CENTRAIS, curativo: true, sitio: true, central: true },
  picc: { nome: 'PICC', curto: 'PICC', campos: ['local', 'lado', 'lumens', 'calibre'], locais: ['BASÍLICA', 'BRAQUIAL', 'CEFÁLICA'], curativo: true, sitio: true, central: true },
  cti: { nome: 'Cateter venoso totalmente implantado', curto: 'cateter totalmente implantado', campos: ['local', 'lado'], locais: ['TÓRAX', 'MEMBRO SUPERIOR', 'OUTRO'], curativo: true, sitio: true, central: true },
  avp: { nome: 'Acesso venoso periférico (AVP)', curto: 'AVP', campos: ['local', 'lado', 'calibre'], locais: PERIFERICOS, curativo: true, sitio: true, trocaDias: 4 },
  pai: { nome: 'Cateter de pressão arterial invasiva', curto: 'cateter de pressão arterial invasiva', campos: ['local', 'lado', 'calibre'], locais: ['RADIAL', 'FEMORAL', 'BRAQUIAL', 'PEDIOSA'], curativo: true, sitio: true },
  tot: { nome: 'Tubo orotraqueal (TOT)', curto: 'TOT', campos: ['numero', 'fixacao'] },
  tqt: { nome: 'Traqueostomia (TQT)', curto: 'TQT', campos: ['numero', 'subtipo'], subtipos: ['PLÁSTICA COM CUFF', 'PLÁSTICA SEM CUFF', 'METÁLICA'], sitio: true },
  cvd: { nome: 'Cateter vesical de demora (CVD)', curto: 'CVD', campos: ['numero'] },
  sne: { nome: 'Sonda nasoenteral (SNE)', curto: 'SNE', campos: ['numero', 'fixacao'] },
  soe: { nome: 'Sonda oroenteral (SOE)', curto: 'SOE', campos: ['numero', 'fixacao'] },
  sng: { nome: 'Sonda nasogástrica (SNG)', curto: 'SNG', campos: ['numero', 'fixacao'] },
  sog: { nome: 'Sonda orogástrica (SOG)', curto: 'SOG', campos: ['numero', 'fixacao'] },
  gtm: { nome: 'Gastrostomia (GTM)', curto: 'GTM', campos: ['numero'], sitio: true },
  dreno: { nome: 'Dreno', curto: 'dreno', campos: ['subtipo', 'local', 'lado'], subtipos: ['TORÁCICO', 'MEDIASTINAL', 'ABDOMINAL', 'PENROSE', 'BLAKE', 'PORTOVAC', 'KEHR', 'PIGTAIL', 'OUTRO'],
    locais: ['TÓRAX', 'MEDIASTINO', 'ABDOME', 'PELVE', 'OUTRO'], sitio: true, debito: true },
  outro: { nome: 'Outro dispositivo', curto: 'dispositivo', campos: ['descricao', 'local'], locais: null },
};

export const ROTULOS_CAMPO = {
  local: 'Localização / sítio', lado: 'Lado', lumens: 'Número de lúmens (vias)', calibre: 'Calibre', numero: 'Número (calibre)',
  fixacao: 'Fixação (cm)', subtipo: 'Tipo', descricao: 'Descrição do dispositivo',
};
export const LADOS = { D: 'Direito', E: 'Esquerdo', NA: 'Não se aplica' };
export const LUMENS = { 1: '1 (mono)', 2: '2 (duplo)', 3: '3 (triplo)', 4: '4 ou mais' };
export const CURATIVOS = { filme: 'Filme transparente', gaze: 'Gaze e fita adesiva', filme_clorexidina: 'Filme com gel de clorexidina', outro: 'Outro' };
// Dias para a troca do curativo (protocolo usual: filme até 7 dias; gaze diária).
const TROCA_CURATIVO = { filme: 7, filme_clorexidina: 7, gaze: 1 };
export const SITIO = { sem_alteracoes: 'Sem alterações', hiperemia: 'Hiperemia', secrecao: 'Secreção purulenta', dor: 'Dor à palpação', edema: 'Edema', sangramento: 'Sangramento' };

export const ativo = (i) => !!i?.tipo && !i.retirada;
export const definicao = (tipo) => CATALOGO_DISPOSITIVOS[tipo] || CATALOGO_DISPOSITIVOS.outro;

/** Nome curto com detalhes, ex.: "CVC jugular interna direita, triplo lúmen". */
export function rotuloDispositivo(i) {
  const def = definicao(i.tipo);
  const nome = i.tipo === 'outro' ? (i.descricao || 'outro dispositivo') : i.tipo === 'dreno' && i.subtipo ? `dreno ${String(i.subtipo).toLowerCase()}` : def.curto;
  const local = i.local === 'OUTRO' ? i.localOutro : i.local;
  const lado = i.lado === 'D' ? 'lado direito' : i.lado === 'E' ? 'lado esquerdo' : '';
  const partes = [
    local && local.toLowerCase(), lado,
    i.lumens && `${LUMENS[i.lumens]?.replace(/ \(.*\)/, '') || i.lumens} lúmen${Number(i.lumens) > 1 ? 's' : ''}`,
    i.calibre && `calibre ${i.calibre}`,
    i.numero && `número ${i.numero}`,
    i.fixacao && `fixação ${String(i.fixacao).replace('.', ',')} cm`,
    i.tipo === 'tqt' && i.subtipo && String(i.subtipo).toLowerCase(),
  ].filter(Boolean);
  return [nome, ...partes].join(', ');
}

/** Alertas de um dispositivo ativo na data do turno. */
export function alertasDispositivo(i, dataTurno) {
  if (!ativo(i)) return [];
  const def = definicao(i.tipo);
  const a = [];
  const dias = i.insercao ? diasEntre(i.insercao, dataTurno) : null;
  if (def.trocaDias && dias != null && dias >= def.trocaDias) a.push({ nivel: 'alto', texto: `${def.curto} com ${dias} dias (96 h ou mais): avaliar a troca` });
  if (def.curativo) {
    if (!i.curativoTipo || !i.curativoData) a.push({ nivel: 'medio', texto: 'curativo sem registro de tipo e data' });
    else {
      const limite = TROCA_CURATIVO[i.curativoTipo];
      const d = diasEntre(i.curativoData, dataTurno);
      if (limite && d != null && d >= limite) a.push({ nivel: 'alto', texto: `curativo (${CURATIVOS[i.curativoTipo].toLowerCase()}) aplicado há ${d} dia(s): troca vencida` });
    }
  }
  const alterado = (i.sitio || []).filter((s) => s !== 'sem_alteracoes');
  if (alterado.length) a.push({ nivel: 'alto', texto: `sítio: ${alterado.map((s) => SITIO[s].toLowerCase()).join(', ')}` });
  return a;
}

/** Texto de um dispositivo para o PEP. */
export function textoDispositivo(i, dataTurno) {
  const def = definicao(i.tipo);
  const partes = [rotuloDispositivo(i)];
  if (i.insercao) partes.push(`inserção ${formatarData(i.insercao)} (${contagemDia(i.insercao, dataTurno)})`);
  if (i.implantadoUti === 'nao') partes.push('implantado fora da UTI');
  if (def.curativo && i.curativoTipo) partes.push(`curativo ${CURATIVOS[i.curativoTipo].toLowerCase()}${i.curativoData ? ` aplicado em ${formatarData(i.curativoData)}` : ''}`);
  if (def.sitio && i.sitio?.length) partes.push(`sítio: ${i.sitio.map((s) => SITIO[s].toLowerCase()).join(', ')}`);
  if (def.debito && (i.volume || i.aspecto)) partes.push(`débito ${i.volume ? `${String(i.volume).replace('.', ',')} mL` : 'não medido'}${i.aspecto ? `, aspecto ${i.aspecto}` : ''}`);
  if (i.necessario) partes.push(`necessário: ${i.necessario === 'sim' ? 'sim' : 'não'}`);
  if (i.retirada) partes.push(`retirado em ${formatarData(i.retirada)}`);
  return partes.join(', ');
}

export function textoDispositivos(itens = [], dataTurno) {
  const lista = itens.filter((i) => i?.tipo);
  return lista.map((i, k) => `${k + 1}) ${textoDispositivo(i, dataTurno)}`).join('; ');
}

/** Para a evolução do dia seguinte: só os ativos; avaliação do dia recomeça. */
export function dispositivosParaNovoDia(itens = []) {
  return itens.filter(ativo).map((i) => ({ ...i, sitio: [], necessario: '', volume: '', aspecto: '' }));
}
