import { test } from 'node:test';
import assert from 'node:assert/strict';
import { horariosPadrao, ordenarHorarios, resumoAprazamento, itensPrescricao, camposPrescricao, nomeProfissional, siglaResponsavel } from '../js/regras/prescricao.js';
import { planoParaNovoDia } from '../js/regras/sae.js';

test('horários padrão seguem o esquema da farmácia (último horário às 06)', () => {
  assert.deepEqual(horariosPadrao('06/06H'), ['12', '18', '00', '06']);
  assert.deepEqual(horariosPadrao('08/08H'), ['14', '22', '06']);
  assert.deepEqual(horariosPadrao('12/12H'), ['18', '06']);
  assert.deepEqual(horariosPadrao('04/04H'), ['10', '14', '18', '22', '02', '06']);
  assert.deepEqual(horariosPadrao('24/24H'), ['06']);
  assert.equal(horariosPadrao('02/02H').length, 12);
  assert.equal(horariosPadrao('01/01H').length, 24);
  assert.deepEqual(horariosPadrao('TURNO'), ['08', '14', '20']);
  assert.deepEqual(horariosPadrao('SN'), []);
  assert.deepEqual(horariosPadrao(''), []);
});

test('ordenação na sequência do plantão e resumo', () => {
  assert.deepEqual(ordenarHorarios(['06', '22', '08', '08', '99']), ['08', '22', '06']);
  assert.equal(resumoAprazamento({ freq: '06/06H', horarios: ['06', '12', '18', '00'] }), '06/06H · 12 18 00 06');
  assert.equal(resumoAprazamento({ freq: 'SN' }), 'SN');
  assert.equal(resumoAprazamento({}), '');
});

const sae = {
  diagnosticos: [
    { codigo: '00047', titulo: 'Risco de lesão por pressão', situacao: 'ativo', nic: [
      { codigo: '3540', titulo: 'Prevenção de lesão por pressão', nivel: 'Técnico de enfermagem', atividades: [
        { id: 'a1', texto: 'Mudar o decúbito', freq: '02/02H', horarios: ['08', '10'], obsPrescricao: 'D → DD → E' },
        { id: 'a2', texto: 'Inspecionar a pele', freq: '' },
      ] },
      { codigo: '6540', titulo: 'Controle de infecção', nivel: 'Enfermeiro', atividades: [{ id: 'b1', texto: 'Higienizar as mãos' }] },
    ] },
    { codigo: '00004', titulo: 'Risco de infecção', situacao: 'ativo', nic: [
      { codigo: '6540', titulo: 'Controle de infecção', nivel: 'Enfermeiro', atividades: [{ id: 'b1', texto: 'Higienizar as mãos' }, { id: 'b2', texto: 'Trocar curativo' }] },
    ] },
    { codigo: '00132', titulo: 'Dor aguda', situacao: 'resolvido', nic: [{ codigo: '1400', titulo: 'Controle da dor', atividades: [{ id: 'c1', texto: 'Avaliar dor' }] }] },
  ],
};

test('itens da prescrição: só diagnósticos ativos, NIC repetida sai uma vez', () => {
  const { grupos, diagnosticos } = itensPrescricao(sae);
  assert.deepEqual(diagnosticos, ['Risco de lesão por pressão', 'Risco de infecção']);
  assert.equal(grupos.length, 2);
  const inf = grupos.find((g) => g.codigo === '6540');
  assert.deepEqual(inf.diagnosticos, ['Risco de lesão por pressão', 'Risco de infecção']);
  assert.deepEqual(inf.atividades.map((a) => a.texto), ['Higienizar as mãos', 'Trocar curativo']);
  assert.equal(inf.resp, 'ENF');
  const lpp = grupos.find((g) => g.codigo === '3540');
  assert.equal(lpp.resp, 'TÉC');
  assert.equal(lpp.atividades[0].obs, 'D → DD → E');
  assert.ok(!grupos.some((g) => g.codigo === '1400'));
  assert.deepEqual(itensPrescricao(null), { grupos: [], diagnosticos: [] });
});

test('aprazamento continua no plano do dia seguinte', () => {
  const novo = planoParaNovoDia(sae);
  const a = novo.diagnosticos[0].nic[0].atividades[0];
  assert.equal(a.freq, '02/02H');
  assert.deepEqual(a.horarios, ['08', '10']);
  assert.equal(a.obsPrescricao, 'D → DD → E');
  assert.equal(a.status, '');
});

test('cabeçalho: validade no dia seguinte, idade e enfermeiro com Coren', () => {
  const internacao = { paciente: { nome: 'PACIENTE TESTE', registro: '123', convenio: 'sus', dataNascimento: '1950-05-10' }, alergias: { situacao: 'possui', descricao: 'dipirona' }, diagnosticoMedico: 'Sepse' };
  const c = camposPrescricao(internacao, { finalizadoPorNome: { nome: 'Ana', coren: '999' } }, { leitoNum: '03', unidadeNome: 'UTI 1', data: '2026-12-31' });
  assert.equal(c.validade, '01/01/2027');
  assert.equal(c.nascimento, '10/05/1950 (76 anos)');
  assert.equal(c.profissional, 'Ana (Coren 999)');
  assert.equal(c.alergias, 'DIPIRONA');
  assert.equal(c.leito, 'LEITO 03');
  assert.equal(nomeProfissional('Fulano'), 'Fulano');
  const rascunho = camposPrescricao(internacao, { status: 'rascunho' }, { leitoNum: '03', data: '2026-12-31', quemImprime: { nome: 'Bia', coren: '111' } });
  assert.equal(rascunho.profissional, 'Bia (Coren 111)', 'antes de finalizar: quem imprime');
  assert.equal(camposPrescricao(internacao, { finalizadoPorNome: { nome: 'Ana', coren: '999' } }, { data: '2026-12-31', quemImprime: { nome: 'Bia' } }).profissional, 'Ana (Coren 999)', 'finalizada: quem finalizou');
  assert.equal(siglaResponsavel('Enfermeiro (pós-graduado)'), 'ENF');
});
