"""Confiabilidade (ISO/IEC 25010:2023): sem perda de registro com Wi-Fi instável e edição simultânea.

Roda o app de verdade (Firebase) ligado aos simuladores oficiais do Firebase
(Auth e Firestore), com contas e paciente fictícios. Só roda com EMULADOR=1,
dentro de `firebase emulators:exec --only firestore,auth` (ver o workflow).
"""
import json
import os
import time
import unittest
import urllib.request

from apoio import TesteNavegador

PROJETO = 'demo-uti-liga'
FS = f'http://127.0.0.1:8080/v1/projects/{PROJETO}/databases/(default)/documents'


def _valor(v):
    if v is None:
        return {'nullValue': None}
    if isinstance(v, bool):
        return {'booleanValue': v}
    if isinstance(v, int):
        return {'integerValue': str(v)}
    if isinstance(v, str):
        return {'stringValue': v}
    if isinstance(v, list):
        return {'arrayValue': {'values': [_valor(x) for x in v]}}
    if isinstance(v, dict):
        return {'mapValue': {'fields': {k: _valor(x) for k, x in v.items()}}}
    raise TypeError(v)


def _py(v):
    if 'mapValue' in v:
        return {k: _py(x) for k, x in v['mapValue'].get('fields', {}).items()}
    if 'arrayValue' in v:
        return [_py(x) for x in v['arrayValue'].get('values', [])]
    for k in ('stringValue', 'booleanValue', 'doubleValue', 'timestampValue'):
        if k in v:
            return v[k]
    if 'integerValue' in v:
        return int(v['integerValue'])
    return None


