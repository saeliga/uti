import test from 'node:test';
import assert from 'node:assert/strict';
import { comFotos } from '../js/regras/evolucao.js';
import { GRUPOS_INFUSAO } from '../js/regras/infusoes.js';

test('fotos das lesões entram logo após PELE E LESÕES', () => {
  const linhas = [{ negrito: 'A - AVALIAÇÃO:' }, { negrito: 'PELE E LESÕES:', texto: 'LPP' }, { negrito: 'DISPOSITIVOS:' }, { negrito: 'R - RECOMENDAÇÕES:' }];
  const r = comFotos(linhas, [{ titulo: 'Foto da lesão – LPP sacral (18/10/2026)', src: 'data:image/jpeg;base64,AA' }]);
  assert.equal(r[2].foto, 'data:image/jpeg;base64,AA');
  assert.equal(r[2].negrito, 'FOTO DA LESÃO - LPP SACRAL (18/10/2026):');
  assert.equal(r[3].negrito, 'DISPOSITIVOS:');
  assert.deepEqual(comFotos(linhas, []), linhas);
});

test('sem a linha de pele, a foto vai antes das recomendações', () => {
  const r = comFotos([{ negrito: 'A - AVALIAÇÃO:' }, { negrito: 'R - RECOMENDAÇÕES:' }], [{ titulo: 'x', src: 'data:' }]);
  assert.equal(r[1].foto, 'data:');
  assert.equal(r[2].negrito, 'R - RECOMENDAÇÕES:');
});

test('outras infusões ficam por último', () => {
  assert.equal(GRUPOS_INFUSAO.at(-1).id, 'outras');
});
