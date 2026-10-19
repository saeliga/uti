"""Capacidade de interação (ISO/IEC 25010:2023): acessibilidade WCAG 2.1 A/AA com axe-core.

Grava as violações encontradas em resultados/axe-<navegador>-<perfil>.json; o
relatório de qualidade compara com o critério (nenhuma violação). O teste em si
não reprova: a acessibilidade é métrica acompanhada a cada versão.
Precisa do axe-core (npm install axe-core); sem ele, o teste é pulado.
"""
import json
import os
import unittest
from pathlib import Path

from apoio import NAVEGADOR, PERFIL, RAIZ, RESULTADOS, TesteNavegador

AXE = Path(os.environ.get('AXE_JS', RAIZ / 'node_modules' / 'axe-core' / 'axe.min.js'))


@unittest.skipUnless(AXE.exists(), 'axe-core não instalado')
class Acessibilidade(TesteNavegador):

    def _avaliar(self, nome):
        p = self.pagina
        p.add_script_tag(path=str(AXE))
        r = p.evaluate("""async () => {
            const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
            return r.violations.map((v) => ({ id: v.id, impacto: v.impact, ajuda: v.help, url: v.helpUrl, ocorrencias: v.nodes.length,
              exemplos: v.nodes.slice(0, 6).map((n) => {
                const d = (n.any && n.any[0] && n.any[0].data) || {};
                return [n.target.join(' '), d.contrastRatio ? `${d.fgColor} sobre ${d.bgColor} = ${d.contrastRatio}:1` : '', (n.html || '').slice(0, 90)].filter(Boolean).join(' | ');
              }) }));
        }""")
        return {'tela': nome, 'violacoes': r}

    def test_telas(self):
        """Telas principais sem violações WCAG 2.1 A/AA (registro)"""
        p = self.pagina
        telas = []
        p.goto(f'{self.base}?demo=1')
        p.wait_for_selector('.btn-google')
        telas.append(self._avaliar('Entrada'))
        p.click('.btn-google')
        p.wait_for_selector('.grade-leitos')
        p.wait_for_timeout(400)
        telas.append(self._avaliar('Painel de leitos'))
        p.locator('.leito-livre').first.get_by_text('Admitir paciente').click()
        p.wait_for_selector('.formulario')
        telas.append(self._avaliar('Admissão'))
        p.keyboard.press('Escape')
        self.abrir_evolucao(0)
        telas.append(self._avaliar('Evolução: avaliação'))
        self.aba('Processo de Enfermagem')
        telas.append(self._avaliar('Processo de Enfermagem'))
        self.aba('Finalizar')
        telas.append(self._avaliar('Finalizar e enviar ao PEP'))
        RESULTADOS.mkdir(parents=True, exist_ok=True)
        (RESULTADOS / f'axe-{NAVEGADOR}-{PERFIL}.json').write_text(json.dumps(telas, ensure_ascii=False, indent=1))
        total = sum(v['ocorrencias'] for t in telas for v in t['violacoes'])
        print(f'\nacessibilidade: {total} ocorrência(s) de violação em {len(telas)} telas')


if __name__ == '__main__':
    unittest.main()
