// Testes das regras de segurança do Firestore (firestore.rules) no simulador oficial.
// Rodam no GitHub Actions (npm run test:regras). Só dados fictícios.
//
// Contas: enf1 (UTI 1), enf2 (UTI 2), enf12 (UTI 1 e 2), leit1 (leitura, UTI 1),
// pessoal (conta @gmail.com) e pend (cadastro pendente).

import test, { before, after, beforeEach } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction, serverTimestamp, deleteField,
} from 'firebase/firestore';

const HOJE = '2026-10-18';
const ONTEM = '2026-10-17';
let env;

const USUARIOS = {
  admin: { perfil: 'admin', unidades: ['uti1', 'uti2'] },
  enf1: { perfil: 'enfermeiro', unidades: ['uti1'] },
  enf2: { perfil: 'enfermeiro', unidades: ['uti2'] },
  enf12: { perfil: 'enfermeiro', unidades: ['uti1', 'uti2'] },
  leit1: { perfil: 'leitura', unidades: ['uti1'] },
  pend: { perfil: 'pendente', unidades: [], ativo: false },
};

/** Banco de quem está logado (conta Google; e-mail institucional, salvo indicação). */
function db(uid, email = `${uid}@liga.org.br`) {
  return env.authenticatedContext(uid, { email, email_verified: true, firebase: { sign_in_provider: 'google.com' } }).firestore();
}
const carimbo = (uid) => ({ atualizadoPor: uid, atualizadoEm: serverTimestamp() });

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-uti-liga',
    firestore: { rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    for (const [uid, u] of Object.entries(USUARIOS)) {
      await setDoc(doc(f, 'usuarios', uid), { nome: uid.toUpperCase(), coren: '000', email: `${uid}@liga.org.br`, ativo: true, ...u });
    }
    await setDoc(doc(f, 'unidades', 'uti1'), { nome: 'UTI 1', ordem: 1, leitos: ['01', '03'] });
    await setDoc(doc(f, 'unidades', 'uti2'), { nome: 'UTI 2', ordem: 2, leitos: ['02'] });
    await setDoc(doc(f, 'leitos', 'uti1_01'), { unidade: 'uti1', numero: '01', internacaoId: 'i1', resumo: { nome: 'PACIENTE TESTE' }, bloqueado: false, bloqueio: null });
    await setDoc(doc(f, 'leitos', 'uti1_03'), { unidade: 'uti1', numero: '03', internacaoId: null, resumo: null, bloqueado: false, bloqueio: null });
    await setDoc(doc(f, 'leitos', 'uti2_02'), { unidade: 'uti2', numero: '02', internacaoId: null, resumo: null, bloqueado: false, bloqueio: null });
    await setDoc(doc(f, 'pacientes', 'R1'), { nome: 'PACIENTE TESTE', registro: 'R1', dataNascimento: '1950-01-01', convenio: 'SUS' });
    await setDoc(doc(f, 'internacoes', 'i1'), {
      pacienteId: 'R1', paciente: { nome: 'PACIENTE TESTE', registro: 'R1', dataNascimento: '1950-01-01' },
      unidade: 'uti1', leitoId: 'uti1_01', status: 'ativa', desfecho: null, versao: 1,
      historicoLeitos: [{ leitoId: 'uti1_01', unidade: 'uti1', de: '2026-10-16T10:00', ate: '' }],
      criadoPor: 'enf1', criadoEm: new Date('2026-10-16T13:00:00Z'),
    });
    const evo = (data, extra) => ({
      internacaoId: 'i1', unidade: 'uti1', leitoId: 'uti1_01', data, turnoInicio: 'M', status: 'rascunho', versao: 1,
      dados: { sinais: { fc: '80' } }, confirmados: {}, criadoPor: 'enf1', criadoEm: new Date('2026-10-17T10:00:00Z'), ...extra,
    });
    await setDoc(doc(f, 'evolucoes', `i1_${ONTEM}`), evo(ONTEM, { status: 'finalizada', finalizadoPor: 'enf1', finalizadoPorNome: { nome: 'ENF1', coren: '000' } }));
    await setDoc(doc(f, 'evolucoes', `i1_${HOJE}`), evo(HOJE));
  });
});

