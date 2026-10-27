# Relatório de qualidade — versão 0.12.3

Gerado automaticamente em 26/10/2026, 23:52:22 (commit 593c8c6), segundo características selecionadas da ISO/IEC 25010:2023. Dados fictícios em todos os testes.

**22 de 22 critérios avaliados atendidos.**

| Característica | Métrica | Valor | Critério | Situação |
| --- | --- | --- | --- | --- |
| Adequação funcional | Testes unitários e casos de uso ponta a ponta aprovados | 115/115 | 100% | Atende |
| Adequação funcional | Cobertura de linhas das regras clínicas (js/regras) | 98,1% | ≥ 80% | Atende |
| Segurança da informação | Testes das regras de acesso no simulador do Firestore | 16/16 | 100% | Atende |
| Segurança da informação | Varredura OWASP ZAP do site publicado (alertas alto/médio/baixo) | 0/6/5 | nenhum alerta alto | Atende |
| Segurança operacional | Falha da IA (resposta inválida, demora, sem internet) sem bloquear o trabalho | 15/15 | 100% | Atende |
| Segurança operacional | Códigos inexistentes devolvidos pela IA são descartados no servidor | ver testes unitários | nenhum item inventado | Atende |
| Confiabilidade | Sem perda de registro: Wi-Fi instável e dois aparelhos ao mesmo tempo (simuladores do Firebase) | 1/1 | 100% | Atende |
| Confiabilidade | Disponibilidade do site nos últimos 30 dias (37 verificações) | 100,00% | ≥ 99% | Atende |
| Eficiência de desempenho | Pontuação de desempenho do Lighthouse (desktop) | 1,00 | ≥ 0,80 | Atende |
| Eficiência de desempenho | Maior elemento visível carregado, LCP (desktop) | 0,58 s | ≤ 2,5 s | Atende |
| Eficiência de desempenho | Pontuação de desempenho do Lighthouse (celular) | 0,95 | ≥ 0,80 | Atende |
| Eficiência de desempenho | Maior elemento visível carregado, LCP (celular) | 2,41 s | ≤ 2,5 s | Atende |
| Capacidade de interação | Violações WCAG 2.1 A/AA (axe-core) nas telas principais — graves/críticas | 0 (total de regras violadas: 0) | nenhuma grave ou crítica | Atende |
| Capacidade de interação | Pontuação de acessibilidade do Lighthouse (celular) | 1,00 | ≥ 0,90 | Atende |
| Capacidade de interação | Usabilidade percebida (System Usability Scale) | Fase 5 da pesquisa | — | Informativo |
| Manutenibilidade | Análise estática (ESLint): erros | 0 | 0 | Atende |
| Manutenibilidade | Funções com complexidade ciclomática acima de 20 | 19 | informativo | Informativo |
| Manutenibilidade | Código duplicado (jscpd) | 0,06% | ≤ 3% | Atende |
| Manutenibilidade | Nota de manutenibilidade (SonarCloud) | A (3 code smells) | A | Atende |
| Segurança da informação | Nota de segurança do código (SonarCloud) | A (0 vulnerabilidades, 0 pontos a revisar) | A | Atende |
| Confiabilidade | Nota de confiabilidade do código (SonarCloud) | A (0 bugs) | A | Atende |
| Flexibilidade | Casos de uso aprovados por navegador e tipo de tela | chromium/desktop ✓ · chromium/tablet ✓ · firefox/desktop ✓ · webkit/desktop ✓ · webkit/tablet ✓ | todas as combinações | Atende |
| Flexibilidade | Implantação das regras de acesso num projeto vazio (simulador) | ver testes das regras | sem erro | Atende |
| Compatibilidade | Cópia para o PEP (com e sem formatação) e impressos | 4/4 | 100% | Atende |
| Compatibilidade | Colagem no PEP real da instituição | conferência manual | documentada | Informativo |

## Casos de uso ponta a ponta

