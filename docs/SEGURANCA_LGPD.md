# Segurança e LGPD — Sistema de Evolução e Processo de Enfermagem (UTI 1 e 2)

Revisão feita em 17/10/2026, na versão 0.7.0. Este texto é técnico e serve de base para a conversa com o Encarregado de Dados (DPO), a TI e o CEP da Liga. **Não é parecer jurídico.**

## 1. Resumo

- **Situação geral:** nenhum dado de paciente está no repositório público do GitHub. Isso foi conferido no código e em todo o histórico de versões.
- **Proteção dos dados clínicos:** quem decide o acesso são as regras do Firestore, e não o navegador. O login é só por conta Google, e cada pessoa só entra depois de aprovada pelo administrador e só vê a(s) unidade(s) liberada(s) para ela.
- **IA:** recebe apenas um resumo clínico sem identificação. Nesta versão, entrou uma segunda barreira, que tira automaticamente nome, registro, nascimento, documentos, telefones, e-mails e nomes de profissionais que tenham escapado nos campos livres.
- **Correções desta revisão:** quatro ajustes nas regras e três proteções no aplicativo (seção 3).
- **O que depende de você:** algumas configurações nos consoles do Google e da Groq, e documentos da LGPD a cargo da Liga (seções 4 e 5).

## 2. Controles que o sistema já tinha

| Tema | Como está |
|---|---|
| **Autenticação** | Só conta Google **institucional (@liga.org.br)** com e-mail verificado. O cadastro nasce **pendente**, e só o administrador aprova, define o perfil (enfermeiro, leitura, administrador) e as unidades. |
| **Autorização** | Regras do Firestore: a pessoa só lê a unidade em que está; o perfil "leitura" não altera nada; ninguém altera o próprio perfil. |
| **Integridade** | Nada clínico é apagado. Internação encerrada não muda mais. Evolução finalizada só muda por **retificação**, que guarda a versão anterior. Autor e hora são sempre os do servidor. |
| **Rastreabilidade** | A coleção `auditoria` só aceita inclusões, com autor e hora do servidor. Ela registra admissões, transferências, desfechos, mudanças de leito, isolamento e usuários, e retificações. |
| **Tablets compartilhados** | A tela bloqueia após 10 minutos sem uso e pede de novo a conta Google. Ao sair, o cache do aparelho é apagado; se houver dado ainda não enviado, o sistema avisa antes. |
| **Apps Script (catálogos e IA)** | Todo pedido leva o token do Firebase, conferido no servidor junto com o perfil ativo. Há limite de uso por pessoa (60 por minuto e 600 por hora). A chave da Groq fica nas Propriedades do script, fora do código. Os registros técnicos não guardam conteúdo clínico. |
| **Navegador** | A tela é montada sem inserir HTML vindo de dados, o que evita injeção de código (XSS). Os impressos escapam todo texto de paciente. A página não é indexada por buscadores. |
| **Local dos dados** | Firestore em **southamerica-east1 (São Paulo)**. |
| **Catálogos NANDA-I/NOC/NIC** | Ficam no Apps Script, fora do GitHub, e são entregues item a item. |

## 3. Correções feitas nesta revisão (0.7.0)

1. **Cadastro de pacientes.** Antes, qualquer usuário ativo podia **listar** a coleção `pacientes` inteira (nome, nascimento, registro e convênio de todos que já passaram pela UTI). Agora ninguém lista. Só quem admite pode consultar **um** paciente pelo registro, como na readmissão. É o princípio da necessidade (art. 6º, III).
2. **Versões de evolução.** A versão guardada na retificação agora tem de ser cópia fiel da evolução finalizada (mesmo conteúdo, versão e autor). Antes, era possível gravar uma "versão anterior" com conteúdo diferente.
3. **Check-lists de inserção.** A regra passou a aceitar só os campos previstos, com limite de tamanho.
4. **Registro das operações (art. 37).** Passaram a ficar na `auditoria`:
   - a **abertura de cada evolução** (quem acessou o registro de qual paciente);
   - cada **impressão** (tipo, quantas folhas, unidade);
   - cada **cópia para o PEP**.

   Nenhum conteúdo clínico vai para a auditoria.
