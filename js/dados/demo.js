// Modo demonstração: mesma interface de firebase.js, com dados FICTÍCIOS em
// memória. Nada é gravado: ao recarregar a página, tudo volta ao início.
// Serve para conhecer as telas e treinar sem Firebase configurado.

import { UNIDADES_PADRAO } from '../config.js';
import { ErroSistema } from './erros.js';
import { idPaciente, resumoParaLeito } from '../regras/validacao.js';
import { agoraLocalISO, somarDias, hojeISO } from '../regras/datas.js';
import { diaAssistencial, diaAnterior, idEvolucao } from '../regras/turnos.js';

export const modo = 'demo';

const espera = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const clone = (o) => structuredClone(o);
let seq = 1;
const novoId = () => `demo${String(seq++).padStart(4, '0')}`;

const USUARIO = { uid: 'demo-admin', email: 'demonstracao@exemplo.org' };
const usuarios = {
  'demo-admin': { nome: 'ENFERMEIRA DEMONSTRAÇÃO', coren: '000000-RN', email: USUARIO.email, perfil: 'admin', ativo: true, unidades: ['uti1', 'uti2'] },
  'demo-pend': { nome: 'ENFERMEIRO NOVO EXEMPLO', coren: '111111-RN', email: 'novo@exemplo.org', perfil: 'pendente', ativo: false, unidades: [] },
};
const unidades = {};
const leitos = {};
const internacoes = {};
const pacientes = {};
const auditoriaLog = [];
const observadores = new Set();

function notificar() {
  for (const o of observadores) o();
}
function auditar(acao, dados) {
  auditoriaLog.push({ acao, ...dados, por: USUARIO.uid, em: new Date().toISOString() });
}

for (const u of UNIDADES_PADRAO) {
  unidades[u.id] = { nome: u.nome, ordem: u.ordem, leitos: [...u.leitos] };
  for (const n of u.leitos)
    leitos[`${u.id}_${n}`] = { unidade: u.id, numero: n, internacaoId: null, resumo: null, bloqueado: false, bloqueio: null };
}

// Pacientes fictícios (nomes inventados, sem relação com pessoas reais).
const hoje = hojeISO();
const exemplos = [
  ['uti1_01', 'ANA EXEMPLO FICTÍCIA', '1958-03-12', 'DEMO-1001', 'SUS', -3, 'Choque séptico de foco pulmonar; neoplasia de pulmão em quimioterapia', 'possui', 'Dipirona', 'contato', 'Bactéria multirresistente em vigilância'],
  ['uti1_02', 'BRUNO MODELO TESTE', '1971-11-30', 'DEMO-1002', 'Convênio exemplo', -1, 'Pós-operatório imediato de gastrectomia', 'nega', '', 'padrao', ''],
  ['uti1_04', 'CARLA SIMULADA SOUZA', '1985-06-02', 'DEMO-1003', 'SUS', 0, 'Neutropenia febril; leucemia mieloide aguda', 'desconhecida', '', 'protetor', 'Neutropenia grave'],
  ['uti1_05', 'DANIEL FICTÍCIO LIMA', '1949-01-20', 'DEMO-1004', 'SUS', -9, 'Insuficiência respiratória aguda; neoplasia de laringe', 'possui', 'Penicilina; iodo', 'padrao', ''],
  ['uti2_01', 'ELISA TESTE ROCHA', '1963-09-08', 'DEMO-2001', 'SUS', -2, 'Hemorragia digestiva alta; neoplasia de estômago', 'nega', '', 'padrao', ''],
];
for (const [leitoId, nome, dn, reg, conv, dias, diag, alSit, alDesc, isoT, isoM] of exemplos) {
  const id = novoId();
  const l = leitos[leitoId];
  const adm = `${somarDias(hoje, dias)}T${dias === 0 ? '06:40' : '14:20'}`;
  const i = {
    paciente: { nome, dataNascimento: dn, registro: reg, convenio: conv },
    tipo: dias === -1 ? 'cirurgico' : 'clinico', admissaoUti: adm, admissaoHospital: somarDias(hoje, dias - 2),
    diagnosticoMedico: diag, comorbidades: 'Hipertensão arterial', especialidade: 'Oncologia clínica',
    alergias: { situacao: alSit, descricao: alDesc }, isolamento: { tipo: isoT, motivo: isoM }, pulseira: true,
    pacienteId: idPaciente(reg), unidade: l.unidade, leitoId, status: 'ativa', desfecho: null,
    historicoLeitos: [{ leitoId, unidade: l.unidade, de: adm, ate: '' }], versao: 1,
  };
  internacoes[id] = i;
  pacientes[i.pacienteId] = { ...i.paciente };
  l.internacaoId = id;
  l.resumo = resumoParaLeito(i);
}
leitos.uti1_08.bloqueado = true;
leitos.uti1_08.bloqueio = { motivo: 'Manutenção / equipamento', desde: new Date().toISOString(), por: 'demo-admin' };