// --------------------------------------------------------------------------- acesso
test('só conta institucional ativa entra; leitura não altera', async () => {
  await assertFails(getDoc(doc(db('enf1', 'enf1@gmail.com'), 'internacoes', 'i1')));
  await assertFails(getDoc(doc(db('pend'), 'internacoes', 'i1')));
  await assertSucceeds(getDoc(doc(db('enf1'), 'internacoes', 'i1')));
  await assertSucceeds(getDoc(doc(db('leit1'), 'internacoes', 'i1')));
  await assertFails(updateDoc(doc(db('leit1'), 'evolucoes', `i1_${HOJE}`), { 'dados.sinais': { fc: '90' }, ...carimbo('leit1'), atualizadoNo: 'x' }));
});

test('cada um só vê a própria UTI; cadastro de pacientes não pode ser listado', async () => {
  await assertFails(getDoc(doc(db('enf2'), 'internacoes', 'i1')));
  await assertFails(getDoc(doc(db('enf2'), 'evolucoes', `i1_${HOJE}`)));
  await assertSucceeds(getDocs(query(collection(db('enf1'), 'evolucoes'), where('unidade', '==', 'uti1'), where('data', '==', HOJE))));
  await assertFails(getDocs(query(collection(db('enf2'), 'evolucoes'), where('unidade', '==', 'uti1'))));
  await assertFails(getDocs(collection(db('enf1'), 'pacientes')));
  await assertSucceeds(getDoc(doc(db('enf1'), 'pacientes', 'R1')));
});

// --------------------------------------------------------------------------- evolução
test('rascunho: só dados e confirmações mudam', async () => {
  const ref = (u) => doc(db(u), 'evolucoes', `i1_${HOJE}`);
  await assertSucceeds(updateDoc(ref('enf1'), { 'dados.sinais': { fc: '90' }, 'confirmados.neuro': { hora: '08:00' }, ...carimbo('enf1'), atualizadoNo: 'x' }));
  await assertSucceeds(updateDoc(ref('enf1'), { 'confirmados.neuro': deleteField(), ...carimbo('enf1'), atualizadoNo: 'x' }));
  await assertFails(updateDoc(ref('enf1'), { transcritoPEP: { versao: 1, por: 'enf1' }, ...carimbo('enf1'), atualizadoNo: 'x' }), 'cópia ao PEP falsa num rascunho');
  await assertFails(updateDoc(ref('enf1'), { finalizadoPor: 'enf2', ...carimbo('enf1'), atualizadoNo: 'x' }));
  await assertFails(updateDoc(ref('enf1'), { unidade: 'uti2', ...carimbo('enf1'), atualizadoNo: 'x' }), 'mudar de UTI sem troca de leito');
  await assertFails(updateDoc(ref('enf1'), { 'dados.sinais': { fc: '90' }, atualizadoPor: 'enf2', atualizadoEm: serverTimestamp() }), 'autor falso');
});

test('finalização, cópia ao PEP e retificação', async () => {
  const f = db('enf1');
  const ref = doc(f, 'evolucoes', `i1_${HOJE}`);
  await assertFails(updateDoc(ref, { status: 'finalizada', finalizadoPor: 'enf1', finalizadoEm: serverTimestamp(), 'dados.sinais': { fc: '1' }, ...carimbo('enf1'), atualizadoNo: 'x' }), 'finalizar mudando dados');
  await assertSucceeds(updateDoc(ref, {
    status: 'finalizada', finalizadoPor: 'enf1', finalizadoPorNome: { nome: 'ENF1', coren: '000' }, finalizadoEm: serverTimestamp(), finalizadoEmTexto: 'agora',
    pendenciasAutomaticas: [], ...carimbo('enf1'), atualizadoNo: 'x',
  }));
  await assertFails(updateDoc(ref, { 'dados.sinais': { fc: '99' }, ...carimbo('enf1'), atualizadoNo: 'x' }), 'finalizada não muda');
  await assertSucceeds(updateDoc(ref, { transcritoPEP: { versao: 1, por: 'enf1', porNome: { nome: 'ENF1' }, emTexto: 'agora' }, ...carimbo('enf1'), atualizadoNo: 'x' }));
  // Retificação: guarda a versão finalizada e reabre (mesma transação)
  await assertSucceeds(runTransaction(f, async (tx) => {
    const ev = (await tx.get(ref)).data();
    tx.set(doc(f, 'evolucoes', `i1_${HOJE}`, 'versoes', '1'), { ...ev, por: 'enf1', em: serverTimestamp() });
    tx.update(ref, { status: 'rascunho', versao: 2, retificacao: { motivo: 'erro', por: 'enf1', porNome: { nome: 'ENF1' }, emTexto: 'agora' }, ...carimbo('enf1'), atualizadoNo: 'x' });
  }));
  await assertFails(runTransaction(f, async (tx) => {
    tx.update(ref, { status: 'finalizada', finalizadoPor: 'enf1', finalizadoEm: serverTimestamp(), ...carimbo('enf1'), atualizadoNo: 'x' });
    tx.set(doc(f, 'evolucoes', `i1_${HOJE}`, 'versoes', '2'), { versao: 2, dados: {}, finalizadoPor: 'enf1', por: 'enf1' });
  }), 'versão guardada que não é cópia fiel');
});

