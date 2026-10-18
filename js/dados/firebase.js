// Acesso ao Firebase (Auth + Firestore). Todo acesso ao banco passa por aqui.
// As regras do Firestore (firestore.rules) repetem as mesmas checagens no
// servidor: o que está aqui é conveniência, a proteção real está nas regras.

import { FIREBASE_CONFIG, ADMIN_INICIAL, DOMINIO_INSTITUCIONAL } from '../config.js';
import { ErroSistema, traduzirErro } from './erros.js';
import { idPaciente, resumoParaLeito } from '../regras/validacao.js';

const V = '10.14.1';
const CDN = `https://www.gstatic.com/firebasejs/${V}`;

const { initializeApp } = await import(`${CDN}/firebase-app.js`);
const A = await import(`${CDN}/firebase-auth.js`);
const F = await import(`${CDN}/firebase-firestore.js`);

const app = initializeApp(FIREBASE_CONFIG);
const auth = A.getAuth(app);
// Sessão termina ao fechar a aba (tablets compartilhados).
await A.setPersistence(auth, A.browserSessionPersistence);

// Cache local (IndexedDB) para funcionar com Wi-Fi instável. É apagado ao sair.
let db = F.initializeFirestore(app, {
  localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
});

const agora = () => F.serverTimestamp();
const uid = () => auth.currentUser?.uid;

function auditoria(tx, acao, dados) {
  tx.set(F.doc(F.collection(db, 'auditoria')), { acao, ...dados, por: uid(), em: agora() });
}

async function executar(fn) {
  try {
    return await fn();
  } catch (e) {
    throw traduzirErro(e);
  }
}

// --------------------------------------------------------------------------- sessão
export const modo = 'firebase';

const institucional = (email) => String(email || '').toLowerCase().endsWith(`@${DOMINIO_INSTITUCIONAL}`);

export function aoMudarSessao(cb) {
  return A.onAuthStateChanged(auth, (u) => {
    // Sessão de conta fora do domínio institucional (ex.: guardada de antes da restrição): encerra.
    if (u && !institucional(u.email)) { A.signOut(auth); return cb(null); }
    cb(u ? { uid: u.uid, email: u.email, nome: u.displayName || '' } : null);
  });
}

// Login com Google. "select_account" faz o Google perguntar qual conta usar a
// cada entrada (importante em tablet compartilhado). Usa janela (popup) porque o
// redirecionamento falha quando o site (github.io) e o Firebase têm domínios diferentes.
const provedor = new A.GoogleAuthProvider();
// hd: o Google já sugere as contas do domínio institucional (a conferência de verdade é nas regras).
provedor.setCustomParameters({ prompt: 'select_account', hd: DOMINIO_INSTITUCIONAL });

export async function entrarComGoogle() {
  const r = await executar(() => A.signInWithPopup(auth, provedor));
  if (!institucional(r.user?.email)) {
    await A.signOut(auth);
    throw new ErroSistema('conta_nao_institucional');
  }
  return r;
}

/** Primeiro acesso: cria a solicitação (perfil pendente) com nome e Coren. */
export async function solicitarAcesso({ nome, coren }) {
  return executar(() => {
    const u = auth.currentUser;
    const admin = u.email.toLowerCase() === ADMIN_INICIAL.toLowerCase();
    return F.setDoc(F.doc(db, 'usuarios', u.uid), {
      nome, coren, email: u.email,
      perfil: admin ? 'admin' : 'pendente', ativo: admin, unidades: admin ? ['uti1', 'uti2'] : [],
      criadoEm: agora(),
    });
  });
}

/** Desbloqueio da tela: o Google confirma que é a mesma conta da sessão. */
export const confirmarIdentidade = () => executar(() => A.reauthenticateWithPopup(auth.currentUser, provedor));

export const obterToken = () => auth.currentUser?.getIdToken() ?? Promise.resolve(null);

