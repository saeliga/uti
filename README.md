# Sistema de Evolução e Processo de Enfermagem — UTI 1 e 2

Sistema web para os enfermeiros das UTI 1 e 2 da Liga Contra o Câncer (Natal/RN), desenvolvido no mestrado em Enfermagem da UFRN.

- **Versão atual:** 0.2.0, Entrega 2 (evolução): blocos 1, 2 e 6 da evolução por turno, com escalas calculadas, rascunho salvo também sem Wi-Fi, finalização com retificação, "Copiar para o PEP" e impressão. Inclui a Entrega 1 (login Google com aprovação, painel de leitos, internação, administração).
- **Próximas entregas:** Processo de Enfermagem com IA (blocos 3 a 5), prescrição de enfermagem impressa, folha de balanço hídrico, checklists e, ao final, exportador de casos anonimizados para a pesquisa.

## Como funciona

| Parte | Tecnologia | Custo |
|---|---|---|
| Telas | HTML, CSS e JavaScript em módulos, sem compilação | — |
| Hospedagem | GitHub Pages | Gratuito |
| Login e banco | Firebase Authentication (Google) + Firestore, com cache offline | Plano Spark (gratuito) |
| Catálogos NANDA-I/NOC/NIC e IA | Apps Script exclusivo, ponte para a Groq | Gratuito |

- O navegador nunca recebe o catálogo inteiro: o Apps Script entrega só o item consultado.
- Toda chamada ao Apps Script leva o token do Firebase, que é conferido no servidor.

## Estrutura

```text
index.html            página única
versao.json           número da versão publicada (aviso de atualização)
firestore.rules       regras de segurança do banco (colar no console)
css/                  identidade visual da Liga e estilos
assets/               logotipo e fontes da Liga (não cobertos pela licença MIT)
js/config.js          ÚNICO arquivo que muda entre instalações
js/main.js            entrada e navegação
js/nucleo/            interface, sessão, bloqueio por inatividade, aviso de versão
js/dados/             acesso ao Firebase e modo demonstração
js/api/               Apps Script e catálogos sob demanda
js/regras/            regras clínicas puras (datas, escalas, cálculos, turnos, esquema e texto da evolução), testáveis
js/modulos/           painel de leitos, internação, evolução, administração
apps-script/          código do Apps Script (sem os catálogos)
testes/               testes automáticos (opcional; precisa de Node 20+)
docs/                 guia de instalação
```

## Modo demonstração

Abra o endereço com `?demo=1` no final. São dados fictícios em memória: nada é salvo, e ao recarregar tudo volta ao início. Serve para conhecer as telas e treinar a equipe.

## Instalação

Veja [docs/GUIA_INSTALACAO.md](docs/GUIA_INSTALACAO.md).

## Testes (opcional)

```bash
node --test testes/*.test.mjs
```

## Direitos e dados

- Código sob licença MIT.
- O logotipo e as fontes pertencem à Liga e aos fabricantes.
- As taxonomias NANDA-I, NOC e NIC são protegidas por direitos autorais e **não** estão neste repositório.
- Nunca use dados reais de pacientes em testes ou demonstrações.