// --------------------------------------------------------------------------- sessão
let sessaoCb = null;
let logado = false;

export function aoMudarSessao(cb) {
  sessaoCb = cb;
  setTimeout(() => cb(logado ? USUARIO : null), 50);
  return () => { sessaoCb = null; };
}
export async function entrarComGoogle() {
  await espera(300);
  logado = true;
  sessaoCb?.(USUARIO);
}
export async function solicitarAcesso() {
  await espera();
  throw new ErroSistema('demo', 'No modo demonstração não é possível solicitar acesso.');
}
export async function confirmarIdentidade() {
  await espera(200);
}
export const obterToken = async () => 'token-demo';
export const tudoEnviado = async () => true;
export async function sair() {
  location.reload();
}

// --------------------------------------------------------------------------- perfis
export async function lerPerfil(id) {
  await espera();
  return usuarios[id] ? { uid: id, ...clone(usuarios[id]) } : null;
}
export async function listarUsuarios() {
  await espera();
  return Object.entries(usuarios).map(([uid, u]) => ({ uid, ...clone(u) }));
}
export async function atualizarUsuario(id, { perfil, ativo, unidades: us }) {
  await espera();
  Object.assign(usuarios[id], { perfil, ativo, unidades: us });
  auditar('usuario_atualizado', { usuario: id });
}

// --------------------------------------------------------------------------- unidades e leitos
export async function listarUnidades() {
  await espera();
  return Object.entries(unidades).map(([id, u]) => ({ id, ...clone(u) })).sort((a, b) => a.ordem - b.ordem);
}
export async function configurarUnidades() {
  await espera();
}
export async function atualizarLeitosUnidade(unidade, novaLista) {
  await espera();
  const u = unidades[unidade];
  for (const n of u.leitos.filter((x) => !novaLista.includes(x)))
    if (leitos[`${unidade}_${n}`]?.internacaoId) throw new ErroSistema('leito_com_paciente');
  for (const n of u.leitos.filter((x) => !novaLista.includes(x))) delete leitos[`${unidade}_${n}`];
  for (const n of novaLista.filter((x) => !u.leitos.includes(x)))
    leitos[`${unidade}_${n}`] = { unidade, numero: n, internacaoId: null, resumo: null, bloqueado: false, bloqueio: null };
  u.leitos = [...novaLista];
  auditar('leitos_configurados', { unidade });
  notificar();
}
export function observarLeitos(unidade, cb) {
  const enviar = () =>
    cb(
      Object.entries(leitos).filter(([, l]) => l.unidade === unidade).map(([id, l]) => ({ id, ...clone(l) })),
      { doCache: false, pendente: false },
    );
  observadores.add(enviar);
  setTimeout(enviar, 60);
  return () => observadores.delete(enviar);
}
export async function bloquearLeito(leitoId, motivo) {
  await espera();
  const l = leitos[leitoId];
  if (l.internacaoId) throw new ErroSistema('leito_ocupado');
  Object.assign(l, { bloqueado: true, bloqueio: { motivo, desde: new Date().toISOString(), por: USUARIO.uid } });
  auditar('leito_bloqueado', { leitoId });
  notificar();
}
export async function desbloquearLeito(leitoId) {
  await espera();
  Object.assign(leitos[leitoId], { bloqueado: false, bloqueio: null });
  auditar('leito_desbloqueado', { leitoId });
  notificar();
}