/** true se todas as gravações chegaram ao servidor dentro do prazo. */
export async function tudoEnviado(ms = 4000) {
  const espera = F.waitForPendingWrites(db).then(() => true);
  const prazo = new Promise((r) => setTimeout(() => r(false), ms));
  return Promise.race([espera, prazo]);
}

/** Sai e apaga o cache local do aparelho (dados de pacientes não ficam no tablet).
 *  `depois`: endereço para abrir em seguida (sair da conta Google). */
export async function sair({ depois } = {}) {
  await A.signOut(auth);
  try {
    await F.terminate(db);
    await F.clearIndexedDbPersistence(db);
  } catch (e) {
    console.warn('[sair] cache não apagado', e?.code);
  }
  if (depois) location.href = depois; // ex.: sair também da conta Google
  else location.reload();
}

// --------------------------------------------------------------------------- perfis
export async function lerPerfil(id) {
  return executar(async () => {
    const s = await F.getDoc(F.doc(db, 'usuarios', id));
    return s.exists() ? { uid: id, ...s.data() } : null;
  });
}

export async function listarUsuarios() {
  return executar(async () => {
    const s = await F.getDocs(F.collection(db, 'usuarios'));
    return s.docs.map((d) => ({ uid: d.id, ...d.data() }));
  });
}

export async function atualizarUsuario(id, { perfil, ativo, unidades }) {
  return executar(() =>
    F.runTransaction(db, async (tx) => {
      tx.update(F.doc(db, 'usuarios', id), { perfil, ativo, unidades, atualizadoEm: agora(), atualizadoPor: uid() });
      auditoria(tx, 'usuario_atualizado', { usuario: id, perfil, ativo });
    }),
  );
}

// --------------------------------------------------------------------------- unidades e leitos
export async function listarUnidades() {
  return executar(async () => {
    const s = await F.getDocs(F.collection(db, 'unidades'));
    return s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.ordem - b.ordem);
  });
}

const idLeito = (unidade, numero) => `${unidade}_${numero}`;

function leitoNovo(unidade, numero) {
  return {
    unidade, numero, internacaoId: null, resumo: null,
    bloqueado: false, bloqueio: null, atualizadoEm: agora(), atualizadoPor: uid(),
  };
}

export async function configurarUnidades(unidades) {
  return executar(async () => {
    const b = F.writeBatch(db);
    for (const u of unidades) {
      b.set(F.doc(db, 'unidades', u.id), { nome: u.nome, ordem: u.ordem, leitos: u.leitos });
      for (const n of u.leitos) b.set(F.doc(db, 'leitos', idLeito(u.id, n)), leitoNovo(u.id, n));
    }
    await b.commit();
  });
}

export async function atualizarLeitosUnidade(unidade, novaLista) {
  return executar(() =>
    F.runTransaction(db, async (tx) => {
      const uRef = F.doc(db, 'unidades', unidade);
      const u = (await tx.get(uRef)).data();
      const remover = u.leitos.filter((n) => !novaLista.includes(n));
      const incluir = novaLista.filter((n) => !u.leitos.includes(n));
      for (const n of remover) {
        const l = await tx.get(F.doc(db, 'leitos', idLeito(unidade, n)));
        if (l.exists() && l.data().internacaoId) throw new ErroSistema('leito_com_paciente');
      }
      for (const n of remover) tx.delete(F.doc(db, 'leitos', idLeito(unidade, n)));
      for (const n of incluir) tx.set(F.doc(db, 'leitos', idLeito(unidade, n)), leitoNovo(unidade, n));
      tx.update(uRef, { leitos: novaLista });
      auditoria(tx, 'leitos_configurados', { unidade });
    }),
  );
}

/** Observa os leitos de uma unidade. cb(leitos, { doCache, pendente }). */
export function observarLeitos(unidade, cb, cbErro) {
  const q = F.query(F.collection(db, 'leitos'), F.where('unidade', '==', unidade));
  return F.onSnapshot(
    q,
    { includeMetadataChanges: true },
    (s) => {
      const leitos = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      cb(leitos, { doCache: s.metadata.fromCache, pendente: s.metadata.hasPendingWrites });
    },
    (e) => cbErro?.(traduzirErro(e)),
  );
}