| Teste | Navegador/tela | Situação | Tempo (s) |
| --- | --- | --- | --- |
| Telas principais sem violações WCAG 2.1 A/AA (registro) | chromium/desktop | aprovado | 5,3 |
| Copiar para o PEP põe HTML (títulos em negrito) e texto simples na área de transferência | chromium/desktop | aprovado | 2,9 |
| Imprimir a evolução e a prescrição de enfermagem gera as folhas | chromium/desktop | aprovado | 5,0 |
| Edição sem conexão sobe ao reconectar; dois aparelhos editando blocos diferentes não perdem dados | chromium/desktop | pulado | 0,0 |
| Entrar e ver o painel de leitos das duas UTI | chromium/desktop | aprovado | 1,6 |
| Admitir paciente em leito livre, com validação dos campos obrigatórios | chromium/desktop | aprovado | 1,8 |
| Preencher sinais vitais na evolução e gravar | chromium/desktop | aprovado | 4,8 |
| Campos numéricos (sinais vitais) não aceitam letras | chromium/desktop | aprovado | 2,2 |
| Pedir sugestão do PE à IA, aceitar e descartar sugestões | chromium/desktop | aprovado | 5,6 |
| Ver o texto da evolução finalizada para copiar ao PEP (formato SBAR) | chromium/desktop | aprovado | 2,4 |
| Registrar alta e desfazer a saída registrada por engano | chromium/desktop | aprovado | 2,5 |
| Trocar o paciente de leito | chromium/desktop | aprovado | 2,3 |
| Gerar os impressos da unidade (capa, ocorrências, balanço hídrico) | chromium/desktop | aprovado | 8,7 |
| IA responde fora do formato: aviso, sem sugestão, PE manual e evolução seguem | chromium/desktop | aprovado | 8,9 |
| IA não responde (tempo esgotado): aviso, sem sugestão, PE manual e evolução seguem | chromium/desktop | aprovado | 10,9 |
| Sem internet, o pedido à IA é recusado com aviso e a tela continua utilizável | chromium/desktop | aprovado | 2,5 |
| Telas principais sem violações WCAG 2.1 A/AA (registro) | chromium/tablet | aprovado | 5,1 |
| Copiar para o PEP põe HTML (títulos em negrito) e texto simples na área de transferência | chromium/tablet | aprovado | 2,9 |
| Imprimir a evolução e a prescrição de enfermagem gera as folhas | chromium/tablet | aprovado | 5,0 |
| Edição sem conexão sobe ao reconectar; dois aparelhos editando blocos diferentes não perdem dados | chromium/tablet | pulado | 0,0 |
| Entrar e ver o painel de leitos das duas UTI | chromium/tablet | aprovado | 1,6 |
| Admitir paciente em leito livre, com validação dos campos obrigatórios | chromium/tablet | aprovado | 1,8 |
| Preencher sinais vitais na evolução e gravar | chromium/tablet | aprovado | 4,8 |
| Campos numéricos (sinais vitais) não aceitam letras | chromium/tablet | aprovado | 2,2 |
| Pedir sugestão do PE à IA, aceitar e descartar sugestões | chromium/tablet | aprovado | 6,4 |
| Ver o texto da evolução finalizada para copiar ao PEP (formato SBAR) | chromium/tablet | aprovado | 2,3 |
| Registrar alta e desfazer a saída registrada por engano | chromium/tablet | aprovado | 2,5 |
| Trocar o paciente de leito | chromium/tablet | aprovado | 2,3 |
| Gerar os impressos da unidade (capa, ocorrências, balanço hídrico) | chromium/tablet | aprovado | 8,6 |
| IA responde fora do formato: aviso, sem sugestão, PE manual e evolução seguem | chromium/tablet | aprovado | 8,9 |
| IA não responde (tempo esgotado): aviso, sem sugestão, PE manual e evolução seguem | chromium/tablet | aprovado | 10,8 |
| Sem internet, o pedido à IA é recusado com aviso e a tela continua utilizável | chromium/tablet | aprovado | 2,5 |
| Telas principais sem violações WCAG 2.1 A/AA (registro) | firefox/desktop | aprovado | 8,1 |
| TrocaDeInformacao) | firefox/desktop | pulado | 0,0 |
| Edição sem conexão sobe ao reconectar; dois aparelhos editando blocos diferentes não perdem dados | firefox/desktop | pulado | 0,0 |
| Entrar e ver o painel de leitos das duas UTI | firefox/desktop | aprovado | 4,3 |
| Admitir paciente em leito livre, com validação dos campos obrigatórios | firefox/desktop | aprovado | 2,2 |
| Preencher sinais vitais na evolução e gravar | firefox/desktop | aprovado | 5,2 |
| Campos numéricos (sinais vitais) não aceitam letras | firefox/desktop | aprovado | 2,6 |
| Pedir sugestão do PE à IA, aceitar e descartar sugestões | firefox/desktop | aprovado | 6,4 |
| Ver o texto da evolução finalizada para copiar ao PEP (formato SBAR) | firefox/desktop | aprovado | 2,6 |
| Registrar alta e desfazer a saída registrada por engano | firefox/desktop | aprovado | 3,0 |
| Trocar o paciente de leito | firefox/desktop | aprovado | 2,6 |
| Gerar os impressos da unidade (capa, ocorrências, balanço hídrico) | firefox/desktop | aprovado | 9,1 |
| IA responde fora do formato: aviso, sem sugestão, PE manual e evolução seguem | firefox/desktop | aprovado | 9,5 |
| IA não responde (tempo esgotado): aviso, sem sugestão, PE manual e evolução seguem | firefox/desktop | aprovado | 11,1 |
| Sem internet, o pedido à IA é recusado com aviso e a tela continua utilizável | firefox/desktop | aprovado | 3,0 |
| Telas principais sem violações WCAG 2.1 A/AA (registro) | webkit/desktop | aprovado | 13,4 |
| TrocaDeInformacao) | webkit/desktop | pulado | 0,0 |
| Edição sem conexão sobe ao reconectar; dois aparelhos editando blocos diferentes não perdem dados | webkit/desktop | pulado | 0,0 |
| Entrar e ver o painel de leitos das duas UTI | webkit/desktop | aprovado | 2,2 |
| Admitir paciente em leito livre, com validação dos campos obrigatórios | webkit/desktop | aprovado | 2,8 |
| Preencher sinais vitais na evolução e gravar | webkit/desktop | aprovado | 5,5 |
| Campos numéricos (sinais vitais) não aceitam letras | webkit/desktop | aprovado | 2,8 |
| Pedir sugestão do PE à IA, aceitar e descartar sugestões | webkit/desktop | aprovado | 6,1 |
| Ver o texto da evolução finalizada para copiar ao PEP (formato SBAR) | webkit/desktop | aprovado | 2,8 |
| Registrar alta e desfazer a saída registrada por engano | webkit/desktop | aprovado | 3,4 |
| Trocar o paciente de leito | webkit/desktop | aprovado | 2,9 |
| Gerar os impressos da unidade (capa, ocorrências, balanço hídrico) | webkit/desktop | aprovado | 9,3 |
| IA responde fora do formato: aviso, sem sugestão, PE manual e evolução seguem | webkit/desktop | aprovado | 9,2 |
| IA não responde (tempo esgotado): aviso, sem sugestão, PE manual e evolução seguem | webkit/desktop | aprovado | 11,1 |
| Sem internet, o pedido à IA é recusado com aviso e a tela continua utilizável | webkit/desktop | aprovado | 3,2 |
| Telas principais sem violações WCAG 2.1 A/AA (registro) | webkit/tablet | aprovado | 13,6 |
| TrocaDeInformacao) | webkit/tablet | pulado | 0,0 |
| Edição sem conexão sobe ao reconectar; dois aparelhos editando blocos diferentes não perdem dados | webkit/tablet | pulado | 0,0 |
| Entrar e ver o painel de leitos das duas UTI | webkit/tablet | aprovado | 2,2 |
| Admitir paciente em leito livre, com validação dos campos obrigatórios | webkit/tablet | aprovado | 2,7 |
| Preencher sinais vitais na evolução e gravar | webkit/tablet | aprovado | 5,5 |
| Campos numéricos (sinais vitais) não aceitam letras | webkit/tablet | aprovado | 2,9 |
| Pedir sugestão do PE à IA, aceitar e descartar sugestões | webkit/tablet | aprovado | 6,3 |
| Ver o texto da evolução finalizada para copiar ao PEP (formato SBAR) | webkit/tablet | aprovado | 2,7 |
| Registrar alta e desfazer a saída registrada por engano | webkit/tablet | aprovado | 3,5 |
| Trocar o paciente de leito | webkit/tablet | aprovado | 3,0 |
| Gerar os impressos da unidade (capa, ocorrências, balanço hídrico) | webkit/tablet | aprovado | 9,3 |
| IA responde fora do formato: aviso, sem sugestão, PE manual e evolução seguem | webkit/tablet | aprovado | 9,2 |
| IA não responde (tempo esgotado): aviso, sem sugestão, PE manual e evolução seguem | webkit/tablet | aprovado | 11,7 |
| Sem internet, o pedido à IA é recusado com aviso e a tela continua utilizável | webkit/tablet | aprovado | 3,2 |