// --------------------------------------------------------------------------- pacientes e internações
export async function buscarPaciente(registro) {
  await espera();
  return clone(pacientes[idPaciente(registro)] ?? null);
}
export async function lerInternacao(id) {
  await espera();
  return internacoes[id] ? { id, ...clone(internacoes[id]) } : null;
}
export async function admitir(leitoId, dados) {
  await espera(250);
  const l = leitos[leitoId];
  if (!l) throw new ErroSistema('leito_inexistente');
  if (l.internacaoId) throw new ErroSistema('leito_ocupado');
  if (l.bloqueado) throw new ErroSistema('leito_bloqueado');
  const id = novoId();
  const pacienteId = idPaciente(dados.paciente.registro);
  pacientes[pacienteId] = clone(dados.paciente);
  internacoes[id] = {
    ...clone(dados), pacienteId, unidade: l.unidade, leitoId, status: 'ativa', desfecho: null,
    historicoLeitos: [{ leitoId, unidade: l.unidade, de: dados.admissaoUti, ate: '' }], versao: 1,
  };
  l.internacaoId = id;
  l.resumo = resumoParaLeito(internacoes[id]);
  auditar('admissao', { internacaoId: id, leitoId });
  notificar();
  return id;
}
function ativa(id) {
  const i = internacoes[id];
  if (!i) throw new ErroSistema('internacao_inexistente');
  if (i.status !== 'ativa') throw new ErroSistema('internacao_encerrada');
  return i;
}
export async function atualizarInternacao(id, dados, versaoLida) {
  await espera(200);
  const i = ativa(id);
  if (versaoLida && i.versao !== versaoLida) throw new ErroSistema('conflito_versao');
  const reg = i.paciente.registro;
  Object.assign(i, clone(dados), { versao: i.versao + 1 });
  i.paciente.registro = reg;
  pacientes[i.pacienteId] = clone(i.paciente);
  leitos[i.leitoId].resumo = resumoParaLeito(i);
  auditar('internacao_corrigida', { internacaoId: id });
  notificar();
}
export async function alterarIsolamento(id, isolamento) {
  await espera(200);
  const i = ativa(id);
  Object.assign(i, { isolamento: clone(isolamento), versao: i.versao + 1 });
  leitos[i.leitoId].resumo = resumoParaLeito(i);
  auditar('isolamento_alterado', { internacaoId: id });
  notificar();
}
export async function transferirLeito(id, destino, dataHora = agoraLocalISO()) {
  await espera(200);
  const i = ativa(id);
  const d = leitos[destino];
  if (!d) throw new ErroSistema('leito_inexistente');
  if (d.internacaoId) throw new ErroSistema('leito_ocupado');
  if (d.bloqueado) throw new ErroSistema('leito_bloqueado');
  i.historicoLeitos[i.historicoLeitos.length - 1].ate = dataHora;
  i.historicoLeitos.push({ leitoId: destino, unidade: d.unidade, de: dataHora, ate: '' });
  Object.assign(leitos[i.leitoId], { internacaoId: null, resumo: null });
  Object.assign(d, { internacaoId: id, resumo: resumoParaLeito(i) });
  Object.assign(i, { leitoId: destino, unidade: d.unidade, versao: i.versao + 1 });
  auditar('transferencia_leito', { internacaoId: id });
  notificar();
}
export async function encerrarInternacao(id, desfecho) {
  await espera(200);
  const i = ativa(id);
  i.historicoLeitos[i.historicoLeitos.length - 1].ate = desfecho.dataHora;
  Object.assign(leitos[i.leitoId], { internacaoId: null, resumo: null });
  Object.assign(i, { status: 'encerrada', desfecho: { ...desfecho, registradoPor: USUARIO.uid }, versao: i.versao + 1 });
  auditar('desfecho', { internacaoId: id });
  notificar();
}

