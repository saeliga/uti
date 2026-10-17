# Guia de instalação — Entrega 1 (fundação)

Tudo aqui é gratuito e feito pelo navegador. Não precisa instalar nada no computador.
Siga na ordem. O tempo total é de uns 40 minutos.

Você vai precisar de:

- uma conta Google para o Firebase e o Apps Script (de preferência uma conta só do projeto da Liga, sem misturar com o Hospesc);
- sua conta do GitHub;
- uma chave nova da Groq só para a Liga (console.groq.com → API Keys → Create). Não reaproveite a chave do Hospesc;
- o pacote **restrito** `Catalogo_AppsScript_RESTRITO.zip`, que não vai para o GitHub.

---

## 1. Criar o projeto Firebase da Liga

1. Acesse **console.firebase.google.com** → **Criar um projeto**.
2. Nome: `uti-liga-sae` (ou outro). Anote o **ID do projeto** que aparece embaixo do nome, por exemplo `uti-liga-sae-1a2b3`.
3. Desative o Google Analytics (não é necessário) → **Criar projeto**.
4. Confira que o plano é **Spark (sem custo)**. Não ative o plano Blaze.

## 2. Ativar o login com Google

1. Menu **Criação → Authentication → Vamos começar**.
2. Aba **Método de login** → **Google** → ative a chave.
3. **Nome público do projeto:** `Evolução de Enfermagem — UTI Liga`. É o nome que aparece na janela do Google.
4. **E-mail de suporte do projeto:** escolha o seu → **Salvar**.

Não ative "E-mail/senha". As regras do banco e o Apps Script só aceitam contas Google com e-mail verificado.

## 3. Criar o banco Firestore e publicar as regras

1. Menu **Criação → Firestore Database → Criar banco de dados**.
2. Local: **southamerica-east1 (São Paulo)**. O local não pode ser trocado depois.
3. Escolha **Iniciar no modo de produção** → **Criar**.
4. Aba **Regras**: apague tudo, cole o conteúdo inteiro do arquivo `firestore.rules` → **Publicar**.

## 4. Registrar o aplicativo web e preencher o `config.js`

1. Engrenagem ao lado de "Visão geral do projeto" → **Configurações do projeto**.
2. Em **Seus apps**, clique no ícone **</>** (Web). Apelido: `sistema-uti`. **Não** marque Firebase Hosting → **Registrar app**.
3. Aparece um bloco `firebaseConfig`. Copie quatro valores para o arquivo `js/config.js`, no lugar de `COLE_AQUI`:

   ```js
   export const FIREBASE_CONFIG = {
     apiKey: '...',
     authDomain: '....firebaseapp.com',
     projectId: '...',
     appId: '...',
   };
   ```

Esses valores não são secretos: o Firebase precisa deles no navegador. A proteção está nas regras do passo 3.

## 5. Publicar no GitHub Pages

1. O código já está no repositório **saeliga/uti** (enviado pelo Claude). Nas próximas entregas, as mudanças chegam por *pull request*: você confere e clica em **Merge** para publicar.
2. Para editar o `js/config.js` (passos 4 e 8), abra o arquivo no GitHub → lápis → cole os valores → **Commit changes**.
3. **Settings → Pages** → em *Branch*, escolha `main` e a pasta `/ (root)` → **Save**.
4. Em 1 ou 2 minutos aparece o endereço: `https://saeliga.github.io/uti/`.

Para ver as telas antes de terminar a configuração, abra `https://saeliga.github.io/uti/?demo=1`. É o modo demonstração, com dados fictícios.

## 6. Autorizar o endereço do GitHub no login

1. Firebase → **Authentication → Configurações → Domínios autorizados → Adicionar domínio**.
2. Digite `saeliga.github.io` (sem `https://` e sem `/uti`) → **Adicionar**.

## 7. Primeiro acesso do administrador

A conta **tercio.neto@liga.org.br** está definida como administrador inicial (em `js/config.js` e em `firestore.rules`). Ela precisa ser uma conta Google, como as do Google Workspace da Liga.

1. Abra o sistema (sem `?demo=1`) → **Entrar com Google** → escolha a conta `tercio.neto@liga.org.br` → preencha nome e Coren → **Solicitar acesso**.
   - Se aparecer "o navegador bloqueou a janela do Google", permita pop-ups para o endereço do sistema.
   - Se aparecer "este endereço ainda não foi autorizado", refaça o passo 6.
