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

1. No GitHub: **New repository** → nome `sae-uti-liga` → **Public** → **Create repository**.
2. Na página do repositório: **Add file → Upload files**. Arraste **o conteúdo** da pasta `sae-uti-liga` (os arquivos e as pastas `css`, `js`, `assets`, `apps-script`, `docs`, `testes`, mais `index.html`, `versao.json`, `.nojekyll`, `firestore.rules`, `LICENSE`, `README.md`). O GitHub mantém as pastas → **Commit changes**.
   - O arquivo `.nojekyll` começa com ponto e pode ficar oculto no seu computador. Se não aparecer, crie no GitHub: **Add file → Create new file**, nome `.nojekyll`, conteúdo vazio.
3. **Settings → Pages** → em *Branch*, escolha `main` e a pasta `/ (root)` → **Save**.
4. Em 1 ou 2 minutos aparece o endereço: `https://SEU-USUARIO.github.io/sae-uti-liga/`.

Para ver as telas antes de terminar a configuração, abra `https://SEU-USUARIO.github.io/sae-uti-liga/?demo=1`. É o modo demonstração, com dados fictícios.

## 6. Autorizar o endereço do GitHub no login

1. Firebase → **Authentication → Configurações → Domínios autorizados → Adicionar domínio**.
2. Digite `SEU-USUARIO.github.io` (sem `https://` e sem `/sae-uti-liga`) → **Adicionar**.

## 7. Tornar-se o primeiro administrador

1. Abra o sistema (sem `?demo=1`) → **Entrar com Google** → escolha sua conta → preencha nome e Coren → **Solicitar acesso**.
   - Se aparecer "o navegador bloqueou a janela do Google", permita pop-ups para o endereço do sistema.
   - Se aparecer "este endereço ainda não foi autorizado", refaça o passo 6.
2. Vai aparecer "aguardando aprovação". Isso é esperado.
3. No Firebase: **Firestore Database → Dados → usuarios →** documento com o seu e-mail. Edite três campos:
   - `perfil` (string): `admin`
   - `ativo` (boolean): `true`
   - `unidades` (array): adicione dois itens string, `uti1` e `uti2`
4. No sistema, clique em **Verificar de novo**. Vai aparecer **Primeira configuração** → **Criar unidades e leitos**.
5. Em **Administração → Unidades e leitos**, ajuste os leitos da UTI 2 (vieram 10 por padrão).

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
   - crie os arquivos `Catalogo` e `Groq` (**+ → Script**) e cole os conteúdos correspondentes;
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

## 11. Publicar uma versão nova

Toda entrega minha diz o número da versão. Ao enviar os arquivos ao GitHub:

1. Atualize o número em **dois lugares**: `js/config.js` (`VERSAO`) e `versao.json`.
2. Em até 10 minutos, quem estiver com o sistema aberto vê o aviso "Nova versão disponível — Recarregar".

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