def _req(metodo, caminho, corpo=None):
    # "Bearer owner" é o acesso de administrador do simulador (ignora as regras): só para preparar e conferir.
    r = urllib.request.Request(f'{FS}/{caminho}', method=metodo, data=json.dumps(corpo).encode() if corpo else None,
                               headers={'Authorization': 'Bearer owner', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(r, timeout=10) as resp:
        return json.loads(resp.read() or b'{}')


def gravar(caminho, dados):
    _req('PATCH', caminho, {'fields': {k: _valor(v) for k, v in dados.items()}})


def uid_no_emulador(email):
    # O uid do Firebase não é o "sub" da conta Google: lê no simulador de Auth.
    url = f'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/{PROJETO}/accounts:batchGet?maxResults=100'
    r = urllib.request.Request(url, headers={'Authorization': 'Bearer owner'})
    with urllib.request.urlopen(r, timeout=10) as resp:
        for u in json.loads(resp.read()).get('users', []):
            if u.get('email') == email:
                return u['localId']
    return None


def evolucoes():
    docs = _req('GET', 'evolucoes').get('documents', [])
    return [_py({'mapValue': {'fields': d.get('fields', {})}}) for d in docs]


CONTAS = {
    'enf-a': {'uid': 'enf-a', 'email': 'enf-a@liga.org.br', 'nome': 'ENFERMEIRA A (TESTE)'},
    'enf-b': {'uid': 'enf-b', 'email': 'enf-b@liga.org.br', 'nome': 'ENFERMEIRO B (TESTE)'},
}


@unittest.skipUnless(os.environ.get('EMULADOR') == '1', 'precisa dos simuladores do Firebase (EMULADOR=1)')
class SemPerdaDeRegistro(TesteNavegador):
    so_navegadores = {'chromium'}

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        gravar('unidades/uti1', {'nome': 'UTI 1', 'ordem': 1, 'leitos': ['01', '02']})
        for n in ('01', '02'):
            gravar(f'leitos/uti1_{n}', {'unidade': 'uti1', 'numero': n, 'internacaoId': None, 'resumo': None, 'bloqueado': False, 'bloqueio': None})

    def _estado(self, pagina, segundos=30):
        """Espera a tela assentar: 'painel', 'primeiro_acesso' ou 'entrada'."""
        fim = time.time() + segundos
        while time.time() < fim:
            if pagina.locator('.grade-leitos').count():
                return 'painel'
            if pagina.get_by_role('button', name='Solicitar acesso').count():
                return 'primeiro_acesso'
            pagina.wait_for_timeout(300)
        return 'entrada' if pagina.locator('.btn-google').count() else 'outra'

    def _entrar(self, pagina, conta):
        console = []
        pagina.on('console', lambda m: console.append(f'{m.type}: {m.text}'))
        pagina.add_init_script(f"sessionStorage.setItem('uti_emulador_conta', {json.dumps(json.dumps(CONTAS[conta]))});")
        pagina.goto(f'{self.base}?emulador=1')
        passos = []
        for _ in range(3):
            if pagina.locator('.btn-google').count():
                pagina.click('.btn-google')
            estado = self._estado(pagina)
            passos.append(estado)
            if estado == 'painel':
                return
            if estado == 'primeiro_acesso':
                # O administrador "aprova" a conta: perfil gravado direto no simulador, pelo uid real.
                c = CONTAS[conta]
                uid = uid_no_emulador(c['email'])
                self.assertIsNotNone(uid, 'conta criada no simulador de Auth')
                gravar(f'usuarios/{uid}', {'nome': c['nome'], 'coren': '000000', 'email': c['email'], 'perfil': 'enfermeiro', 'ativo': True, 'unidades': ['uti1']})
                pagina.reload()
                pagina.wait_for_timeout(1500)
        tela = pagina.locator('body').inner_text()[:600]
        raise AssertionError(f'painel não abriu para {conta}. Passos: {passos}. Tela: {tela!r}. Console: {console[-12:]!r}')

    def _esperar(self, cond, segundos=30):
        fim = time.time() + segundos
        while time.time() < fim:
            for ev in evolucoes():
                if cond(ev):
                    return ev
            time.sleep(0.5)
        return None

    def test_wifi_instavel_e_edicao_simultanea(self):
        """Edição sem conexão sobe ao reconectar; dois aparelhos editando blocos diferentes não perdem dados"""
        p = self.pagina
        self._entrar(p, 'enf-a')
        # Admissão real (transação no Firestore).
        p.locator('.leito-livre').first.get_by_text('Admitir paciente').click()
        p.fill('input[name=registro]', 'TESTE-EMU-1')
        p.fill('input[name=dataNascimento]', '1965-02-03')
        p.fill('input[name=nome]', 'paciente ficticio emulador')
        p.fill('textarea[name=diagnosticoMedico]', 'Pneumonia (fictício)')
        p.check('input[name=alergiaSituacao][value=nega]')
        self.rodape('Admitir')
        p.wait_for_selector('.leito-ocupado', timeout=20000)
        self.abrir_evolucao(0)
        sinais = p.locator('[data-sub=sinais]')
        sinais.locator('[data-campo=fc] input').fill('80')
        sinais.locator('[data-campo=fc] input').press('Tab')
        self.assertIsNotNone(self._esperar(lambda e: e.get('dados', {}).get('sinais', {}).get('fc') == '80'), 'gravação com conexão')

        # 1) Wi-Fi cai: a edição fica no aparelho e sobe quando a conexão volta.
        self.contexto.set_offline(True)
        sinais.locator('[data-campo=fr] input').fill('22')
        sinais.locator('[data-campo=fr] input').press('Tab')
        p.wait_for_timeout(2000)
        self.assertIsNone(self._esperar(lambda e: e.get('dados', {}).get('sinais', {}).get('fr') == '22', 2), 'sem conexão, nada chega ao servidor')
        self.contexto.set_offline(False)
        self.assertIsNotNone(self._esperar(lambda e: e.get('dados', {}).get('sinais', {}).get('fr') == '22', 45), 'a edição feita sem conexão subiu ao reconectar')

        # 2) Outro aparelho edita outro bloco ao mesmo tempo.
        outro = self.navegador.new_context(viewport={'width': 1280, 'height': 800})
        try:
            q = outro.new_page()
            q.on('pageerror', lambda e: self.erros.append(str(e)))
            self._entrar(q, 'enf-b')
            q.locator('.leito-ocupado').first.locator('.leito-evolucao').click()
            q.wait_for_selector('.evo-cabecalho')
            q.wait_for_timeout(500)
            q.locator('[data-sub=respiratorio] [data-campo=suporte] select').select_option('cn')
            sinais.locator('[data-campo=pas] input').fill('130')
            sinais.locator('[data-campo=pas] input').press('Tab')
            ok = self._esperar(lambda e: e.get('dados', {}).get('sinais', {}).get('pas') == '130'
                               and e.get('dados', {}).get('respiratorio', {}).get('suporte') == 'cn'
                               and e.get('dados', {}).get('sinais', {}).get('fr') == '22', 45)
            self.assertIsNotNone(ok, 'as duas edições (e a anterior) estão no servidor')
        finally:
            outro.close()


if __name__ == '__main__':
    unittest.main()