// --------------------------------------------------------------------------- troca de UTI
async function transferir(uid) {
  const f = db(uid);
  return runTransaction(f, async (tx) => {
    const iRef = doc(f, 'internacoes', 'i1');
    const i = (await tx.get(iRef)).data();
    const evRef = doc(f, 'evolucoes', `i1_${HOJE}`);
    const evDia = await tx.get(evRef);
    tx.update(iRef, {
      leitoId: 'uti2_02', unidade: 'uti2', versao: i.versao + 1,
      historicoLeitos: [{ ...i.historicoLeitos[0], ate: `${HOJE}T10:00` }, { leitoId: 'uti2_02', unidade: 'uti2', de: `${HOJE}T10:00`, ate: '' }],
      ...carimbo(uid),
    });
    tx.update(doc(f, 'leitos', 'uti1_01'), { internacaoId: null, resumo: null, ...carimbo(uid) });
    tx.update(doc(f, 'leitos', 'uti2_02'), { internacaoId: 'i1', resumo: { nome: 'PACIENTE TESTE' }, ...carimbo(uid) });
    if (evDia.exists()) tx.update(evRef, { unidade: 'uti2', leitoId: 'uti2_02', ...carimbo(uid), atualizadoNo: 'x' });
    tx.set(doc(collection(f, 'auditoria')), { acao: 'transferencia_leito', internacaoId: 'i1', por: uid, em: serverTimestamp() });
  });
}

test('troca de leito da UTI 1 para a UTI 2: a evolução do dia vai junto e a nova equipe lê o histórico', async () => {
  await assertSucceeds(transferir('enf12'));
  const f2 = db('enf2');
  const hoje = await assertSucceeds(getDoc(doc(f2, 'evolucoes', `i1_${HOJE}`)));
  if (hoje.data().unidade !== 'uti2' || hoje.data().leitoId !== 'uti2_02') throw new Error('a evolução do dia não acompanhou o paciente');
  await assertSucceeds(updateDoc(doc(f2, 'evolucoes', `i1_${HOJE}`), { 'dados.sinais': { fc: '95' }, ...carimbo('enf2'), atualizadoNo: 'x' }));
  await assertSucceeds(getDoc(doc(f2, 'evolucoes', `i1_${ONTEM}`)), 'evolução de ontem (ainda da UTI 1) para a herança');
  await assertSucceeds(getDocs(query(collection(f2, 'evolucoes'), where('unidade', '==', 'uti2'), where('data', '==', HOJE))));
  // A equipe só da UTI 1 deixa de ter acesso ao paciente
  await assertFails(getDoc(doc(db('enf1'), 'internacoes', 'i1')));
  await assertFails(updateDoc(doc(db('enf1'), 'evolucoes', `i1_${HOJE}`), { 'dados.sinais': { fc: '1' }, ...carimbo('enf1'), atualizadoNo: 'x' }));
});

test('troca para a UTI 2 exige acesso às duas UTIs', async () => {
  await assertFails(transferir('enf1'));
});

