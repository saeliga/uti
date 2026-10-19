"""Apoio aos testes de ponta a ponta (Playwright, Python, unittest).

Sobe um servidor local com o site, abre o navegador escolhido e entra no modo
demonstração (dados fictícios em memória). Nada usa dados reais.

Variáveis de ambiente:
  NAVEGADOR  chromium (padrão) | firefox | webkit
  PERFIL     desktop (padrão, 1280x800) | tablet (820x1180, toque)
  RESULTADOS pasta onde gravar o resumo JSON de cada execução (padrão: resultados)
"""
import functools
import http.server
import json
import os
import socketserver
import threading
import time
import unittest
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
NAVEGADOR = os.environ.get('NAVEGADOR', 'chromium')
PERFIL = os.environ.get('PERFIL', 'desktop')
PERFIS = {
    'desktop': {'viewport': {'width': 1280, 'height': 800}},
    'tablet': {'viewport': {'width': 820, 'height': 1180}, 'has_touch': True, 'is_mobile': NAVEGADOR != 'firefox'},
}
RESULTADOS = Path(os.environ.get('RESULTADOS', RAIZ / 'resultados'))


class _Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def _servidor():
    handler = functools.partial(_Silencioso, directory=str(RAIZ))
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


class TesteNavegador(unittest.TestCase):
    """Base: um servidor e um navegador por classe; uma página nova por teste."""

    pw = navegador = srv = None
    base = ''
    so_navegadores = None  # ex.: {'chromium'} para testes que dependem de recursos do Chromium

    @classmethod
    def setUpClass(cls):
        if cls.so_navegadores and NAVEGADOR not in cls.so_navegadores:
            raise unittest.SkipTest(f'só roda em {", ".join(sorted(cls.so_navegadores))}')
        cls.srv = _servidor()
        cls.base = f'http://127.0.0.1:{cls.srv.server_address[1]}/'
        cls.pw = sync_playwright().start()
        exe = '/opt/pw-browsers/chromium' if NAVEGADOR == 'chromium' and os.path.exists('/opt/pw-browsers/chromium') and not os.environ.get('CI') else None
        cls.navegador = getattr(cls.pw, NAVEGADOR).launch(**({'executable_path': exe} if exe else {}))

    @classmethod
    def tearDownClass(cls):
        if cls.navegador:
            cls.navegador.close()
        if cls.pw:
            cls.pw.stop()
        if cls.srv:
            cls.srv.shutdown()

    def setUp(self):
        opcoes = dict(PERFIS[PERFIL])
        if NAVEGADOR == 'chromium':
            opcoes['permissions'] = ['clipboard-read', 'clipboard-write']
        self.contexto = self.navegador.new_context(**opcoes)
        self.contexto.set_default_timeout(15000)
        self.erros = []
        self.pagina = self.contexto.new_page()
        self.pagina.on('pageerror', lambda e: self.erros.append(str(e)))
        # Fontes externas não importam para os testes e deixam o carregamento instável.
        self.pagina.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        self.pagina.route('**/fonts.gstatic.com/**', lambda r: r.abort())

    def tearDown(self):
        self.contexto.close()
        self.assertEqual(self.erros, [], 'erros de JavaScript na página')

    # ------------------------------------------------------------- atalhos
    def entrar(self, extra=''):
        p = self.pagina
        p.goto(f'{self.base}?demo=1{extra}')
        p.click('.btn-google')
        p.wait_for_selector('.grade-leitos')
        return p

    def abrir_evolucao(self, n=0):
        p = self.pagina
        p.locator('.leito-ocupado').nth(n).locator('.leito-evolucao').click()
        p.wait_for_selector('.evo-cabecalho')
        p.wait_for_timeout(400)
        return p

    def aba(self, texto):
        self.pagina.locator('.evo-aba', has_text=texto).click()
        self.pagina.wait_for_timeout(300)

    def rodape(self, texto):
        self.pagina.locator('.janela-fundo').last.locator('.janela-rodape button', has_text=texto).click()

    def demo(self, js):
        """Executa código com acesso aos módulos do modo demonstração (para conferir o que foi gravado)."""
        return self.pagina.evaluate(
            """async (codigo) => {
                const v = document.querySelector('script[type=importmap]') ? '' : '';
                const imp = (m) => import(new URL(m, location.href).href);
                const demo = await imp('js/dados/demo.js');
                const turnos = await imp('js/regras/turnos.js');
                return await (new Function('demo', 'turnos', `return (async () => { ${codigo} })()`))(demo, turnos);
            }""", js)


class Resultado(unittest.TextTestResult):
    """Guarda cada teste com situação e tempo, para o relatório de qualidade."""

    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self.registros = []
        self._inicio = {}

    def startTest(self, test):
        self._inicio[test.id()] = time.time()
        super().startTest(test)

    def _reg(self, test, situacao, detalhe=''):
        self.registros.append({
            'id': test.id(), 'descricao': (test.shortDescription() or test.id().split('.')[-1]),
            'situacao': situacao, 'segundos': round(time.time() - self._inicio.get(test.id(), time.time()), 2),
            'detalhe': detalhe[-800:],
        })

    def addSuccess(self, test):
        super().addSuccess(test); self._reg(test, 'aprovado')

    def addFailure(self, test, err):
        super().addFailure(test, err); self._reg(test, 'reprovado', self._exc_info_to_string(err, test))

    def addError(self, test, err):
        super().addError(test, err); self._reg(test, 'erro', self._exc_info_to_string(err, test))

    def addSkip(self, test, reason):
        super().addSkip(test, reason); self._reg(test, 'pulado', reason)


def rodar(padrao='test_*.py'):
    suite = unittest.defaultTestLoader.discover(str(Path(__file__).parent), pattern=padrao)
    runner = unittest.TextTestRunner(resultclass=Resultado, verbosity=2)
    r = runner.run(suite)
    RESULTADOS.mkdir(parents=True, exist_ok=True)
    nome = os.environ.get('NOME_RESULTADO', f'e2e-{NAVEGADOR}-{PERFIL}')
    (RESULTADOS / f'{nome}.json').write_text(json.dumps({
        'navegador': NAVEGADOR, 'perfil': PERFIL, 'testes': r.registros,
    }, ensure_ascii=False, indent=1))
    # Anotações do GitHub Actions (aparecem no resumo do PR).
    if os.environ.get('GITHUB_ACTIONS'):
        for x in r.registros:
            if x['situacao'] in ('reprovado', 'erro'):
                msg = x['detalhe'].replace('\n', '%0A')
                print(f"::error title={nome}: {x['descricao']}::{msg}")
    return r.wasSuccessful()


if __name__ == '__main__':
    import sys
    sys.exit(0 if rodar(sys.argv[1] if len(sys.argv) > 1 else 'test_*.py') else 1)
