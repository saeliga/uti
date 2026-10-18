// Testes das regras do Processo de Enfermagem.
import test from 'node:test';
import assert from 'node:assert/strict';
import { anonimizarParaIA, validarEvidencias, novoDiagnostico, planoParaNovoDia, validarConclusao, avisosRisco, enunciado, textoSAE, resumoParaIA, CATEGORIA } from '../js/regras/sae.js';

const it = (id, texto) => ({ id, texto });

test('validação mínima por categoria', () => {
  assert.deepEqual(validarEvidencias(CATEGORIA.problema, { cd: [it('CD1', 'a')], fr: [it('FR1', 'b')] }), []);
  assert.equal(validarEvidencias(CATEGORIA.problema, { cd: [it('CD1', 'a')] }).length, 1);
  assert.deepEqual(validarEvidencias(CATEGORIA.risco, { ri: [it('RI1', 'a')] }), []);
  assert.equal(validarEvidencias(CATEGORIA.risco, { ri: [it('RI1', 'a')], cd: [it('CD1', 'x')] }).length, 1, 'risco sem CD');
  assert.deepEqual(validarEvidencias(CATEGORIA.promocao, { cd: [it('CD1', 'a')] }), []);
});

function diagCompleto() {
  const d = novoDiagnostico({ codigo: '00032', titulo: 'Padrão respiratório ineficaz', categoria: CATEGORIA.problema, evidencias: { cd: [it('CD2', 'Taquipneia')], fr: [it('FR1', 'Fadiga')] } }, 'ia_aceito');
  d.noc = [{ codigo: '0415', titulo: 'Estado respiratório', indicadores: [{ codigo: '041501', texto: 'Frequência respiratória', niveis: ['Grave', 'Substancial', 'Moderado', 'Leve', 'Nenhum'], meta: '4', pontuacao: '2' }] }];
  d.nic = [{ codigo: '3350', titulo: 'Monitoração respiratória', nivel: 'Enfermeiro registrado', atividades: [{ id: 'A1', texto: 'Monitorar frequência', status: 'realizado' }] }];
  d.decisao = 'manter';
  return d;
}

test('concluir PE: exige NOC pontuado, NIC registrada, decisão e decisão sobre sugestões', () => {
  assert.deepEqual(validarConclusao({ diagnosticos: [diagCompleto()] }), []);
  assert.ok(validarConclusao({ diagnosticos: [] })[0].includes('pelo menos um diagnóstico'));
  const d = diagCompleto();
  d.noc[0].indicadores[0].pontuacao = '';
  d.nic[0].atividades[0].status = 'nao_realizado';
  d.decisao = 'modificar';
  const e = validarConclusao({ diagnosticos: [d], sugestao: { itens: [{ codigo: '00004', decisao: '' }] } });
  assert.ok(e.some((x) => x.includes('pontue')));
  assert.ok(e.some((x) => x.includes('justifique')));
  assert.ok(e.some((x) => x.includes('o que muda')));
  assert.ok(e.some((x) => x.includes('sugestões da IA sem decisão')));
  const resolvido = { ...diagCompleto(), situacao: 'resolvido', noc: [], nic: [], decisao: '' };
  assert.deepEqual(validarConclusao({ diagnosticos: [diagCompleto(), resolvido] }), [], 'resolvido não exige plano');
});

test('plano passa para o dia seguinte sem pontuações nem situação das atividades', () => {
  const ontem = { diagnosticos: [diagCompleto(), { ...diagCompleto(), codigo: '00004', situacao: 'resolvido' }, { ...diagCompleto(), codigo: '00132', decisao: 'encerrar' }], versaoLigacoes: '1.0' };
  const hoje = planoParaNovoDia(ontem);
  assert.equal(hoje.diagnosticos.length, 1, 'resolvidos e encerrados não passam');
  const d = hoje.diagnosticos[0];
  assert.equal(d.confirmado, false);
  assert.equal(d.noc[0].indicadores[0].pontuacao, '');
  assert.equal(d.noc[0].indicadores[0].anterior, '2');
  assert.equal(d.noc[0].indicadores[0].meta, '4', 'meta continua');
  assert.equal(d.nic[0].atividades[0].status, '');
  assert.equal(d.decisao, '');
  assert.ok(validarConclusao(hoje).some((x) => x.includes('confirme')));
});

test('avisos de risco sem diagnóstico correspondente', () => {
  const dados = { dispositivos: { itens: [{ tipo: 'cvc' }, { tipo: 'sne' }] }, neuro: { consciencia: 'sedado' } };
  const a = avisosRisco(dados, { diagnosticos: [] }).map((x) => x.codigo);
  assert.deepEqual(a, ['00004', '00304', '00039']);
  const b = avisosRisco(dados, { diagnosticos: [{ codigo: '00004', situacao: 'ativo' }, { codigo: '00304' }, { codigo: '00039' }] });
  assert.deepEqual(b, []);
  assert.deepEqual(avisosRisco({ neuro: { consciencia: 'alerta' } }, {}), []);
});

test('enunciado e texto do PE para o PEP', () => {
  assert.equal(enunciado(diagCompleto()), 'Padrão respiratório ineficaz relacionado a Fadiga, evidenciado por Taquipneia');
  const risco = novoDiagnostico({ codigo: '00004', titulo: 'Risco de infecção', categoria: CATEGORIA.risco, evidencias: { ri: [it('RI1', 'Procedimento invasivo')] } }, 'enfermeiro');
  assert.equal(enunciado(risco), 'Risco de infecção, evidenciado por fatores de risco: Procedimento invasivo');
  const t = textoSAE({ diagnosticos: [diagCompleto()] });
  assert.match(t, /PROCESSO DE ENFERMAGEM:/);
  assert.match(t, /Resultado: Estado respiratório - Frequência respiratória: 2 \(Substancial\), meta 4\./);
  assert.match(t, /Intervenção: Monitoração respiratória - Monitorar frequência \(realizado\)\./);
  assert.match(t, /Avaliação: manter o plano\./);
  assert.equal(textoSAE({ diagnosticos: [] }), '');
});

test('resumo para a IA não leva identificação', () => {
  const r = resumoParaIA({ idade: 68, diagnosticoMedico: 'Choque séptico', comorbidades: 'HAS', isolamento: 'Contato', textoSubblocos: 'SINAIS VITAIS: FC 110.' });
  assert.match(r, /68 anos/);
  assert.doesNotMatch(r, /Registro|Nascimento|Leito/i);
});

test('anonimização antes da IA: tira nome, registro, nascimento, documentos e nomes de profissionais', () => {
  const t = anonimizarParaIA('INTERCORRÊNCIAS: Ana Exemplo Fictícia com queda de SpO2, comunicado Dr. João Silva. Reg DEMO-1001, nasc. 12/03/1958, CPF 123.456.789-09, tel (84) 99999-1234, e-mail ana@exemplo.com. FC 118 bpm, débito 1500 mL, pele rosada.',
    { nome: 'ANA EXEMPLO FICTICIA', registro: 'DEMO-1001', nascimento: '1958-03-12' });
  for (const x of ['Ana', 'Exemplo', 'Fictícia', 'João', 'Silva', 'DEMO-1001', '12/03/1958', '123.456.789-09', '99999-1234', 'ana@exemplo.com']) assert.ok(!t.includes(x), x);
  for (const x of ['FC 118 bpm', 'débito 1500 mL', 'pele rosada', 'SpO2']) assert.ok(t.includes(x), `mantém o dado clínico: ${x}`);
  assert.match(resumoParaIA({ idade: 95 }), /90 anos ou mais/, 'idade muito alta vai como faixa');
});