// --------------------------------------------------------------------------- pacientes e admissão
test('cadastro do paciente só muda junto com uma internação ativa dele na unidade de quem altera', async () => {
  // Correção feita por quem tem o paciente na UTI (mesma transação da internação)
  const correcao = (uid) => {
    const f = db(uid);
    return runTransaction(f, async (tx) => {
      const iRef = doc(f, 'internacoes', 'i1');
      const i = (await tx.get(iRef)).data();
      tx.set(doc(f, 'pacientes', 'R1'), { nome: 'PACIENTE CORRIGIDO', registro: 'R1', dataNascimento: '1950-01-01', convenio: 'SUS', ultimaInternacaoId: 'i1', ...carimbo(uid) });
      tx.update(iRef, { paciente: { ...i.paciente, nome: 'PACIENTE CORRIGIDO' }, versao: i.versao + 1, ...carimbo(uid) });
      tx.update(doc(f, 'leitos', 'uti1_01'), { resumo: { nome: 'PACIENTE CORRIGIDO' }, ...carimbo(uid) });
    });
  };
  await assertSucceeds(correcao('enf1'));
  // Quem não tem o paciente na sua UTI não altera o cadastro, nem apontando para a internação dele
  await assertFails(setDoc(doc(db('enf2'), 'pacientes', 'R1'), { nome: 'OUTRO', registro: 'R1', ultimaInternacaoId: 'i1', ...carimbo('enf2') }));
  await assertFails(setDoc(doc(db('enf1'), 'pacientes', 'R1'), { nome: 'OUTRO', registro: 'R1', ...carimbo('enf1') }), 'sem internação vinculada');
});

test('admissão completa (paciente novo, internação, leito e auditoria)', async () => {
  const f = db('enf1');
  await assertSucceeds(runTransaction(f, async (tx) => {
    const lRef = doc(f, 'leitos', 'uti1_03');
    await tx.get(lRef);
    tx.set(doc(f, 'pacientes', 'R2'), { nome: 'NOVO TESTE', registro: 'R2', dataNascimento: '1960-05-05', convenio: 'SUS', ultimaInternacaoId: 'i2', ...carimbo('enf1') });
    tx.set(doc(f, 'internacoes', 'i2'), {
      pacienteId: 'R2', paciente: { nome: 'NOVO TESTE', registro: 'R2', dataNascimento: '1960-05-05' },
      unidade: 'uti1', leitoId: 'uti1_03', status: 'ativa', desfecho: null, versao: 1,
      historicoLeitos: [{ leitoId: 'uti1_03', unidade: 'uti1', de: `${HOJE}T08:00`, ate: '' }],
      criadoPor: 'enf1', criadoEm: serverTimestamp(), ...carimbo('enf1'),
    });
    tx.update(lRef, { internacaoId: 'i2', resumo: { nome: 'NOVO TESTE' }, ...carimbo('enf1') });
    tx.set(doc(collection(f, 'auditoria')), { acao: 'admissao', internacaoId: 'i2', por: 'enf1', em: serverTimestamp() });
  }));
  // Abrir a evolução do dia do paciente novo
  await assertSucceeds(setDoc(doc(f, 'evolucoes', `i2_${HOJE}`), {
    internacaoId: 'i2', unidade: 'uti1', leitoId: 'uti1_03', data: HOJE, turnoInicio: 'M', dados: {}, status: 'rascunho', versao: 1, confirmados: {},
    criadoPor: 'enf1', criadoEm: serverTimestamp(), ...carimbo('enf1'), atualizadoNo: 'x',
  }));
});

// --------------------------------------------------------------------------- outras coleções
test('IRAS: gravação por leito e só na própria UTI; auditoria só inclusão', async () => {
  const id = `uti1_${HOJE}_M`;
  const base = { unidade: 'uti1', data: HOJE, turno: 'M', respostas: { '01': { pav: { decubito: '1' } } }, enfermeiro: 'ENF1', ...carimbo('enf1'), atualizadoNo: 'x' };
  await assertSucceeds(setDoc(doc(db('enf1'), 'checklistsIras', id), base, { merge: true }));
  await assertSucceeds(updateDoc(doc(db('enf1'), 'checklistsIras', id), { 'respostas.03': { pav: { decubito: '0' } }, enfermeiro: 'ENF1', ...carimbo('enf1'), atualizadoNo: 'x' }));
  await assertFails(setDoc(doc(db('enf2'), 'checklistsIras', id), { ...base, ...carimbo('enf2') }));
  await assertFails(updateDoc(doc(db('enf1'), 'checklistsIras', id), { intruso: 1, ...carimbo('enf1'), atualizadoNo: 'x' }));
  await assertFails(getDocs(collection(db('enf1'), 'auditoria')), 'só o administrador lê a auditoria');
  await assertSucceeds(getDocs(collection(db('admin'), 'auditoria')));
});

