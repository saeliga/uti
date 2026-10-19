// Janela com o guia rápido de uma escala (aberta pelo botão "i" do formulário).

import { h, abrirJanela } from '../../nucleo/ui.js';
import { INFO_ESCALAS } from '../../regras/escalas-info.js';

export function abrirInfoEscala(chave) {
  const e = INFO_ESCALAS[chave];
  if (!e) return;
  abrirJanela({
    titulo: e.titulo,
    conteudo: h('div', { class: 'info-escala' },
      h('p', {}, e.resumo),
      ...e.secoes.map((s) => h('section', {},
        h('h3', {}, s.titulo),
        h('table', { class: 'info-escala-tabela' },
          h('tbody', {}, s.itens.map(([pontos, texto]) => h('tr', {}, h('th', { scope: 'row' }, pontos), h('td', {}, texto))))))),
      e.dicas?.length && h('section', {}, h('h3', {}, 'Como aplicar'), h('ul', {}, e.dicas.map((d) => h('li', {}, d)))),
      h('p', { class: 'info-escala-fonte' }, 'Referência: ', e.fonte)),
    acoes: [{ texto: 'Fechar', classe: 'btn-primario' }],
  });
}
