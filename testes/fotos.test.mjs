import test from 'node:test';
import assert from 'node:assert/strict';
import { FOTO, dimensoes, galeria, novoIdLesao } from '../js/regras/fotos.js';

test('fotos: redução mantém a proporção e não aumenta foto pequena', () => {
  assert.deepEqual(dimensoes(4000, 3000, 1280), { largura: 1280, altura: 960 });
  assert.deepEqual(dimensoes(3000, 4000, 1280), { largura: 960, altura: 1280 });
  assert.deepEqual(dimensoes(800, 600, 1280), { largura: 800, altura: 600 });
  assert.ok(FOTO.maxImagem < 1000000, 'cabe no limite de 1 MB por registro do Firestore');
});

test('fotos: galeria sem as excluídas, da mais recente para a mais antiga', () => {
  const g = galeria([{ id: 'a', data: '2026-10-10' }, { id: 'b', data: '2026-10-12' }, { id: 'c', data: '2026-10-11', excluida: true }, { id: 'd', data: '2026-10-12', ordem: 5 }]);
  assert.deepEqual(g.map((f) => f.id), ['d', 'b', 'a']);
  assert.match(novoIdLesao(), /^l[a-z0-9]+$/);
  assert.notEqual(novoIdLesao(), novoIdLesao());
});