test('capa da ocorrência: reservas em lista, só na própria UTI', async () => {
  const dados = { unidade: 'uti1', data: HOJE, observacoes: 'Respirador 3 em manutenção', reservas: ['Paciente A / cirurgia'], ...carimbo('enf1'), atualizadoNo: 'x' };
  await assertSucceeds(setDoc(doc(db('enf1'), 'capasOcorrencia', `uti1_${HOJE}`), dados));
  await assertFails(setDoc(doc(db('enf2'), 'capasOcorrencia', `uti1_${HOJE}`), { ...dados, ...carimbo('enf2') }));
  await assertFails(setDoc(doc(db('enf1'), 'capasOcorrencia', `uti1_${HOJE}`), { ...dados, reservas: Array.from({ length: 21 }, (_, k) => `P${k}`) }));
});

// --------------------------------------------------------------------------- fotos das lesões
import { writeBatch, deleteDoc } from 'firebase/firestore';

async function novaFoto(uid, id = 'f1') {
  const f = db(uid);
  const b = writeBatch(f);
  b.set(doc(f, 'fotosLesoes', id), {
    unidade: 'uti1', internacaoId: 'i1', lesaoId: 'l1', data: HOJE, legenda: '', miniatura: 'data:image/jpeg;base64,AAAA', largura: 1280, altura: 960, ordem: 1,
    autor: uid, autorNome: uid.toUpperCase(), tiradaEm: serverTimestamp(), excluida: false,
  });
  b.set(doc(f, 'fotosLesoes', id, 'arquivo', 'imagem'), { imagem: 'data:image/jpeg;base64,BBBB', autor: uid });
  return b.commit();
}
const fotosDaLesao = (uid) => getDocs(query(collection(db(uid), 'fotosLesoes'), where('internacaoId', '==', 'i1'), where('lesaoId', '==', 'l1')));

test('fotos: só quem cuida do paciente inclui e vê; a foto em si só por leitura direta', async () => {
  await assertSucceeds(novaFoto('enf1'));
  await assertFails(novaFoto('enf2', 'f2'), 'outra UTI não inclui');
  await assertSucceeds(fotosDaLesao('enf1'));
  await assertSucceeds(fotosDaLesao('leit1'));
  await assertFails(fotosDaLesao('enf2'));
  await assertSucceeds(getDoc(doc(db('enf1'), 'fotosLesoes', 'f1', 'arquivo', 'imagem')));
  await assertFails(getDoc(doc(db('enf2'), 'fotosLesoes', 'f1', 'arquivo', 'imagem')));
  await assertFails(setDoc(doc(db('enf1'), 'fotosLesoes', 'f1', 'arquivo', 'outra'), { imagem: 'x', autor: 'enf1' }));
  await assertFails(updateDoc(doc(db('enf1'), 'fotosLesoes', 'f1'), { legenda: 'trocada' }), 'foto não é editada');
});

test('fotos: foto errada é marcada como excluída (com motivo); só o administrador apaga', async () => {
  await novaFoto('enf1');
  const ref = (u) => doc(db(u), 'fotosLesoes', 'f1');
  await assertFails(updateDoc(ref('enf1'), { excluida: true, excluidaPor: 'enf1', excluidaEm: serverTimestamp() }), 'sem motivo');
  await assertSucceeds(updateDoc(ref('enf1'), { excluida: true, motivoExclusao: 'foto de outro paciente', excluidaPor: 'enf1', excluidaEm: serverTimestamp() }));
  await assertFails(updateDoc(ref('enf1'), { excluida: false, motivoExclusao: '', excluidaPor: 'enf1', excluidaEm: serverTimestamp() }), 'não volta');
  await assertFails(deleteDoc(ref('enf1')));
  await assertSucceeds(deleteDoc(ref('admin')));
});

