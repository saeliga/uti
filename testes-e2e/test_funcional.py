"""Adequação funcional (ISO/IEC 25010:2023): casos de uso principais, com dados fictícios."""
import re

from apoio import TesteNavegador


class CasosDeUso(TesteNavegador):

    def test_01_entrar_e_painel(self):
        """Entrar e ver o painel de leitos das duas UTI"""
        p = self.entrar()
        self.assertEqual(p.locator('.leito').count(), 11, 'UTI 1 tem 11 leitos')
        self.assertGreater(p.locator('.leito-ocupado').count(), 0)
        p.get_by_role('link', name='UTI 2').or_(p.get_by_role('button', name='UTI 2')).first.click()
        p.wait_for_timeout(500)
        self.assertEqual(p.locator('.leito').count(), 10, 'UTI 2 tem 10 leitos')

    def test_02_admissao(self):
        """Admitir paciente em leito livre, com validação dos campos obrigatórios"""
        p = self.entrar()
        antes = p.locator('.leito-ocupado').count()
        p.locator('.leito-livre').first.get_by_text('Admitir paciente').click()
        p.wait_for_selector('.formulario')
        self.rodape('Admitir')
        p.wait_for_timeout(300)
        self.assertGreater(p.locator('.janela .campo-erro').count(), 0, 'formulário vazio mostra erros')
        p.fill('input[name=registro]', 'TESTE-0001')
        p.fill('input[name=dataNascimento]', '1970-05-04')
        p.fill('input[name=nome]', 'paciente ficticio automatizado')
        p.fill('textarea[name=diagnosticoMedico]', 'Sepse de foco abdominal (fictício)')
        p.check('input[name=alergiaSituacao][value=nega]')
        self.rodape('Admitir')
        p.wait_for_selector('.leito-ocupado >> text=PACIENTE FICTICIO AUTOMATIZADO')
        self.assertEqual(p.locator('.leito-ocupado').count(), antes + 1)

    def test_03_evolucao_grava(self):
        """Preencher sinais vitais na evolução e gravar"""
        p = self.entrar()
        self.abrir_evolucao(1)
        sb = p.locator('[data-sub=sinais]')
        sb.locator('[data-campo=horario] input').fill('14:00')
        for campo, valor in [('fc', '88'), ('fr', '22'), ('pas', '120'), ('pad', '70'), ('spo2', '94')]:
            sb.locator(f'[data-campo={campo}] input').fill(valor)
        sb.locator('[data-campo=fc] input').press('Tab')
        p.wait_for_timeout(2500)
        fc = self.demo("""const iid = location.hash.split('/')[2];
            const ev = await demo.lerEvolucao(turnos.idEvolucao(iid, turnos.diaAssistencial()));
            return ev?.dados?.sinais?.fc;""")
        self.assertEqual(fc, '88', 'a frequência cardíaca foi gravada')

    def test_04_campo_numerico_recusa_texto(self):
        """Campos numéricos (sinais vitais) não aceitam letras"""
        p = self.entrar()
        self.abrir_evolucao(1)
        campo = p.locator('[data-sub=sinais] [data-campo=fc] input')
        campo.fill('')
        campo.type('8a0')
        self.assertEqual(campo.input_value(), '80')

    def test_05_processo_enfermagem_com_ia(self):
        """Pedir sugestão do PE à IA, aceitar e descartar sugestões"""
        p = self.entrar()
        self.abrir_evolucao(0)
        self.aba('Processo de Enfermagem')
        p.get_by_role('button', name=re.compile('Sugerir PE com IA|Pedir nova sugestão')).click()
        p.locator('.janela-fundo').last.get_by_role('button', name='Revisar agora').click(timeout=10000)
        p.wait_for_timeout(300)
        n = p.locator('.sae-sugestao').count()
        self.assertGreaterEqual(n, 1, 'a IA trouxe sugestões para revisar')
        self.assertRegex(p.locator('.sae-sugestao').first.inner_text(), r'prioridade \d da IA', 'a ordem de prioridade da IA aparece na sugestão')
        planos = p.locator('.sae-diagnostico').count()
        p.locator('.sae-sugestao').first.get_by_role('button', name='Aceitar', exact=True).click()
        p.wait_for_timeout(300)
        decididas = 1
        if n > 1:
            p.locator('.sae-sugestao').first.get_by_role('button', name='Descartar').click()
            p.wait_for_timeout(300)
            decididas = 2
        self.assertEqual(p.locator('.sae-diagnostico').count(), planos + 1, 'só a sugestão aceita entrou no plano')
        self.assertEqual(p.locator('.sae-sugestao').count(), n - decididas)

    def test_06_copiar_para_pep(self):
        """Ver o texto da evolução finalizada para copiar ao PEP (formato SBAR)"""
        p = self.entrar()
        iid = p.locator('.leito-ocupado').first.locator('.leito-evolucao').get_attribute('href').split('/')[-1]
        ontem = self.demo('return turnos.diaAnterior(turnos.diaAssistencial());')
        p.goto(f'{self.base}?demo=1#/evolucao/{iid}/{ontem}')
        p.wait_for_selector('.evo-cabecalho')
        self.aba('Finalizar')
        p.get_by_role('button', name='Copiar para o PEP').click()
        texto = p.locator('.previa-pep').inner_text()
        for trecho in ('S - SITUAÇÃO', 'PELE E LESÕES', 'R - RECOMENDAÇÕES'):
            self.assertIn(trecho, texto)
        self.assertEqual(texto, texto.upper(), 'o texto vai em caixa alta')

    def test_07_alta_e_desfazer(self):
        """Registrar alta e desfazer a saída registrada por engano"""
        p = self.entrar()
        antes = p.locator('.leito-ocupado').count()
        p.locator('.leito-ocupado').first.locator('.leito-abrir').click()
        p.get_by_role('button', name='Registrar saída da UTI').click()
        p.check('.janela input[name=tipo][value=alta]')
        p.fill('.janela [data-campo=destino] input', 'Enfermaria (teste)')
        self.rodape('Registrar saída')
        p.wait_for_selector('.leito-saida')
        self.assertEqual(p.locator('.leito-ocupado').count(), antes - 1)
        p.locator('.leito-saida button').first.click()
        p.locator('.janela textarea').fill('Alta suspensa pela equipe médica (teste)')
        self.rodape('Desfazer saída')
        p.wait_for_timeout(800)
        self.assertEqual(p.locator('.leito-ocupado').count(), antes)
        self.assertEqual(p.locator('.leito-saida').count(), 0)

    def test_08_troca_de_leito(self):
        """Trocar o paciente de leito"""
        p = self.entrar()
        nome = p.locator('.leito-ocupado').first.locator('.leito-nome').inner_text()
        p.locator('.leito-ocupado').first.locator('.leito-abrir').click()
        p.get_by_role('button', name='Trocar de leito').click()
        destino = p.locator('.janela select[name=destino] option').nth(1).get_attribute('value')
        p.select_option('.janela select[name=destino]', destino)
        self.rodape('Confirmar troca')
        p.wait_for_timeout(800)
        numero = destino.split('_')[1]
        self.assertIn(nome, p.locator('.leito', has_text=f'Leito {numero}').first.inner_text())

    def test_09_impressos(self):
        """Gerar os impressos da unidade (capa, ocorrências, balanço hídrico)"""
        p = self.pagina
        p.add_init_script('window.print = () => { window.__impressoes = (window.__impressoes || 0) + 1; };')
        self.entrar()
        for botao in ('Capa da ocorrência', 'Ocorrências (transição)', 'Balanço hídrico'):
            p.locator('.painel-impressos button, .barra-impressos button', has_text=botao).first.click()
            p.wait_for_timeout(300)
            p.locator('.janela-fundo').last.locator('.janela-rodape button', has_text=re.compile('mprimir')).last.click()
            p.wait_for_timeout(2200)
            self.assertGreater(p.locator('.lote-impressao .folha').count(), 0, f'{botao} gerou folhas')
        self.assertGreaterEqual(p.evaluate('window.__impressoes || 0'), 3)


if __name__ == '__main__':
    import unittest
    unittest.main()
