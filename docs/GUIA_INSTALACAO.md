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

## 11.2 Versão 0.4.0 (ajustes do exame físico, dispositivos e herança)

Não precisa mexer no Apps Script nem nas regras do Firestore.

- **Dor:** sem EVA (fica EVN, BPS ou não avaliável).
- **Respiratório:** ausculta em caixas de marcar; com MV diminuídos ou abolidos, abre a escolha dos locais (ápices, terços médios, bases, difusamente). Sem pressão do cuff (avaliada pela fisioterapia).
- **Cardiovascular e hemodinâmica:** ausculta cardíaca de marcar (BNF em 2T, hipofonéticas, arrítmicas, sopro, bulhas acessórias) e edema (sem edema, MMII, MMSS, sacral, facial, anasarca) com grau de +1 a +4.
- **Abdome:** subbloco próprio logo após a hemodinâmica: inspeção, palpação e percussão de marcar, RHA e ascite.
- **Evacuação:** pergunta se evacuou nas últimas 24 horas; se sim, número de episódios, escala de Bristol e aspecto. Se não, mostra a data da última evacuação registrada no sistema e há quantos dias.
- **Estomias:** lista com tipo (colostomia, ileostomia, jejunostomia, gastrostomia, outra); dá para registrar mais de uma.
- **Infusões:** por finalidade — hidratação venosa (solução + vazão), outras infusões, DVA e sedoanalgesia. Marque o medicamento e informe a vazão. Nomes pelo princípio ativo, em caixa alta e sem edição; "+ Outra" inclui outro medicamento.
- **Hemodiálise:** ao marcar, abre UF, duração, heparina e intercorrências.
- **Pele, lesões e LPP:** inspeção em caixas de marcar (normocorada/hipocorada, acianótica/cianótica, anictérica/ictérica, hidratada/desidratada, íntegra/não íntegra); estágio da LPP em lista.
- **Dispositivos:** modal por tipo, como no piloto do Hospital dos Pescadores — localização em lista, lado, lúmens, calibre, número, fixação, data de inserção, se foi implantado na UTI e curativo. No cartão de cada dispositivo: avaliação do sítio do dia, débito (drenos) e "ainda é necessário?". Botões para "Curativo trocado hoje", "Retirar" (fica registrado no dia e não passa para o seguinte) e apagar lançamento feito por engano. Alertas: AVP com 96 h ou mais, curativo vencido (filme: 7 dias; gaze: 1 dia) e sítio com alteração.
- **Herança automática:** ao abrir o dia, já vêm preenchidos da evolução anterior a limitação de suporte e o objetivo de cuidado, pele e lesões, dispositivos ativos, antimicrobianos e culturas, e o plano do Processo de Enfermagem. Esses subblocos mostram "Herdado de dd/mm · confira": altere o que mudou ou toque em "Conferido, sem alteração".
- **Evolução da admissão:** no topo da evolução, o botão "Evolução da admissão" abre a primeira evolução da internação para consulta.

## 11.3 Versão 0.5.0 (impressos da UTI)

**Antes do merge**, publique o `firestore.rules` atualizado (Firestore → Regras → colar → Publicar). Ele traz a coleção nova `checklistsIras`. Sem isso, o check-list de IRAS dá "sem permissão" ao salvar.

No painel de leitos, a barra **Impressos** tem:

- **Capa da ocorrência:** a capa dos enfermeiros da UTI, já com o nome da unidade, a data e o dia da semana.
- **Ocorrências (transição):** uma folha por leito no modelo da planilha atual. Já vêm preenchidos: identificação, DIH, DUTI e dias de UTI, alergias, isolamento, equipe médica, lesões, dispositivos (data e localização), controle de infusão com as vazões, antimicrobianos com o dia, dieta, eliminações, drenos e curativos. O restante é preenchido à mão, como hoje. Os dados vêm da evolução mais recente (para cada parte, a mais nova que tem registro).
- **Balanço hídrico:** a "folha de cuidados" (frente e verso, em paisagem), igual à da planilha, com o cabeçalho do paciente e os dias de UTI, de dispositivos e de antimicrobianos contados para a data da folha. Escolha **hoje** ou **amanhã** (depois das 18h, o padrão é amanhã).
- **Check-list de IRAS:** abre a tela do check-list diário (PAV, IPCS e ITU-AC) do turno. Toque na célula para marcar 1, 0 ou NA; leito vago e bundle sem o dispositivo já vêm marcados, a adesão ao bundle é calculada e tudo é salvo (também sem Wi-Fi). O botão **Imprimir** gera a folha no modelo da Liga (PTQLD0005:03), com a assinatura do enfermeiro.
- **Check-list de inserção:** CVC ou CVD, com a identificação do paciente; se o dispositivo já estiver na evolução, localização, lado, lúmens e data vêm marcados. Também pode sair em branco.

Na janela de impressão do navegador, deixe **Margens: padrão** e **Escala: padrão (100%)**; o tamanho e a orientação de cada folha já vêm definidos.

## 11.4 Versão 0.6.0 (check-lists de inserção no sistema)

**Antes do merge**, publique de novo o `firestore.rules` (coleção nova `checklistsInsercao`).

- **Check-lists de inserção de CVC e CVD** no modelo atual da Liga (Versão 2, 07/04/2026), preenchidos no sistema:
  - pelo painel: **Impressos → Check-list de inserção → Preencher no sistema** (escolha o dispositivo e o paciente). Ali também aparecem os já preenchidos do paciente, para abrir ou imprimir, e a folha para preencher à mão;
  - pelo cartão do dispositivo na evolução: CVC, cateter de hemodiálise, PICC e CVD implantados na UTI mostram "⏳ Check-list de inserção pendente"; depois de salvo, "✓ Check-list de inserção".
  - O que a evolução já registra do dispositivo (tipo de cateter, lúmens, local, lado, data, implantado na UTI) vem marcado. Cada item é SIM ou NÃO; nas perguntas de falha (quebra de técnica, mais de uma punção, mudou o sítio) o conforme é NÃO. O sistema mostra se o bundle de inserção ficou conforme.
  - "Salvar e imprimir" gera a folha no leiaute da Liga, com as respostas.