test('fotos: paciente transferido — a equipe da UTI nova vê as fotos antigas', async () => {
  await novaFoto('enf1');
  await assertSucceeds(transferir('enf12'));
  await assertSucceeds(fotosDaLesao('enf2'));
  await assertSucceeds(getDoc(doc(db('enf2'), 'fotosLesoes', 'f1', 'arquivo', 'imagem')));
});

// --------------------------------------------------------------------------- desfazer saída
async function encerrar(uid) {
  const f = db(uid);
  return runTransaction(f, async (tx) => {
    const ref = doc(f, 'internacoes', 'i1');
    const i = (await tx.get(ref)).data();
    tx.update(ref, {
      status: 'encerrada', desfecho: { tipo: 'alta', dataHora: '2026-10-18T10:00', destino: 'ENFERMARIA', registradoPor: uid, registradoEm: serverTimestamp() },
      historicoLeitos: [{ ...i.historicoLeitos[0], ate: '2026-10-18T10:00' }], versao: i.versao + 1, ...carimbo(uid),
    });
    tx.update(doc(f, 'leitos', 'uti1_01'), {
      internacaoId: null, resumo: null, ...carimbo(uid),
      ultimaSaida: { internacaoId: 'i1', nome: 'PACIENTE TESTE', tipo: 'alta', dataHora: '2026-10-18T10:00', registradoEm: serverTimestamp() },
    });
  });
}
function reverter(uid, { leito = 'uti1_01', motivo = 'alta suspensa pela equipe médica' } = {}) {
  const f = db(uid);
  return runTransaction(f, async (tx) => {
    const ref = doc(f, 'internacoes', 'i1');
    const i = (await tx.get(ref)).data();
    await tx.get(doc(f, 'leitos', leito));
    tx.update(ref, {
      status: 'ativa', desfecho: null, leitoId: leito,
      historicoLeitos: [{ ...i.historicoLeitos[0], ate: '' }],
      saidasRevertidas: [{ desfecho: { tipo: 'alta' }, motivo, revertidoPor: uid, revertidoEm: '2026-10-18T11:00', leitoId: leito }],
      versao: i.versao + 1, ...carimbo(uid),
    });
    tx.update(doc(f, 'leitos', leito), { internacaoId: 'i1', resumo: { nome: 'PACIENTE TESTE' }, ultimaSaida: null, ...carimbo(uid) });
  });
}

test('desfazer saída por engano: mesma UTI, com motivo, enfermeiro em até 24 h', async () => {
  await assertSucceeds(encerrar('enf1'));
  await assertFails(reverter('enf2'), 'outra UTI');
  await assertFails(reverter('leit1'), 'perfil leitura');
  await assertFails(reverter('enf1', { motivo: 'erro' }), 'motivo curto');
  await assertFails(reverter('enf1', { leito: 'uti2_02' }), 'leito de outra UTI');
  await assertSucceeds(reverter('enf1', { leito: 'uti1_03' }), 'outro leito livre da mesma UTI');
});

test('desfazer saída: fora do prazo só o administrador; readmitido, ninguém', async () => {
  await assertSucceeds(encerrar('enf1'));
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'internacoes', 'i1'), { 'desfecho.registradoEm': new Date('2026-01-01T00:00:00Z') });
  });
  await assertFails(reverter('enf1'), 'passou de 24 h');
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'pacientes', 'R1'), { ultimaInternacaoId: 'i9' });
  });
  await assertFails(reverter('admin'), 'paciente readmitido em outra internação');
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'pacientes', 'R1'), { ultimaInternacaoId: 'i1' });
  });
  await assertSucceeds(reverter('admin'), 'administrador sem prazo');
});

test('última saída do leito não pode ser inventada', async () => {
  await assertFails(updateDoc(doc(db('enf1'), 'leitos', 'uti1_03'), {
    ultimaSaida: { internacaoId: 'i1', nome: 'X', tipo: 'alta', dataHora: '2026-10-18T10:00', registradoEm: serverTimestamp() }, ...carimbo('enf1'),
  }));
  await assertFails(encerrar('enf2'));
});
