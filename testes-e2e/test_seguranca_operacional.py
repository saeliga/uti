"""Segurança operacional (ISO/IEC 25010:2023, safety): a falha da IA não bloqueia o trabalho.

A IA é simulada falhando (?falhaia=erro|tempo). O enfermeiro precisa continuar
a evolução e montar o Processo de Enfermagem pela biblioteca. A conferência dos
códigos devolvidos pela IA (nada inventado chega à tela) está nos testes do
servidor (testes/appsscript.test.mjs).
"""
from apoio import TesteNavegador


class FalhaDaIA(TesteNavegador):

    def _pe_manual(self, p):
        """Acrescenta um diagnóstico pela biblioteca, com evidências."""
        antes = p.locator('.sae-diagnostico').count()
        p.get_by_role('button', name='+ Diagnóstico da biblioteca').click()
        p.fill('.janela input[type=search]', 'dor')
        p.wait_for_selector('.sae-resultado', timeout=8000)
        p.locator('.sae-resultado').first.click()
        p.wait_for_selector('.janela >> text=Salvar evidências')
        p.locator('.janela fieldset').nth(0).locator('.sae-item').first.click()
        p.locator('.janela fieldset').nth(1).locator('.sae-item').first.click()
        p.locator('.janela-fundo').last.get_by_role('button', name='Salvar evidências').click()
        p.wait_for_timeout(400)
        self.assertEqual(p.locator('.sae-diagnostico').count(), antes + 1, 'diagnóstico da biblioteca entrou no plano')

    def _falha(self, tipo):
        p = self.entrar(f'&falhaia={tipo}')
        self.abrir_evolucao(1)
        self.aba('Processo de Enfermagem')
        botao = p.locator('.btn-ia')
        botao.click()
        p.wait_for_selector('.aviso-erro, .aviso-atencao', timeout=10000)
        p.wait_for_function("() => !document.querySelector('.btn-ia')?.disabled", timeout=10000)
        self.assertEqual(p.locator('.sae-sugestao').count(), 0, 'nenhuma sugestão aparece quando a IA falha')
        self._pe_manual(p)
        # A avaliação continua gravando normalmente.
        self.aba('Avaliação')
        campo = p.locator('[data-sub=sinais] [data-campo=fr] input')
        campo.fill('24')
        campo.press('Tab')
        p.wait_for_timeout(2500)
        fr = self.demo("""const iid = location.hash.split('/')[2];
            const ev = await demo.lerEvolucao(turnos.idEvolucao(iid, turnos.diaAssistencial()));
            return ev?.dados?.sinais?.fr;""")
        self.assertEqual(fr, '24')

    def test_01_ia_responde_fora_do_formato(self):
        """IA responde fora do formato: aviso, sem sugestão, PE manual e evolução seguem"""
        self._falha('erro')

    def test_02_ia_nao_responde(self):
        """IA não responde (tempo esgotado): aviso, sem sugestão, PE manual e evolução seguem"""
        self._falha('tempo')

    def test_03_sem_internet(self):
        """Sem internet, o pedido à IA é recusado com aviso e a tela continua utilizável"""
        p = self.entrar()
        self.abrir_evolucao(1)
        self.aba('Processo de Enfermagem')
        self.contexto.set_offline(True)
        p.locator('.btn-ia').click()
        p.wait_for_selector('.aviso-atencao', timeout=5000)
        self.assertEqual(p.locator('.sae-sugestao').count(), 0)
        self.assertFalse(p.locator('.btn-ia').is_disabled())
        self.contexto.set_offline(False)


if __name__ == '__main__':
    import unittest
    unittest.main()
