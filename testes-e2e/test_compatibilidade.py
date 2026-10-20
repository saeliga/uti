"""Compatibilidade (ISO/IEC 25010:2023): troca de informação com o PEP e com a impressão.

O sistema não se integra ao PEP: o enfermeiro copia o texto e cola. O teste
confere que a área de transferência recebe as duas versões (com formatação e
texto simples) e que a impressão da evolução e da prescrição gera as folhas.
A colagem no PEP real da instituição é conferida à parte, de forma manual.
"""
from apoio import TesteNavegador


class TrocaDeInformacao(TesteNavegador):
    so_navegadores = {'chromium'}  # leitura da área de transferência só no Chromium

    def _evolucao_finalizada(self):
        p = self.pagina
        p.add_init_script('window.print = () => { window.__impressoes = (window.__impressoes || 0) + 1; };')
        self.entrar()
        iid = p.locator('.leito-ocupado').first.locator('.leito-evolucao').get_attribute('href').split('/')[-1]
        ontem = self.demo('return turnos.diaAnterior(turnos.diaAssistencial());')
        p.goto(f'{self.base}?demo=1#/evolucao/{iid}/{ontem}')
        p.wait_for_selector('.evo-cabecalho')
        self.aba('Finalizar')
        return p

    def test_01_copia_com_e_sem_formatacao(self):
        """Copiar para o PEP põe HTML (títulos em negrito) e texto simples na área de transferência"""
        p = self._evolucao_finalizada()
        p.get_by_role('button', name='Copiar para o PEP').click()
        p.locator('.janela-fundo').last.get_by_role('button', name='Copiar texto').click()
        p.wait_for_timeout(500)
        tipos = p.evaluate("""async () => {
            const [item] = await navigator.clipboard.read();
            const out = {};
            for (const t of item.types) out[t] = await (await item.getType(t)).text();
            return out;
        }""")
        self.assertIn('text/html', tipos)
        self.assertIn('text/plain', tipos)
        self.assertIn('<b>', tipos['text/html'])
        self.assertNotIn('<', tipos['text/plain'])
        self.assertIn('PELE E LESÕES', tipos['text/plain'])

    def test_02_impressao_da_evolucao_e_da_prescricao(self):
        """Imprimir a evolução e a prescrição de enfermagem gera as folhas"""
        p = self._evolucao_finalizada()
        p.get_by_role('button', name='Imprimir / PDF').click()
        p.wait_for_timeout(600)
        self.assertGreater(p.locator('body > .impressao').count(), 0, 'folha da evolução montada')
        self.assertIn('PACIENTE:', p.locator('body > .impressao').inner_text(), 'a folha impressa identifica o paciente')
        p.get_by_role('button', name='Imprimir prescrição de enfermagem').first.click()
        p.wait_for_timeout(2200)
        self.assertGreater(p.locator('.lote-impressao .folha').count(), 0)
        self.assertGreaterEqual(p.evaluate('window.__impressoes || 0'), 2)


if __name__ == '__main__':
    import unittest
    unittest.main()