export async function bloquearLeito(leitoId, motivo) {
  return executar(() =>
    F.runTransaction(db, async (tx) => {
      const ref = F.doc(db, 'leitos', leitoId);
      const l = (await tx.get(ref)).data();
      if (l.internacaoId) throw new ErroSistema('leito_ocupado');
      tx.update(ref, {
        bloqueado: true, bloqueio: { motivo, desde: new Date().toISOString(), por: uid() },
        atualizadoEm: agora(), atualizadoPor: uid(),
      });
      auditoria(tx, 'leito_bloqueado', { leitoId, unidade: l.unidade });
    }),
  );
}

export async function desbloquearLeito(leitoId) {
  return executar(() =>
    F.runTransaction(db, async (tx) => {
      const ref = F.doc(db, 'leitos', leitoId);
      const l = (await tx.get(ref)).data();
      tx.update(ref, { bloqueado: false, bloqueio: null, atualizadoEm: agora(), atualizadoPor: uid() });
      auditoria(tx, 'leito_desbloqueado', { leitoId, unidade: l.unidade });
    }),
  );
}

// --------------------------------------------------------------------------- pacientes e internações
export async function buscarPaciente(registro) {
  const id = idPaciente(registro);
  if (!id) return null;
  return executar(async () => {
    const s = await F.getDoc(F.doc(db, 'pacientes', id));
    return s.exists() ? s.data() : null;
  });
}

export async function lerInternacao(id) {
  return executar(async () => {
    const s = await F.getDoc(F.doc(db, 'internacoes', id));
    return s.exists() ? { id, ...s.data() } : null;
  });
}

/** Admite no leito (transação: só funciona com internet). Devolve o id da internação. */
export async function admitir(leitoId, dados) {
  return executar(async () => {
    const intRef = F.doc(F.collection(db, 'internacoes'));
    await F.runTransaction(db, async (tx) => {
      const lRef = F.doc(db, 'leitos', leitoId);
      const ls = await tx.get(lRef);
      if (!ls.exists()) throw new ErroSistema('leito_inexistente');
      const l = ls.data();
      if (l.internacaoId) throw new ErroSistema('leito_ocupado');
      if (l.bloqueado) throw new ErroSistema('leito_bloqueado');
      const pacienteId = idPaciente(dados.paciente.registro);
      tx.set(F.doc(db, 'pacientes', pacienteId), {
        ...dados.paciente, atualizadoEm: agora(), atualizadoPor: uid(),
      });
      const internacao = {
        ...dados, pacienteId, unidade: l.unidade, leitoId, status: 'ativa', desfecho: null,
        historicoLeitos: [{ leitoId, unidade: l.unidade, de: dados.admissaoUti, ate: '' }],
        criadoEm: agora(), criadoPor: uid(), atualizadoEm: agora(), atualizadoPor: uid(), versao: 1,
      };
      tx.set(intRef, internacao);
      tx.update(lRef, { internacaoId: intRef.id, resumo: resumoParaLeito(internacao), atualizadoEm: agora(), atualizadoPor: uid() });
      auditoria(tx, 'admissao', { internacaoId: intRef.id, leitoId, unidade: l.unidade });
    });
    return intRef.id;
  });
}

async function lerAtiva(tx, id) {
  const ref = F.doc(db, 'internacoes', id);
  const s = await tx.get(ref);
  if (!s.exists()) throw new ErroSistema('internacao_inexistente');
  const i = s.data();
  if (i.status !== 'ativa') throw new ErroSistema('internacao_encerrada');
  return { ref, i };
}

