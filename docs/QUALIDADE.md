# Avaliação técnica automatizada (ISO/IEC 25010:2023)

A cada pull request e a cada mudança no `main`, o GitHub Actions (workflow **Qualidade (ISO/IEC 25010)**) mede características selecionadas da ISO/IEC 25010:2023 e gera um relatório com a tabela característica → métrica → valor → critério → situação.

- **Onde ver:** na aba *Actions*, abra a execução e veja o *Summary* (o relatório aparece no fim da página). O arquivo também fica como artefato `relatorio-qualidade`.
- **Histórico por versão:** a cada mudança no `main`, o relatório é guardado no ramo `qualidade`, em `relatorios/vX.Y.Z.md` (e `relatorios/ultimo.md`). Para a dissertação, cite o relatório da versão congelada usada na Fase 4.
- **Dados:** todos os testes usam dados fictícios: o modo demonstração ou os simuladores oficiais do Firebase. Nenhum dado real é lido.

## O que é medido

| Característica | Métrica | Critério | Ferramenta | Arquivo |
| --- | --- | --- | --- | --- |
| Adequação funcional | Testes unitários e casos de uso aprovados | 100% | Node (`node --test`) e Playwright | `testes/`, `testes-e2e/test_funcional.py` |
| Adequação funcional | Cobertura de linhas das regras clínicas (`js/regras`) | ≥ 80% | cobertura do Node | — |
| Segurança da informação | Testes das regras de acesso no simulador | 100% | simulador do Firestore | `testes-regras/` |
| Segurança da informação | Alertas da varredura do site publicado | nenhum alto | OWASP ZAP (linha de base) | job `zap` |
| Segurança operacional | Falha da IA sem bloquear o trabalho; códigos inventados descartados | 100% | Playwright e testes do Apps Script | `test_seguranca_operacional.py`, `testes/appsscript.test.mjs` |
| Confiabilidade | Nenhuma perda de registro com Wi-Fi instável e dois aparelhos | 100% | Playwright + simuladores do Firebase | `test_confiabilidade.py` |
| Confiabilidade | Disponibilidade do site nos últimos 30 dias | ≥ 99% | verificação de hora em hora | `.github/workflows/disponibilidade.yml` |
| Eficiência de desempenho | Pontuação de desempenho e LCP (computador e celular) | ≥ 0,80; ≤ 2,5 s | Lighthouse CI | `lighthouserc-*.json` |
| Capacidade de interação | Violações WCAG 2.1 A/AA graves ou críticas | nenhuma | axe-core | `test_acessibilidade.py` |
| Capacidade de interação | Pontuação de acessibilidade (celular) | ≥ 0,90 | Lighthouse CI | — |
| Manutenibilidade | Erros de análise estática | 0 | ESLint | `eslint.config.mjs` |
| Manutenibilidade | Código duplicado | ≤ 3% | jscpd | `.jscpd.json` |
| Flexibilidade | Casos de uso em Chromium, Firefox e WebKit; computador e tablet | todas as combinações | Playwright | matriz do job `e2e` |
| Compatibilidade | Cópia ao PEP (HTML e texto simples) e impressos | 100% | Playwright | `test_compatibilidade.py` |

Fora da automação (registrados no relatório como informativos): usabilidade percebida (System Usability Scale, Fase 5 da pesquisa) e colagem no PEP real da instituição (conferência manual documentada).

## Rodar no computador

```bash
npm install                      # ferramentas de teste (uma vez)
pip install playwright && python -m playwright install chromium
npm run test:cobertura           # unitários + cobertura
npm run test:regras              # regras do Firestore (precisa de Java)
npm run test:confiabilidade      # app + simuladores do Firebase (precisa de Java)
npm run test:e2e                 # casos de uso (NAVEGADOR=firefox|webkit, PERFIL=tablet)
npm run relatorio                # gera resultados/relatorio.md
```

## Modos de teste no app

- `?demo=1&falhaia=erro` ou `?demo=1&falhaia=tempo`: simula a IA falhando no modo demonstração.
- `?emulador=1`: liga o app aos simuladores do Firebase (Auth na porta 9099, Firestore na 8080). Só funciona em `localhost`/`127.0.0.1`; no site publicado é ignorado.

## SonarCloud (opcional)

1. Entre em [sonarcloud.io](https://sonarcloud.io) com a conta do GitHub e importe o repositório `saeliga/uti` (plano gratuito para repositório público).
2. Em *My Account → Security*, gere um token.
3. No GitHub: *Settings → Secrets and variables → Actions → New repository secret*, nome `SONAR_TOKEN`.
Sem o segredo, o CI pula esta etapa.

## Coleta da pesquisa (versão congelada)

No Apps Script, em *Configurações do projeto → Propriedades do script*, crie `GROQ_SEM_RESERVA` = `sim`. Assim todas as sugestões avaliadas vêm do mesmo modelo (sem troca automática para o modelo de reserva). Defina também `GROQ_MODELO` com o modelo escolhido e registre a versão do prompt.