## Varredura OWASP ZAP

- [Médio] CSP: Failure to Define Directive with No Fallback (3)
- [Médio] CSP: style-src unsafe-inline (3)
- [Médio] Content Security Policy (CSP) Header Not Set (2)
- [Médio] Cross-Domain Misconfiguration (5)
- [Médio] Missing Anti-clickjacking Header (2)
- [Médio] Sub Resource Integrity Attribute Missing (4)
- [Baixo] Cross-Origin-Embedder-Policy Header Missing or Invalid (2)
- [Baixo] Cross-Origin-Opener-Policy Header Missing or Invalid (2)
- [Baixo] Permissions Policy Header Not Set (5)
- [Baixo] Strict-Transport-Security Header Not Set (3)
- [Baixo] X-Content-Type-Options Header Missing (5)
- [Info] Information Disclosure - Suspicious Comments (1)
- [Info] Modern Web Application (2)
- [Info] Re-examine Cache-control Directives (2)
- [Info] Retrieved from Cache (8)
- [Info] Storable and Cacheable Content (5)

## Lighthouse (desktop)

- LCP 582 ms; FCP 510 ms

## Lighthouse (celular)

- LCP 2409 ms; FCP 2259 ms

## Acessibilidade (axe-core)

Nenhuma violação.

## Análise estática (ESLint)

0 erro(s), 27 aviso(s).

- **complexity** (19): js/api/demo-servidor.js:45, js/dados/firebase.js:383, js/modulos/evolucao/dispositivos.js:153, js/modulos/evolucao/evolucao.js:61, js/modulos/evolucao/evolucao.js:388…
- **no-unused-vars** (8): js/dados/demo.js:439, js/dados/firebase.js:573, js/dados/firebase.js:573, js/dados/firebase.js:573, js/dados/firebase.js:573…