/** Corrige dados da internação ativa (identificação, diagnóstico, alergias...). */
export async function atualizarInternacao(id, dados, versaoLida) {
  return executar(() =>
    F.runTransaction(db, async (tx) => {
      const { ref, i } = await lerAtiva(tx, id);
      if (versaoLida && i.versao !== versaoLida) throw new ErroSistema('conflito_versao');
      const novo = { ...i, ...dados };
      tx.set(F.doc(db, 'pacientes', i.pacienteId), {
        ...dados.paciente, registro: i.paciente.registro, atualizadoEm: agora(), atualizadoPor: uid(),
      });
      tx.update(ref, {
        ...dados, paciente: { ...dados.paciente, registro: i.paciente.registro },
        atualizadoEm: agora(), atualizadoPor: uid(), versao: i.versao + 1,
      });
      tx.update(F.doc(db, 'leitos', i.leitoId), {
        resumo: resumoParaLeito({ ...novo, paciente: { ...dados.paciente, registro: i.paciente.registro } }),
        atualizadoEm: agora(), atualizadoPor: uid(),
      });
      auditoria(tx, 'internacao_corrigida', { internacaoId: id, unidade: i.unidade });
    }),
  );
}

/** Altera só a precaução/isolamento da internação ativa (atualiza também o painel). */
export async function alterarIsolamento(id, isolamento) {
  return executar(() =>
    F.runTransaction(db, async (tx) => {
      const { ref, i } = await lerAtiva(tx, id);
      tx.update(ref, { isolamento, atualizadoEm: agora(), atualizadoPor: uid(), versao: i.versao + 1 });
      tx.update(F.doc(db, 'leitos', i.leitoId), { resumo: resumoParaLeito({ ...i, isolamento }), atualizadoEm: agora(), atualizadoPor: uid() });
      auditoria(tx, 'isolamento_alterado', { internacaoId: id, unidade: i.unidade, tipo: isolamento.tipo });
    }),
  );
}

export async function transferirLeito(id, leitoDestinoId, dataHora) {
  return executar(() =>
    F.runTransaction(db, async (tx) => {
      const { ref, i } = await lerAtiva(tx, id);
      const dRef = F.doc(db, 'leitos', leitoDestinoId);
      const ds = await tx.get(dRef);
      if (!ds.exists()) throw new ErroSistema('leito_inexistente');
      const d = ds.data();
      if (d.internacaoId) throw new ErroSistema('leito_ocupado');
      if (d.bloqueado) throw new ErroSistema('leito_bloqueado');
      const hist = i.historicoLeitos.map((h, k, arr) => (k === arr.length - 1 ? { ...h, ate: dataHora } : h));
      hist.push({ leitoId: leitoDestinoId, unidade: d.unidade, de: dataHora, ate: '' });
      tx.update(ref, {
        leitoId: leitoDestinoId, unidade: d.unidade, historicoLeitos: hist,
        atualizadoEm: agora(), atualizadoPor: uid(), versao: i.versao + 1,
      });
      tx.update(F.doc(db, 'leitos', i.leitoId), { internacaoId: null, resumo: null, atualizadoEm: agora(), atualizadoPor: uid() });
      tx.update(dRef, { internacaoId: id, resumo: resumoParaLeito(i), atualizadoEm: agora(), atualizadoPor: uid() });
      auditoria(tx, 'transferencia_leito', { internacaoId: id, de: i.leitoId, para: leitoDestinoId, unidade: d.unidade });
    }),
  );
}

export async function encerrarInternacao(id, desfecho) {
  return executar(() =>
    F.runTransaction(db, async (tx) => {
      const { ref, i } = await lerAtiva(tx, id);
      const hist = i.historicoLeitos.map((h, k, arr) => (k === arr.length - 1 ? { ...h, ate: desfecho.dataHora } : h));
      tx.update(ref, {
        status: 'encerrada', desfecho: { ...desfecho, registradoPor: uid() }, historicoLeitos: hist,
        atualizadoEm: agora(), atualizadoPor: uid(), versao: i.versao + 1,
      });
      tx.update(F.doc(db, 'leitos', i.leitoId), { internacaoId: null, resumo: null, atualizadoEm: agora(), atualizadoPor: uid() });
      auditoria(tx, 'desfecho', { internacaoId: id, tipo: desfecho.tipo, unidade: i.unidade });
    }),
  );
}

