// Acesso ao Firebase (Auth + Firestore). Todo acesso ao banco passa por aqui.
// As regras do Firestore (firestore.rules) repetem as mesmas checagens no
// servidor: o que está aqui é conveniência, a proteção real está nas regras.

import { FIREBASE_CONFIG } from '../config.js';
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

export function aoMudarSessao(cb) {
  return A.onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email, nome: u.displayName || '' } : null));
}

// Login com Google. "select_account" faz o Google perguntar qual conta usar a
// cada entrada (importante em tablet compartilhado). Usa janela (popup) porque o
// redirecionamento falha quando o site (github.io) e o Firebase têm domínios diferentes.
const provedor = new A.GoogleAuthProvider();
provedor.setCustomParameters({ prompt: 'select_account' });

export const entrarComGoogle = () => executar(() => A.signInWithPopup(auth, provedor));

/** Primeiro acesso: cria a solicitação (perfil pendente) com nome e Coren. */
export async function solicitarAcesso({ nome, coren }) {
  return executar(() => {
    const u = auth.currentUser;
    return F.setDoc(F.doc(db, 'usuarios', u.uid), {
      nome, coren, email: u.email, perfil: 'pendente', ativo: false, unidades: [], criadoEm: agora(),
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