2. Você entra direto como administrador. Vai aparecer **Primeira configuração** → **Criar unidades e leitos**.
3. Em **Administração → Unidades e leitos**, ajuste os leitos da UTI 2 (vieram 10 por padrão).

Para trocar o administrador inicial no futuro, mude o e-mail nos dois arquivos e publique as regras de novo. Mais simples: o administrador atual dá o perfil de administrador a outra pessoa em **Administração → Usuários**.

A partir daí, cada colega entra com a própria conta Google, preenche nome e Coren, e você aprova em **Administração → Usuários**, sem mexer no console.

## 7.1 Tablets e computadores compartilhados (importante)

Sair do sistema **não** sai da conta Google no navegador. Se a conta continuar aberta, o próximo colega vê o seu nome na lista do Google e entra com a sua conta **sem digitar senha**. O mesmo vale para o desbloqueio da tela.

Por isso:

- ao sair, o sistema pergunta: **"Sair só do sistema"** ou **"Sair do sistema e do Google"**. Em aparelho compartilhado, oriente a equipe a usar sempre a segunda opção. Ela encerra todas as contas Google daquele navegador;
- em tablet compartilhado, não use o navegador com a conta Google pessoal de ninguém sincronizada (perfil do Chrome);
- cada profissional usa a própria conta Google, que deve ter senha e, de preferência, verificação em duas etapas;
- inclua essas três regras no treinamento por turno.

## 8. Instalar o Apps Script exclusivo da Liga

1. Acesse **script.google.com** → **Novo projeto**. Renomeie para `SAE UTI Liga — ponte`.
2. **Configurações do projeto** (engrenagem) → marque **Mostrar arquivo de manifesto "appsscript.json"**.
3. Volte ao **Editor**:
   - abra `appsscript.json`, apague tudo e cole o conteúdo de `apps-script/appsscript.json`;
   - renomeie `Código.gs` para `Codigo` e cole o conteúdo de `apps-script/Codigo.gs`;
   - crie os arquivos `Catalogo`, `Groq` e `SAE` (**+ → Script**) e cole os conteúdos correspondentes;
   - do pacote restrito, crie um arquivo para cada `Dados_*.gs`, com o mesmo nome sem o `.gs`, e cole cada conteúdo. São seis: `Dados_Indice`, `Dados_nanda_1`, `Dados_noc_1`, `Dados_nic_1`, `Dados_nic_2` e `Dados_ligacoes_1`. Os de dados são uma linha enorme de letras: é o catálogo comprimido, e é assim mesmo.
4. **Configurações do projeto → Propriedades do script → Adicionar propriedade**:
   - `FIREBASE_PROJECT_ID` = o ID do passo 1;
   - `GROQ_API_KEY` = a chave nova da Groq;
   - (opcional) `GROQ_MODELO` e `GROQ_MODELO_RESERVA`, se quiser trocar os modelos. O padrão é o mesmo do piloto (`qwen/qwen3.8-27b` e `openai/gpt-oss-20b`). Confira na conta da Groq se os dois continuam disponíveis.
5. No editor, escolha a função **testarInstalacao** → **Executar** → autorize com a conta do projeto. Em **Registro de execução** deve aparecer "configurada" nas duas propriedades e a versão dos catálogos.
6. **Implantar → Nova implantação** → tipo **App da Web**:
   - Executar como: **Eu**;
   - Quem pode acessar: **Qualquer pessoa**.

   É "qualquer pessoa" porque o navegador chama o script sem login do Google. A proteção é o token do Firebase, conferido em toda chamada.
7. Copie a **URL do app da Web** (termina em `/exec`) e cole em `js/config.js`, em `APPS_SCRIPT_URL`.
8. Envie o `config.js` atualizado ao GitHub (abra o arquivo no GitHub → lápis → cole → **Commit changes**).

**Atualizar o Apps Script depois:** edite os arquivos e vá em **Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar**. A URL continua a mesma. Não use "Nova implantação" de novo, senão a URL muda.

## 9. Conferir que tudo conversa

No sistema: **Administração → Conexão com o Apps Script**.

- **Testar login:** deve mostrar seu e-mail e o perfil `admin`.
- **Testar catálogos:** deve mostrar NANDA-I 13ª, NOC 6ª, NIC 7ª e ligações 1.0.
- **Testar Groq:** deve responder "OK" com o nome do modelo.

## 10. Testar as regras de segurança (recomendado)

Firestore → **Regras → Playground de regras**. Simule as situações abaixo. Em **Autenticado**, escolha o provedor **google.com**, marque e-mail verificado e use o UID de um usuário, que aparece em Authentication → Usuários.