// --------------------------------------------------------------------------- evolução (demonstração)
const evolucoes = {};
const obsEvol = new Set();
function notificarEvol() {
  for (const o of obsEvol) o();
}
{
  // Exemplo: evolução finalizada no turno anterior para o leito 01 (com pendência aberta).
  const ana = Object.entries(internacoes).find(([, i]) => i.leitoId === 'uti1_01');
  if (ana) {
    const ant = diaAnterior(diaAssistencial());
    const id = idEvolucao(ana[0], ant);
    evolucoes[id] = {
      internacaoId: ana[0], unidade: 'uti1', leitoId: 'uti1_01', data: ant, turnoInicio: 'N', status: 'finalizada', versao: 1,
      dados: {
        cuidado: { limitacao: 'nao', objetivos: 'curativo' },
        sinais: { horario: '20:00', estadoGeral: 'grave', t: '38,2', fc: '118', fr: '26', pas: '92', pad: '54', spo2: '93' },
        neuro: { consciencia: 'sedado', rass: '-4', metaRass: '-3', pupilas: 'isocoricas', fotoD: 'presente', fotoE: 'presente', interrupcao: 'nao_realizada' },
        respiratorio: { suporte: 'vmi_tot', modo: 'PCV', peep: '10', fio2: '50', padrao: ['assincronia'], ausculta: ['mv_diminuidos', 'roncos'], mvDiminuidosLocal: ['base_d'], secrecao: 'moderada', secrecaoAspecto: 'Amarelada' },
        hemodinamica: { ritmo: 'sinusal', auscultaCardiaca: ['bnf2t'], tec: 'mais3', extremidades: 'frias', edemaLocais: ['mmii'], edemaGrau: '2' },
        abdome: { exame: ['globoso', 'flacido'], rha: 'diminuidos', ascite: 'nao' },
        infusoes: { itens: [{ grupo: 'hv', medicamento: 'SORO FISIOLÓGICO 0,9%', vazao: '40' }, { grupo: 'dva', medicamento: 'NORADRENALINA', vazao: '18' }, { grupo: 'sedo', medicamento: 'MIDAZOLAM', vazao: '8' }, { grupo: 'sedo', medicamento: 'FENTANIL', vazao: '3' }] },
        gi: { via: ['sne'], dieta: 'Enteral padrão a 40 mL/h', evacuou: 'nao' },
        herdado: { ultimaEvacuacao: somarDias(hoje, -3) },
        pele: { inspecao: ['hipocorada', 'acianotica', 'anicterica', 'nao_integra'], mucosas: 'ressecadas', lesoes: [{ tipo: 'lpp', local: 'sacral', estagio: '2', medidas: '3 x 2', cobertura: 'Hidrocoloide', evolucao: 'estavel' }] },
        dispositivos: { itens: [
          { id: 'demo1', tipo: 'cvc', local: 'JUGULAR INTERNA', lado: 'D', lumens: '3', insercao: somarDias(hoje, -3), implantadoUti: 'sim', curativoTipo: 'filme', curativoData: somarDias(hoje, -3), sitio: ['sem_alteracoes'], necessario: 'sim' },
          { id: 'demo2', tipo: 'tot', numero: '7,5', fixacao: '22', insercao: somarDias(hoje, -3), necessario: 'sim' },
          { id: 'demo3', tipo: 'cvd', numero: '16', insercao: somarDias(hoje, -3), implantadoUti: 'sim', necessario: 'sim' },
          { id: 'demo4', tipo: 'avp', local: 'CEFÁLICA', lado: 'E', calibre: '20G', insercao: somarDias(hoje, -5), curativoTipo: 'filme', curativoData: somarDias(hoje, -5), necessario: 'sim' },
          { id: 'demo5', tipo: 'sne', numero: '12', fixacao: '60', insercao: somarDias(hoje, -2), necessario: 'sim' },
        ] },
        antimicrobianos: { itens: [{ nome: 'Meropeném', inicio: somarDias(hoje, -2), previsto: '7' }], culturas: [{ material: 'Hemocultura', coleta: somarDias(hoje, -2), resultado: 'Em andamento' }] },
        pendencias: { itens: [{ descricao: 'Resultado da hemocultura de ontem', comunicado: 'Plantonista', situacao: 'aberta' }] },
        narrativa: { texto: 'Piora hemodinâmica no fim do turno, com aumento da noradrenalina. Febre persistente.' },
        // Processo de Enfermagem concluído, com aprazamento (catálogo fictício da demonstração).
        sae: { status: 'concluido', sugestao: null, versaoLigacoes: 'demo', diagnosticos: [
          { codigo: '90003', titulo: 'Risco de lesão por pressão (exemplo fictício)', categoria: 'Potencial para deteriorar', dominio: 'Exemplo — Pele', origem: 'enfermeiro', situacao: 'ativo', confirmado: true,
            evidencias: { cd: [], fr: [], ri: [{ id: 'RI1', texto: 'Imobilidade no leito (exemplo)' }, { id: 'RI2', texto: 'Sedação contínua (exemplo)' }], pr: [], ca: [] }, observacao: '',
            noc: [{ codigo: '9103', titulo: 'Integridade da pele (exemplo)', indicadores: [{ codigo: '910301', texto: 'Pele íntegra em proeminências (exemplo)', niveis: ['Gravemente comprometido', 'Muito comprometido', 'Moderadamente comprometido', 'Levemente comprometido', 'Não comprometido'], meta: '4', pontuacao: '3', anterior: '' }] }],
            nic: [{ codigo: '9203', titulo: 'Prevenção de lesão por pressão (exemplo)', nivel: 'Técnico de enfermagem', atividades: [
              { id: 'A1', texto: 'Mudar o decúbito a cada 2 horas (exemplo)', status: 'realizado', justificativa: '', freq: '02/02H', horarios: ['08', '10', '12', '14', '16', '18', '20', '22', '00', '02', '04', '06'], obsPrescricao: 'D → DD → E' },
              { id: 'A3', texto: 'Manter a pele limpa e seca (exemplo)', status: 'realizado', justificativa: '', freq: 'TURNO', horarios: ['08', '14', '20'] }] }],
            decisao: 'manter', decisaoMotivo: '' },
          { codigo: '90001', titulo: 'Risco de infecção (exemplo fictício)', categoria: 'Potencial para deteriorar', dominio: 'Exemplo — Segurança', origem: 'enfermeiro', situacao: 'ativo', confirmado: true,
            evidencias: { cd: [], fr: [], ri: [{ id: 'RI1', texto: 'Uso de cateter venoso central (exemplo)' }], pr: [], ca: [] }, observacao: '',
            noc: [{ codigo: '9101', titulo: 'Controle de infecção (exemplo)', indicadores: [{ codigo: '910101', texto: 'Febre (exemplo)', niveis: ['Grave', 'Substancial', 'Moderado', 'Leve', 'Nenhum'], meta: '4', pontuacao: '2', anterior: '' }] }],
            nic: [{ codigo: '9201', titulo: 'Cuidados com dispositivos invasivos (exemplo)', nivel: 'Enfermeiro registrado', atividades: [
              { id: 'A1', texto: 'Avaliar diariamente a necessidade de cada dispositivo (exemplo)', status: 'realizado', justificativa: '', freq: '24/24H', horarios: ['08'] },
              { id: 'A2', texto: 'Manter curativo íntegro e datado (exemplo)', status: 'realizado', justificativa: '', freq: 'SN', horarios: [], obsPrescricao: 'Filme transparente: trocar a cada 7 dias ou se sujo/descolado' }] }],
            decisao: 'manter', decisaoMotivo: '' },
        ] },
      },
      confirmados: {}, finalizadoPorNome: { nome: 'ENFERMEIRA DEMONSTRAÇÃO', coren: '000000-RN' }, finalizadoEmTexto: 'dia anterior',
    };
  }
}
export function observarEvolucoesDia(unidade, data, cb) {
  const enviar = () => cb(Object.entries(evolucoes).filter(([, e]) => e.unidade === unidade && e.data === data).map(([id, e]) => ({ id, ...clone(e) })));
  obsEvol.add(enviar);
  setTimeout(enviar, 60);
  return () => obsEvol.delete(enviar);
}
export async function lerEvolucao(id) {
  await espera(80);
  return evolucoes[id] ? { id, ...clone(evolucoes[id]) } : null;
}
export async function abrirEvolucao(id, base) {
  await espera(150);
  if (!evolucoes[id]) evolucoes[id] = { ...clone(base), status: 'rascunho', versao: 1, confirmados: {}, criadoPor: USUARIO.uid };
  notificarEvol();
  return { id, ...clone(evolucoes[id]) };
}
const obsUma = new Map();
export function observarEvolucao(id, cb) {
  const f = () => evolucoes[id] && cb({ id, ...clone(evolucoes[id]) }, { pendente: false, deOutroAparelho: false });
  obsUma.set(f, id);
  setTimeout(f, 30);
  return () => obsUma.delete(f);
}
export function salvarSubbloco(id, sub, dados, confirmado) {
  const e = evolucoes[id];
  e.dados = { ...(e.dados || {}), [sub]: clone(dados) };
  e.confirmados = { ...(e.confirmados || {}) };
  if (confirmado) e.confirmados[sub] = clone(confirmado); else delete e.confirmados[sub];
  notificarEvol();
  return espera(250);
}
export async function finalizarEvolucao(id, { autor, pendenciasAutomaticas, emTexto }) {
  await espera(200);
  Object.assign(evolucoes[id], { status: 'finalizada', finalizadoPorNome: autor, finalizadoEmTexto: emTexto, pendenciasAutomaticas });
  auditar('evolucao_finalizada', { evolucaoId: id });
  notificarEvol();
  for (const [f, i] of obsUma) if (i === id) f();
}
export async function retificarEvolucao(id, { motivo, emTexto, autor }) {
  await espera(200);
  const e = evolucoes[id];
  Object.assign(e, { status: 'rascunho', versao: e.versao + 1, retificacao: { motivo, porNome: autor, emTexto } });
  auditar('evolucao_retificada', { evolucaoId: id });
  notificarEvol();
  for (const [f, i] of obsUma) if (i === id) f();
}
export async function marcarTranscrita(id, { versao, autor, emTexto }) {
  await espera(150);
  evolucoes[id].transcritoPEP = { versao, porNome: autor, emTexto };
  notificarEvol();
  for (const [f, i] of obsUma) if (i === id) f();
}