// --------------------------------------------------------------------------- evolução
// Um documento por internação + dia assistencial (id fixo): o mesmo rascunho no
// tablet e no PC. O salvamento é por subbloco (dados.<subbloco>), o que reduz
// conflito quando duas pessoas mexem na mesma evolução. Sem Wi-Fi, a gravação
// fica no aparelho e sobe sozinha quando a conexão voltar.

const DISPOSITIVO = Math.random().toString(36).slice(2, 10);

export function observarEvolucoesDia(unidade, data, cb, cbErro) {
  const q = F.query(F.collection(db, 'evolucoes'), F.where('unidade', '==', unidade), F.where('data', '==', data));
  return F.onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => cbErro?.(traduzirErro(e)));
}

export async function lerEvolucao(id) {
  return executar(async () => {
    const s = await F.getDoc(F.doc(db, 'evolucoes', id));
    return s.exists() ? { id, ...s.data() } : null;
  });
}

/** Garante que o rascunho do dia existe. `base` traz pendências herdadas. Precisa de conexão só na criação. */
export async function abrirEvolucao(id, base) {
  return executar(async () => {
    const ref = F.doc(db, 'evolucoes', id);
    const s = await F.getDoc(ref);
    if (s.exists()) return { id, ...s.data() };
    const novo = {
      ...base, status: 'rascunho', versao: 1, confirmados: {},
      criadoPor: uid(), criadoEm: agora(), atualizadoPor: uid(), atualizadoEm: agora(), atualizadoNo: DISPOSITIVO,
    };
    await F.setDoc(ref, novo);
    return { id, ...novo };
  });
}

/** cb(evolucao, { pendente, deOutroAparelho }) */
export function observarEvolucao(id, cb, cbErro) {
  return F.onSnapshot(F.doc(db, 'evolucoes', id), { includeMetadataChanges: true }, (s) => {
    if (!s.exists()) return;
    const d = s.data();
    cb({ id, ...d }, { pendente: s.metadata.hasPendingWrites, deOutroAparelho: d.atualizadoNo !== DISPOSITIVO && !s.metadata.hasPendingWrites });
  }, (e) => cbErro?.(traduzirErro(e)));
}

/**
 * Salva um subbloco. Devolve uma promessa que só termina quando o servidor
 * confirma (sem conexão, fica pendente): a tela mostra "salvo no aparelho" até lá.
 */
export function salvarSubbloco(id, subbloco, dados, confirmado) {
  return F.updateDoc(F.doc(db, 'evolucoes', id), {
    [`dados.${subbloco}`]: dados,
    [`confirmados.${subbloco}`]: confirmado || F.deleteField(),
    atualizadoPor: uid(), atualizadoEm: agora(), atualizadoNo: DISPOSITIVO,
  }).catch((e) => { throw traduzirErro(e); });
}

export async function finalizarEvolucao(id, { autor, pendenciasAutomaticas, emTexto }) {
  return executar(() => F.updateDoc(F.doc(db, 'evolucoes', id), {
    status: 'finalizada', finalizadoPor: uid(), finalizadoPorNome: autor, finalizadoEm: agora(), finalizadoEmTexto: emTexto,
    pendenciasAutomaticas, atualizadoPor: uid(), atualizadoEm: agora(), atualizadoNo: DISPOSITIVO,
  }));
}

/** Retificação: guarda a versão finalizada e reabre como rascunho (versão + 1). Precisa de conexão. */
export async function retificarEvolucao(id, { motivo, emTexto, autor }) {
  return executar(() => F.runTransaction(db, async (tx) => {
    const ref = F.doc(db, 'evolucoes', id);
    const s = await tx.get(ref);
    const ev = s.data();
    if (ev.status !== 'finalizada') throw new ErroSistema('conflito_versao');
    tx.set(F.doc(db, 'evolucoes', id, 'versoes', String(ev.versao)), { ...ev, por: uid(), em: agora() });
    tx.update(ref, {
      status: 'rascunho', versao: ev.versao + 1, retificacao: { motivo, por: uid(), porNome: autor, emTexto },
      atualizadoPor: uid(), atualizadoEm: agora(), atualizadoNo: DISPOSITIVO,
    });
    auditoria(tx, 'evolucao_retificada', { evolucaoId: id, unidade: ev.unidade });
  }));
}

