// Testes das regras puras. Rodar com: node --test testes/
import test from 'node:test';
import assert from 'node:assert/strict';
import { contagemDia, idade, diasEntre, dataValida, somarDias, antes, formatarDataHora } from '../js/regras/datas.js';
import { validarPaciente, validarInternacao, validarDesfecho, idPaciente, montarInternacao } from '../js/regras/validacao.js';

const AGORA = new Date(2026, 9, 16, 10, 0); // 16/10/2026 10:00 local

test('contagem de dias segue a folha de BH (admissão = D0)', () => {
  assert.equal(contagemDia('2026-10-16T08:00', '2026-10-16'), 'D0');
  assert.equal(contagemDia('2026-10-13T23:59', '2026-10-16'), 'D3');
  assert.equal(contagemDia('2026-10-16', '2026-10-17'), 'D1', 'folha impressa para amanhã soma 1');
  assert.equal(contagemDia('2026-10-17', '2026-10-16'), '', 'data futura não gera contagem');
  assert.equal(contagemDia('2026-02-27', '2026-03-01'), 'D2', 'virada de mês (2026 não é bissexto)');
});

test('idade e datas', () => {
  assert.equal(idade('1958-10-17', '2026-10-16'), 67, 'véspera do aniversário');
  assert.equal(idade('1958-10-16', '2026-10-16'), 68);
  assert.equal(diasEntre('2025-12-31', '2026-01-01'), 1);
  assert.equal(somarDias('2026-12-31', 1), '2027-01-01');
  assert.ok(dataValida('2024-02-29'));
  assert.ok(!dataValida('2026-02-29'));
  assert.ok(!dataValida('2026-10-16T24:00'));
  assert.ok(antes('2026-10-16', '2026-10-16T00:01'));
  assert.equal(formatarDataHora('2026-10-16T07:05'), '16/10/2026 07:05');
});

test('identificador do paciente a partir do registro', () => {
  assert.equal(idPaciente(' 12345.67 '), 'reg_1234567');
  assert.equal(idPaciente('demo-1001'), 'reg_DEMO1001');
  assert.equal(idPaciente('...'), '');
});

const formOk = {
  nome: 'ana  exemplo ficticia', dataNascimento: '1958-03-12', registro: 'DEMO-1', convenio: 'SUS',
  admissaoUti: '2026-10-16T08:30', admissaoHospital: '2026-10-15', tipo: 'clinico',
  diagnosticoMedico: 'Sepse', comorbidades: '', especialidade: '',
  alergiaSituacao: 'nega', alergiaDescricao: 'ignorado', isolamentoTipo: 'padrao', isolamentoMotivo: 'ignorado', pulseira: true,
};

test('admissão válida e normalização', () => {
  const i = montarInternacao(formOk);
  assert.equal(i.paciente.nome, 'ANA EXEMPLO FICTICIA');
  assert.equal(i.alergias.descricao, '', 'descrição só quando possui alergia');
  assert.equal(i.isolamento.motivo, '', 'motivo só quando há isolamento');
  assert.deepEqual(validarPaciente(i.paciente, AGORA), {});
  assert.deepEqual(validarInternacao(i, AGORA), {});
});

test('admissão: erros esperados', () => {
  const i = montarInternacao({ ...formOk, nome: 'Ana', dataNascimento: '2027-01-01', registro: '' });
  const e = validarPaciente(i.paciente, AGORA);
  assert.ok(e.nome && e.dataNascimento && e.registro);
  const j = montarInternacao({
    ...formOk, admissaoUti: '2026-10-16T12:00', admissaoHospital: '2026-10-17', diagnosticoMedico: ' ',
    alergiaSituacao: 'possui', alergiaDescricao: '', isolamentoTipo: 'contato', isolamentoMotivo: '',
  });
  const f = validarInternacao(j, AGORA);
  assert.ok(f.admissaoUti, 'admissão no futuro (além da tolerância de 15 min)');
  assert.ok(f.admissaoHospital, 'internação hospitalar depois da UTI');
  assert.ok(f.diagnosticoMedico && f.alergias && f.isolamento);
  const k = montarInternacao({ ...formOk, admissaoUti: '2026-10-16T10:10' });
  assert.equal(validarInternacao(k, AGORA).admissaoUti, undefined, 'até 15 min no futuro é aceito');
});

test('desfecho', () => {
  const internacao = { admissaoUti: '2026-10-16T08:30' };
  assert.deepEqual(validarDesfecho({ tipo: 'obito', dataHora: '2026-10-16T09:00', destino: '' }, internacao, AGORA), {});
  assert.ok(validarDesfecho({ tipo: 'alta', dataHora: '2026-10-16T09:00', destino: '' }, internacao, AGORA).destino);
  assert.ok(validarDesfecho({ tipo: 'alta', dataHora: '2026-10-16T08:00', destino: 'Enfermaria' }, internacao, AGORA).dataHora);
  assert.ok(validarDesfecho({ tipo: 'x', dataHora: '', destino: '' }, internacao, AGORA).tipo);
});