| Simulação | Resultado esperado |
|---|---|
| `get` em `usuarios/SEU_UID` com provedor **password** (em "Provedor" no simulador) | Negado (só Google) |
| `get` em `usuarios/OUTRO_UID`, autenticado como enfermeiro | Negado |
| `update` em `usuarios/SEU_UID` mudando `perfil` para `admin`, autenticado como você mesmo (não admin) | Negado |
| `get` em `leitos/uti1_01` sem autenticação | Negado |
| `get` em `leitos/uti1_01` como enfermeiro com `unidades: ['uti1']` | Permitido |
| `get` em `leitos/uti2_01` como enfermeiro só da `uti1` | Negado |
| `delete` em qualquer `internacoes/...` | Negado |
| `create` em `auditoria/x` com `por` diferente do seu UID | Negado |

Faça também o teste prático: crie um segundo usuário de teste, aprove só para a UTI 1 e confirme que a aba UTI 2 não aparece.

## 11. Ao publicar a versão 0.2.0 (evolução)

Esta versão traz regras novas para as evoluções. **Antes do merge**, publique o `firestore.rules` atualizado (Firestore → Regras → colar → Publicar), do mesmo jeito do passo 3. Sem isso, abrir uma evolução dá "sem permissão".

Como funciona a evolução:

- **Abrir:** no painel, cada leito ocupado mostra a situação da evolução do dia. Toque na faixa de baixo do cartão para abrir.
- **Uma evolução por dia (desde a 0.2.1):** o dia vai das 07h às 07h. Qualquer turno pode fazer a evolução; o painel mostra quantas ainda faltam (ex.: se a manhã fez 6 de 10, a tarde vê 4 pendentes). É o mesmo rascunho no tablet e no PC.
- **Salvamento:** é automático a cada campo. Sem Wi-Fi, aparece "Salvo neste aparelho · ainda não sincronizado", e o envio acontece sozinho quando a conexão volta. Só a abertura de uma evolução nova e a retificação precisam de conexão.
- **Evolução anterior:** aparece em cada subbloco. Para reaproveitar, use "Sem alteração desde a evolução anterior". Sinais vitais e dor sempre pedem valores novos.
- **Braden e Morse** não ficam no sistema: são preenchidos e acompanhados no PEP oficial.
- **Medidas preventivas** (LPP, queda, PAV, infecção urinária e de corrente sanguínea) não ficam na evolução: entram como intervenções do Processo de Enfermagem, na prescrição de enfermagem, com checagem.
- **Infusões contínuas:** subbloco próprio com os atalhos da folha atual (hidratação venosa, midazolam, fentanil, SG 10%, insulina, amiodarona, noradrenalina, dobutamina, dopamina, nitroprussiato, nitroglicerina) e "+ Outra infusão" para qualquer outro medicamento. Registra só o medicamento e a vazão (mL/h).
- **No fim de cada bloco** há o botão "Próximo" para seguir sem voltar ao topo.
- **Neurológico:** RASS (com meta e interrupção diária) só aparece quando o nível de consciência é "Sob sedação"; nos demais, aparece o Glasgow. Pupilas: isocóricas, anisocóricas ou puntiformes. O rastreio de delirium vale também para o paciente sem sedação (alerta ou sonolento).
- **Sem bloco de identificação e contexto:** limitação de suporte e objetivo de cuidado ficam no início da avaliação. O peso (opcional) fica em Renal, para o débito urinário.
- **Isolamento:** toque na etiqueta de precaução no topo da evolução para alterar o tipo e o motivo. A mudança vale para a internação e aparece no painel.
- **Ao publicar a 0.2.1**, publique de novo o `firestore.rules` (a identificação da evolução mudou de turno para dia).
- **Finalizar e copiar ao PEP:** finalize a evolução, use "Copiar para o PEP" e, depois de colar no PEP, marque "Já colei no PEP". Se precisar corrigir uma evolução finalizada, use "Retificar". A versão anterior fica guardada.

## 11.1 Ao publicar a versão 0.3.0 (Processo de Enfermagem)

**Antes do merge**, atualize o Apps Script (não precisa mexer nas regras do Firestore):

1. No editor do Apps Script, crie o arquivo `SAE` (**+ → Script**) e cole o conteúdo de `apps-script/SAE.gs`.
2. Abra `Codigo` e cole de novo o conteúdo de `apps-script/Codigo.gs` (ganhou a ação `ia.sugerirSAE`).
3. **Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar.** A URL continua a mesma.