export async function marcarTranscrita(id, { versao, autor, emTexto }) {
  return executar(() => F.updateDoc(F.doc(db, 'evolucoes', id), {
    transcritoPEP: { versao, por: uid(), porNome: autor, emTexto },
    atualizadoPor: uid(), atualizadoEm: agora(), atualizadoNo: DISPOSITIVO,
  }));
}

// --------------------------------------------------------------------------- check-list diário de IRAS
// Um documento por unidade, dia assistencial e turno: checklistsIras/{unidade}_{data}_{turno}.
export async function lerChecklistIras(id) {
  return executar(async () => {
    const s = await F.getDoc(F.doc(db, 'checklistsIras', id));
    return s.exists() ? { id, ...s.data() } : null;
  });
}

/** Salva o turno inteiro (funciona sem conexão: o envio acontece quando o Wi-Fi volta). */
export function salvarChecklistIras(id, { unidade, data, turno, respostas, enfermeiro }) {
  return F.setDoc(F.doc(db, 'checklistsIras', id), {
    unidade, data, turno, respostas, enfermeiro: enfermeiro || '',
    atualizadoPor: uid(), atualizadoEm: agora(), atualizadoNo: DISPOSITIVO,
  }).catch((e) => { throw traduzirErro(e); });
}

// --------------------------------------------------------------------------- capa da ocorrência (observações)
/** Observações administrativas da capa (reservas cirúrgicas etc.), uma por unidade e dia. */
export async function lerCapaOcorrencia(id) {
  return executar(async () => {
    const s = await F.getDoc(F.doc(db, 'capasOcorrencia', id));
    return s.exists() ? { id, ...s.data() } : null;
  });
}

export function salvarCapaOcorrencia(id, { unidade, data, observacoes, reservas }) {
  return F.setDoc(F.doc(db, 'capasOcorrencia', id), {
    unidade, data, observacoes: String(observacoes || '').slice(0, 4000), reservas: (reservas || []).slice(0, 20),
    atualizadoPor: uid(), atualizadoEm: agora(), atualizadoNo: DISPOSITIVO,
  }).catch((e) => { throw traduzirErro(e); });
}

// --------------------------------------------------------------------------- check-lists de inserção (CVC e CVD)
export async function lerChecklistInsercao(id) {
  return executar(async () => {
    const s = await F.getDoc(F.doc(db, 'checklistsInsercao', id));
    return s.exists() ? { id, ...s.data() } : null;
  });
}

/** Check-lists do paciente nesta unidade (o filtro pela unidade é exigido pelas regras). */
export async function listarChecklistsInsercao(unidade, internacaoId) {
  return executar(async () => {
    const q = F.query(F.collection(db, 'checklistsInsercao'), F.where('unidade', '==', unidade), F.where('internacaoId', '==', internacaoId));
    const s = await F.getDocs(q);
    return s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  });
}

export function salvarChecklistInsercao(id, dados) {
  const { id: _ignorar, atualizadoEm, atualizadoPor, atualizadoNo, ...resto } = dados;
  return F.setDoc(F.doc(db, 'checklistsInsercao', id), {
    ...resto, atualizadoPor: uid(), atualizadoEm: agora(), atualizadoNo: DISPOSITIVO,
  }).catch((e) => { throw traduzirErro(e); });
}

// --------------------------------------------------------------------------- registro de operações
/** Registra uma operação (abertura de evolução, impressão…) na auditoria. Nunca guarda conteúdo clínico. */
export function registrarEvento(acao, dados = {}) {
  return F.addDoc(F.collection(db, 'auditoria'), { acao, ...dados, por: uid(), em: agora() }).catch(() => {});
}