5. **IA.** O resumo enviado passa por `anonimizarParaIA`, que retira nome do paciente, registro, nascimento, CPF, cartão do SUS, telefones, e-mails e nomes depois de "Dr./Dra./Enf./Téc.". Idade de 90 anos ou mais vai como faixa. Há um teste automático para isso.
6. **Moldura de outro site.** O sistema se recusa a abrir dentro de moldura (iframe) de outro site, o que protege contra *clickjacking*.
7. **Endereço de origem.** O navegador não envia o endereço do sistema a sites externos (*referrer*).
8. **Só e-mail institucional.** Somente contas Google @liga.org.br entram (regras, Apps Script e tela de entrada).

**Para valer, publique o `firestore.rules` novo e a nova versão do Apps Script (`Codigo.gs`) antes do merge.**

**Fotos das lesões (0.11.0):** guardadas no Firestore (São Paulo), reduzidas e sem metadados do arquivo; incluídas só por quem tem o paciente na sua UTI; vistas pela equipe da unidade (e pela da unidade atual, se transferido); nunca apagadas por enfermeiro (exclusão com motivo, registrada); cada abertura vai para a auditoria. Fora da pesquisa do mestrado. Depende de termo de consentimento para registro fotográfico (a confirmar com o DPO).

**Revisão de 18/10/2026 (0.10.0), nas regras:**
- Evolução: cada etapa só aceita os próprios campos (rascunho: dados e confirmações; finalização: autor e hora; retificação: versão e motivo). Não dá mais para gravar uma "cópia ao PEP" ou um autor de finalização num rascunho.
- Paciente transferido de UTI: a evolução do dia passa para a unidade nova na mesma operação da troca, e a equipe da unidade atual lê as evoluções anteriores (só leitura do histórico do paciente que ela cuida agora).
- Cadastro de pacientes: só muda junto com uma internação ativa do paciente numa unidade de quem altera (admissão ou correção).

## 4. Configurações a fazer nos consoles (sem custo)

| # | Onde | O que fazer | Por quê |
|---|---|---|---|
| 1 | Google Cloud Console (o projeto do Firebase **já é** um projeto do Google Cloud): abrir https://console.cloud.google.com/apis/credentials?project=uti-liga-sae com a mesma conta do Firebase | Clicar em **Browser key (auto created by Firebase)** → "Restrições de aplicativos": **Sites** → adicionar `https://saeliga.github.io/*` **e** `https://uti-liga-sae.firebaseapp.com/*` (a janela de login do Google roda nesse endereço; sem ele, o login para de funcionar) → Salvar. A restrição por API é opcional e pode quebrar o login se faltar alguma; não é necessária. | A chave é pública por natureza; a restrição impede uso em outros sites. |
| 2 | Firebase → Authentication → Configurações → Domínios autorizados | Deixar só `saeliga.github.io` (e o domínio `*.firebaseapp.com` do projeto). Retirar `localhost` quando não estiver testando. | Login só pela página oficial. |
| 3 | Groq Console → Settings → **Data Controls** | Ativar **Zero Data Retention (ZDR)**. | Por padrão, a Groq pode guardar entradas e saídas por até 30 dias para monitorar abuso, em servidores nos EUA. Com ZDR, não guarda nada. |
| 4 | Conta Google do administrador | Ativar **verificação em duas etapas** e usar conta institucional (@liga.org.br). | É a conta que aprova acessos. |
| 5 | Firebase → Configurações do projeto → **Privacidade** | **Desmarcar** a opção que permite ao Google usar os Dados de Serviço do Firebase em serviços que não são do Firebase. Em "Representantes de privacidade" (exigência europeia, GDPR), não é preciso preencher; se o DPO da Liga quiser, pode colocar o contato dele. Os Termos de Processamento de Dados do Firebase fazem parte dos termos aceitos ao criar o projeto; não há botão separado. | Minimização: o Google só usa os dados de serviço para o próprio Firebase. |
| 6 | (Adiado) Firebase → App Check | **Não ativar por enquanto.** O reCAPTCHA clássico foi descontinuado; a opção atual (Fraud Defense / reCAPTCHA Enterprise) exige criar uma chave no Google Cloud, pode exigir conta de faturamento e precisa de mudança no código do sistema. Ativar a exigência sem essa mudança bloquearia todos os usuários. | A restrição da chave por site, o e-mail institucional e as regras do Firestore já cobrem o essencial. |
| 7 | (A verificar) Google Cloud → IAM → Registros de auditoria | Avaliar ativar "Leitura de dados" do Firestore. | Registro de **todas** as leituras. Pode exigir faturamento; confirmar antes. |

