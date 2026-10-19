import test from 'node:test';
import assert from 'node:assert/strict';
import { podeDesfazerSaida, historicoAposReversao, validarReversao, leitosParaVoltar, saidasRecentes, msTempo } from '../js/regras/saidas.js';

const agora = Date.parse('2026-10-18T12:00:00Z');

test('prazo de 24 h para desfazer (administrador sem prazo)', () => {
  assert.equal(podeDesfazerSaida('2026-10-18T01:00:00Z', { agora }), true);
  assert.equal(podeDesfazerSaida('2026-10-17T11:00:00Z', { agora }), false);
  assert.equal(podeDesfazerSaida('2026-10-01T11:00:00Z', { agora, admin: true }), true);
  assert.equal(podeDesfazerSaida(null, { agora }), false);
  assert.equal(msTempo({ toMillis: () => 5 }), 5);
});

test('histórico: mesmo leito reabre o trecho; outro leito abre trecho novo', () => {
  const hist = [{ leitoId: 'uti1_01', unidade: 'uti1', de: '2026-10-16T10:00', ate: '2026-10-18T10:00' }];
  assert.deepEqual(historicoAposReversao(hist, 'uti1_01', 'uti1', '2026-10-18T11:00'), [{ ...hist[0], ate: '' }]);
  const outro = historicoAposReversao(hist, 'uti1_03', 'uti1', '2026-10-18T11:00');
  assert.equal(outro.length, 2);
  assert.equal(outro[0].ate, '2026-10-18T11:00');
  assert.deepEqual(outro[1], { leitoId: 'uti1_03', unidade: 'uti1', de: '2026-10-18T11:00', ate: '' });
  assert.equal(hist[0].ate, '2026-10-18T10:00', 'não altera o original');
});

test('motivo obrigatório e leito', () => {
  assert.ok(validarReversao({ motivo: 'erro', leitoId: 'x' }).motivo);
  assert.ok(validarReversao({ motivo: 'alta suspensa pela equipe', leitoId: '' }).leitoId);
  assert.deepEqual(validarReversao({ motivo: 'alta suspensa pela equipe', leitoId: 'x' }), {});
});

test('leitos para voltar e saídas recentes', () => {
  const r = new Date(agora - 3600e3).toISOString();
  const leitos = [
    { id: 'uti1_01', unidade: 'uti1', numero: '01', internacaoId: null, bloqueado: false, ultimaSaida: { internacaoId: 'i1', nome: 'A', tipo: 'alta', registradoEm: r } },
    { id: 'uti1_02', unidade: 'uti1', numero: '02', internacaoId: 'i2', bloqueado: false, ultimaSaida: { internacaoId: 'i0', nome: 'B', registradoEm: '2026-10-10T00:00:00Z' } },
    { id: 'uti1_03', unidade: 'uti1', numero: '03', internacaoId: null, bloqueado: true },
    { id: 'uti1_04', unidade: 'uti1', numero: '04', internacaoId: null, bloqueado: false },
    { id: 'uti2_05', unidade: 'uti2', numero: '05', internacaoId: null, bloqueado: false },
  ];
  assert.deepEqual(leitosParaVoltar(leitos, 'uti1', 'uti1_04').map((l) => l.id), ['uti1_04', 'uti1_01']);
  const s = saidasRecentes(leitos, { agora });
  assert.equal(s.length, 1);
  assert.equal(s[0].leitoId, 'uti1_01');
  assert.equal(saidasRecentes(leitos, { agora, admin: true }).length, 2);
});