// --------------------------------------------------------------------------- check-list diário de IRAS
const checklistsIras = {};
export async function lerChecklistIras(id) {
  await espera(60);
  return checklistsIras[id] ? { id, ...clone(checklistsIras[id]) } : null;
}
export async function salvarChecklistIras(id, dados) {
  checklistsIras[id] = { ...clone(dados), atualizadoPor: USUARIO.uid };
  return espera(120);
}

// --------------------------------------------------------------------------- capa da ocorrência (observações)
const capas = {};
export async function lerCapaOcorrencia(id) {
  await espera(40);
  return capas[id] ? { id, ...clone(capas[id]) } : null;
}
export async function salvarCapaOcorrencia(id, dados) {
  capas[id] = { ...clone(dados), atualizadoPor: USUARIO.uid };
  return espera(80);
}

// --------------------------------------------------------------------------- check-lists de inserção (CVC e CVD)
const checklistsInsercao = {};
export async function lerChecklistInsercao(id) {
  await espera(60);
  return checklistsInsercao[id] ? { id, ...clone(checklistsInsercao[id]) } : null;
}
export async function listarChecklistsInsercao(unidade, internacaoId) {
  await espera(80);
  return Object.entries(checklistsInsercao).filter(([, c]) => c.unidade === unidade && c.internacaoId === internacaoId)
    .map(([id, c]) => ({ id, ...clone(c) })).sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
}
export async function salvarChecklistInsercao(id, dados) {
  const { id: _ignorar, ...resto } = clone(dados);
  checklistsInsercao[id] = { ...resto, atualizadoPor: USUARIO.uid };
  return espera(120);
}

// --------------------------------------------------------------------------- registro de operações
export async function registrarEvento() { /* demonstração: nada é registrado */ }