**Decidido em 17/10/2026:** só contas **@liga.org.br** entram. A conferência está nas regras do Firestore (todas as coleções), no Apps Script e na tela de entrada; uma sessão antiga de conta pessoal é encerrada automaticamente.

## 5. LGPD: papéis, bases legais e documentos

**Papéis**
- **Controladora:** Liga Contra o Câncer. O sistema é ferramenta da assistência de enfermagem da UTI.
- **Usuários (enfermeiros, administrador):** tratam os dados em nome da Liga. Devem conhecer e aceitar regras de uso e sigilo.
- **Operadores:**
  - **Google** (Firebase: login e banco);
  - **Groq** (IA): recebe **apenas** resumo anonimizado. Se a anonimização for efetiva, deixa de ser dado pessoal (art. 12), mas a Liga deve registrar isso;
  - **GitHub:** hospeda **só o código**.

**Bases legais (a confirmar com o DPO)**
- **Assistência:** tutela da saúde, por profissional de saúde (art. 7º, VIII; art. 11, II, "f"). Dados de saúde são **dados sensíveis** (art. 5º, II).
- **Pesquisa do mestrado:** realização de estudos por órgão de pesquisa, com anonimização sempre que possível (art. 7º, IV; art. 11, II, "c"; art. 13), **após aprovação do CEP**. Nenhum dado real deve sair do sistema para a pesquisa antes disso. O exportador planejado gera casos **já anonimizados**.

**Documentos que a Liga deve ter (responsáveis: DPO e TI da Liga)**
1. **Relatório de Impacto à Proteção de Dados (RIPD)**, art. 38. Recomendado por envolver dado sensível e IA. Este documento serve de insumo.
2. **Registro das operações de tratamento** (art. 37): finalidade, dados, acessos, operadores, retenção. A coleção `auditoria` apoia o registro técnico.
3. **Termo de uso e confidencialidade** para os usuários do sistema.
4. **Aviso de privacidade** da Liga mencionando o sistema e a pesquisa.
5. **Política de retenção.** Decisão atual: **não apagar** dados por enquanto. O registro oficial continua sendo o PEP; este sistema é auxiliar. Definir prazo e forma de descarte ou anonimização.
6. **Plano de resposta a incidentes** (art. 48): quem avisa, em quanto tempo, como bloquear acessos (o administrador desativa usuários na tela de Administração).
7. **Direitos dos titulares:** acesso e correção seguem o fluxo do prontuário da Liga. Correção no sistema é feita por retificação, que guarda o histórico.

## 6. Cuidados no dia a dia

- **Tablets:** bloqueio de tela do próprio aparelho (PIN), navegador sem sincronização com conta pessoal e sem salvar senhas. Ao terminar, use **Sair** se for a última pessoa do turno.
- **Impressos** (ocorrência, BH, check-lists) têm dados de paciente: guardar como prontuário e descartar em fragmentadora. Toda impressão fica registrada.
- **Campos livres** (narrativa, intercorrências, observações): registrar só o necessário para o cuidado. Os campos livres que vão para a IA passam pela anonimização automática, mas a regra continua sendo não escrever dado de outro paciente ou informação alheia ao cuidado.
- **Telas e capturas:** não fotografar a tela nem enviar prints por aplicativos de mensagem.

## 7. Pontos para versões futuras

- Política de segurança de conteúdo (CSP) no `index.html`, a testar com o login real antes de publicar, porque uma configuração errada bloqueia o acesso.
- Exportação periódica do banco (cópia de segurança). No plano gratuito, a exportação gerenciada não está disponível; avaliar uma rotina feita pelo administrador.
- Tela de consulta da auditoria para o administrador (quem acessou o quê).
- Exportador de casos para a pesquisa, com anonimização completa, só após aprovação do CEP.

---
Fontes externas: [Groq — Your Data](https://console.groq.com/docs/your-data) (retenção de 30 dias para monitoramento de abuso, ZDR, dados nos EUA com cláusulas contratuais padrão).