- **Ocorrência:** o boneco (frente e costas) voltou ao espaço de lesões/curativos; a lista de lesões registradas sai logo abaixo dele.
- **Balanço hídrico (verso):** as figuras de prato e garrafa (0%, 50%, 75% e 100%) para o técnico registrar à mão a aceitação da dieta via oral.

## 11.5 Versão 0.6.1 (celular e tablet em pé)

Sem nada a publicar além do merge. Em telas de até 900 px de largura (celular e tablet em pé), a evolução usa um cabeçalho compacto: nome, leito, dias de UTI e idade, alergia, isolamento e situação do dia ocupam cerca de um terço do espaço anterior. Os detalhes (nascimento, registro, turno em que começou, evolução da admissão) abrem no botão ▾. Ao rolar para baixo, o cabeçalho se recolhe (fica nome, leito e alergia); ao subir, volta. A barra superior deixa de ficar fixa nessas telas. No computador e no tablet deitado nada muda.

## 11.6 Versão 0.6.2 (datas nos impressos)

- **Capa da ocorrência** e **Ocorrências (transição):** escolha a data na janela de impressão (o padrão é hoje). Na ocorrência, os dias de UTI e de antimicrobianos são contados para a data escolhida.
- **Check-list de IRAS:** além de "Imprimir" (com as marcações feitas no sistema), há **"Imprimir para preencher à mão"**: sai a folha com a data e o turno escolhidos e os leitos vagos marcados (VAGO); as marcações ficam em branco. Leito vago vem do painel de leitos: no check-list não há mais a opção de ocupar ou esvaziar leito.

## 11.7 Versão 0.7.0 (segurança e LGPD)

**Antes do merge:** (1) publique o `firestore.rules` novo; (2) cole de novo o `Codigo.gs` no Apps Script e publique **Nova versão** em Gerenciar implantações. A partir desta versão, **só contas Google @liga.org.br entram** (regras, Apps Script e tela de entrada conferem); contas pessoais já aprovadas perdem o acesso. Depois, faça as configurações da seção 4 de [`docs/SEGURANCA_LGPD.md`](SEGURANCA_LGPD.md): restringir a chave de API, domínios autorizados, ativar Zero Data Retention na Groq e verificação em duas etapas na conta do administrador.

## 11.8 Versão 0.8.0 (prescrição de enfermagem e observações da capa)

**Antes do merge**, publique o `firestore.rules` atualizado (Firestore → Regras → colar → Publicar). Ele traz a coleção nova `capasOcorrencia`. Sem isso, as observações da capa dão "sem permissão" ao salvar. O Apps Script não muda.

- **Prescrição de enfermagem:** no Processo de Enfermagem, cada atividade das intervenções tem **Aprazamento**: frequência (01/01H a 24/24H, 1X/TURNO, contínuo, SN, ACM), horários (vêm no padrão da farmácia, com o último às 06, e podem ser ajustados tocando na hora) e uma observação opcional. O aprazamento passa para o dia seguinte com o plano e mudá-lo não reabre o PE concluído. A folha sai no leiaute da prescrição médica da Liga, em paisagem: cabeçalho do paciente repetido em cada página, alergia em destaque, diagnósticos de enfermagem, itens numerados por intervenção, responsável (ENF/TÉC, pelo nível da intervenção), frequência, as 24 colunas de horário (07 às 06) e a assinatura do enfermeiro. Imprime pelo painel (**Prescrição de enfermagem**, por leito e data; se o PE do dia ainda não foi feito, sai o plano mais recente) ou pela etapa **Finalizar** da evolução.
- **Capa da ocorrência:** campo **Reservas e observações** (reservas cirúrgicas e outras observações administrativas), guardado por UTI e dia. O texto sai no campo RESERVAS da capa; as contagens continuam à mão.

## 11.9 Versão 0.9.0 (evolução no formato SBAR para o PEP)

Não há regra nem Apps Script novos.

- **Copiar para o PEP:** o texto sai no formato **SBAR**, todo em caixa alta e em frases curtas, como o enfermeiro escreve.
  - **S – Situação:** estado geral e suporte atual (ventilação, droga vasoativa, hemodiálise), intercorrências e a narrativa do enfermeiro.
  - **B – Breve histórico:** diagnóstico médico, comorbidades, admissão na UTI, alergia, precaução, limitação de suporte e objetivo de cuidado, antimicrobianos e culturas.
  - **A – Avaliação:** sinais vitais e sistemas, infusões, dispositivos e diagnósticos de enfermagem com o resultado esperado.
  - **R – Recomendações:** intervenções do PE com o aprazamento, a situação de cada atividade e a avaliação do dia, mais os alertas do sistema (AVP ou curativo vencido, sítio alterado, interrupção da sedação não realizada).
- **Fica de fora** o que o PEP já registra: nome, registro e nascimento do paciente, data, autor e assinatura (o PEP imprime nome e Coren). As pendências também não entram.
- **"Copiar texto"** copia com os títulos em **negrito** (o editor do PEP mantém); onde a formatação não for aceita, sai como texto simples.
- **"Imprimir / PDF"** da evolução usa o mesmo texto, com a identificação do paciente no alto e a linha de assinatura.

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