Como funciona o Processo de Enfermagem (aba "3 a 5" da evolução):

- **Sugerir PE com IA:** envia à IA um resumo da avaliação **sem nome, registro, data de nascimento nem leito** (a narrativa e as pendências, que são texto livre, também ficam de fora). Leva até 1 a 2 minutos; dá para continuar a evolução enquanto isso. Quando chega, o sistema pergunta: **Revisar agora** ou **Deixar para depois** (o painel mostra "PE pendente").
- **A IA só sugere:** escolhe diagnósticos da lista com ligações aprovadas e marca evidências pelos itens oficiais. Nada entra no plano sem o enfermeiro tocar em **Aceitar**, **Revisar evidências e aceitar** ou **Descartar**. O sistema guarda se cada diagnóstico veio da IA sem edição, da IA com edição ou do enfermeiro (dado para a pesquisa).
- **Biblioteca NANDA-I:** busca por título ou código. Diagnósticos sem NOC/NIC na tabela de ligações aparecem, mas não podem ser escolhidos.
- **Evidências:** mínimo de 1 característica definidora e 1 fator relacionado (foco no problema) ou 1 fator de risco (risco). Diagnóstico de risco não aceita característica definidora.
- **Resultados e intervenções por padrão (desde a 0.3.1):** ao entrar no plano, o diagnóstico já traz o NOC principal da tabela de ligações, com os indicadores sugeridos, e a NIC principal, com 3 a 6 atividades escolhidas pela IA entre as oficiais (marcadas com a etiqueta "IA"). O enfermeiro só ajusta: retira, acrescenta os complementares ou troca atividades. Se a IA não responder, a lista de atividades fica para escolher à mão.
- **NOC e NIC:** só os ligados ao diagnóstico. Os indicadores sugeridos pela tabela vêm marcados. Cada indicador recebe meta e a pontuação de hoje (1 a 5 ou "não avaliado"); cada atividade recebe Realizado, Não realizado (com justificativa) ou Não se aplica.
- **Dia seguinte:** os diagnósticos ativos passam para a evolução do dia seguinte com os mesmos NOC/NIC. É preciso confirmar cada um ("Continua ativo" ou "Resolvido") e pontuar de novo; a pontuação de ontem aparece como "anterior".
- **Concluir PE** confere tudo. A evolução só pode ser finalizada com o PE concluído, e o texto do PE entra no "Copiar para o PEP" logo depois da avaliação.
- **Sem internet:** a sugestão da IA e a biblioteca precisam de conexão; o restante da evolução continua salvando no aparelho.

**Ao publicar a 0.3.1:** cole de novo `SAE.gs` e `Codigo.gs` no Apps Script (nova ação `ia.sugerirAtividades`) e publique **Nova versão** em Gerenciar implantações, antes do merge.

## 12. Publicar uma versão nova

As entregas chegam por pull request já com o número da versão atualizado. O Claude roda `node ferramentas/versao.mjs X.Y.Z`, que atualiza o número em `js/config.js` e `versao.json` e o mapa de importação do `index.html`.

- **Para que serve o mapa:** cada versão baixa o próprio conjunto de arquivos. Sem ele, o navegador misturava arquivos novos com antigos guardados no cache, e o sistema ficava parado em "Carregando…".
- **Depois do merge:** em até 10 minutos, quem estiver com o sistema aberto vê o aviso "Nova versão disponível — Recarregar".
- **Se ainda assim parar em "Carregando…":** depois de 12 segundos aparece um botão **Recarregar**, que busca a versão nova.
- **Se você mesmo editar um arquivo no GitHub,** por exemplo o `config.js`, o navegador pode levar até 10 minutos para pegar a mudança.

## Limites do plano gratuito (para acompanhar)

- **Firestore:** cerca de 50 mil leituras e 20 mil gravações por dia. Acompanhe em Firestore → Uso.
- **Apps Script:** cota diária de chamadas externas por conta. Acompanhe em script.google.com → Execuções.
- **Groq:** limites por minuto e por dia da sua conta. Acompanhe em console.groq.com.

## O que fica fora do GitHub

| Item | Onde fica |
|---|---|
| Catálogos NANDA-I, NOC e NIC e ligações | Apenas no Apps Script (arquivos `Dados_*`) |
| Chave da Groq | Apenas nas Propriedades do script |
| Dados de pacientes | Apenas no Firestore |
