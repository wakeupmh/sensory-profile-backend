# Backend do Perfil Sensorial 2

Este é o backend para a aplicação de Perfil Sensorial 2, desenvolvido para armazenar e processar dados de avaliações sensoriais de crianças entre 3 e 14 anos.

## Tecnologias Utilizadas

- Node.js com Express.js
- TypeScript
- `pg` (cliente PostgreSQL puro, sem ORM) + SQL parametrizado
- PostgreSQL
- Supabase Auth (JWT verificado via JWKS remoto, biblioteca `jose`) — não há tabela local de usuários nem rotas de registro/login
- AWS SDK v3 (Bedrock para resumos por IA, S3 para documentos e áudio, Transcribe para o relato falado do dia e o ditado, SES para e-mails de lembrete)
- Docker para containerização
- Render para hospedagem

## Estrutura do Projeto

Arquitetura em camadas (hexagonal/clean architecture):

```
sensory-profile-backend/
├── src/
│   ├── domain/
│   │   ├── entities/         # Entidades de domínio
│   │   └── repositories/     # Interfaces de repositório
│   ├── application/
│   │   └── services/         # Lógica de negócio (orquestra domínio + repositórios)
│   ├── infrastructure/
│   │   ├── repositories/     # Implementações Pg* dos repositórios (SQL cru)
│   │   ├── database/         # Pool de conexão pg
│   │   ├── email/            # Wrapper do SES
│   │   ├── storage/          # Wrapper do S3
│   │   └── utils/            # Erros customizados, logger, scoring, etc.
│   ├── interfaces/
│   │   └── http/
│   │       ├── controllers/  # Handlers Express
│   │       ├── routes/       # Definição das rotas por recurso
│   │       ├── middleware/   # auth, delegação de cuidador, etc.
│   │       └── validations/  # Schemas Zod
│   ├── instruments/           # Definições dos instrumentos clínicos suportados
│   └── index.ts               # Configuração e bootstrap do Express
├── migrations/                # Migrações SQL numeradas, aplicadas via `npm run migrate`
├── scripts/migrate.ts         # Runner de migrações (ver seção Migrações abaixo)
├── .github/workflows/         # CI (typecheck + migrações + testes) e jobs agendados
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

## Configuração do Ambiente de Desenvolvimento

### Pré-requisitos

- Node.js (versão 18 ou superior)
- PostgreSQL (local ou em container Docker)
- npm ou yarn

### Instalação

1. Clone o repositório
   ```bash
   git clone <url-do-repositorio>
   cd sensory-profile-backend
   ```

2. Instale as dependências
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente
   ```bash
   cp .env.example .env
   # Edite o arquivo .env com suas configurações
   ```

4. Execute as migrações do banco de dados
   ```bash
   npm run migrate
   ```
   Aplica os arquivos `migrations/*.sql` pendentes em ordem, cada um em sua própria transação, e registra o que já foi aplicado em uma tabela `schema_migrations` (para que rodar de novo seja um no-op). Veja a seção [Migrações](#migrações) para detalhes sobre como adotar isso em um banco já existente.

5. Inicie o servidor de desenvolvimento
   ```bash
   npm run dev
   ```

## Migrações

As migrações são arquivos SQL simples e numerados em `migrations/`, aplicados via `npm run migrate` (`scripts/migrate.ts`). O runner:
- aplica cada arquivo pendente em sua própria transação, na ordem do nome do arquivo;
- registra os arquivos já aplicados em uma tabela `schema_migrations`, então rodar novamente é um no-op quando tudo já está em dia;
- interrompe e reverte (rollback) no primeiro erro, sem marcar aquele arquivo como aplicado — os arquivos seguintes não são executados.

Para criar uma nova migração, adicione um novo arquivo `NNN_descricao.sql` em `migrations/` (número sequencial, três dígitos) e rode `npm run migrate` localmente antes de subir a alteração.

**Banco já existente** (ex.: staging/produção atual, que já tem as migrações 000–026 aplicadas manualmente antes desta tabela existir): rode um backfill único para não tentar reaplicar tudo desde o início:
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- INSERT (filename) para cada migrations/*.sql já aplicado, com ON CONFLICT DO NOTHING
```
Depois disso, `npm run migrate` só aplica o que for novo.

## CI

`.github/workflows/ci.yml` roda em toda PR e push para `main`: typecheck (`tsc --noEmit`), aplicação das migrações e a suíte de testes completa, contra um container de serviço PostgreSQL.

### Jobs agendados

Além do CI, o repositório agenda workflows que chamam endpoints `/api/system/*` do serviço em produção. Todos compartilham os mesmos dois secrets (Settings > Secrets and variables > Actions):
- `BACKEND_URL`: URL base do serviço web em produção (ex.: `https://sensory-profile-backend.onrender.com`)
- `CRON_SECRET`: o mesmo valor configurado como variável de ambiente `CRON_SECRET` no serviço do Render

Sem esses secrets os workflows falham de propósito, com uma mensagem explicando o que falta, em vez de silenciosamente não fazer nada.

| Workflow | Quando | O que faz |
| --- | --- | --- |
| `.github/workflows/reminder-digest.yml` | diariamente, ~12:00 UTC (~09:00 em horário de Brasília) | `POST /api/system/reminder-digest` — sem isso, ninguém recebe e-mail de lembrete mesmo com a preferência ativada no app |
| `.github/workflows/retention-cleanup.yml` | semanalmente, domingo ~06:23 UTC | `POST /api/system/retention-cleanup` — apaga logs de acesso, histórico de notificações e ditados vencidos, e expira os áudios dos relatos falados (ver "Retenção de dados" abaixo) |

Qualquer um deles também pode ser disparado manualmente pela aba Actions (`Run workflow`).

O workflow do digest não considera sucesso apenas o HTTP 200: falhas de envio são capturadas por usuário e viram só contadores na resposta, então o job também os inspeciona — caso contrário ficaria verde todo dia com o SES mal configurado e ninguém recebendo nada. `emailsFailed > 0` derruba o job (indica problema de configuração/SES). `pushFailed > 0` apenas emite um aviso: esse contador também sobe no caso rotineiro de o usuário ter revogado a permissão ou desinstalado o navegador — a inscrição morta é apagada automaticamente e o próprio serviço se corrige na execução seguinte.

**Limitação conhecida**: o agendador do GitHub Actions é best-effort e desabilita workflows agendados após 60 dias sem atividade no repositório. Nesse caso não há execução — e portanto nenhuma falha para notificar. Se o repositório ficar parado por muito tempo, confira a aba Actions.

## Implantação no Render

### Configuração do Banco de Dados

1. Crie um novo serviço PostgreSQL no Render
   - Acesse o dashboard do Render
   - Clique em "New" e selecione "PostgreSQL"
   - Configure o nome, usuário e senha
   - Clique em "Create Database"

2. Anote a URL de conexão fornecida pelo Render

### Configuração do Serviço Web

1. Crie um novo serviço Web no Render
   - Acesse o dashboard do Render
   - Clique em "New" e selecione "Web Service"
   - Conecte ao repositório GitHub
   - Configure o nome do serviço

2. Configure as variáveis de ambiente (veja `.env.example` para a lista completa)
   - DATABASE_URL: URL de conexão do PostgreSQL criado anteriormente
   - SUPABASE_URL: URL do projeto Supabase (autenticação via JWKS, sem tabela local de usuários)
   - NODE_ENV: production
   - FRONTEND_URL: URL do frontend
   - AWS_REGION, AWS_S3_BUCKET: resumos por IA (Bedrock), armazenamento de documentos e áudio (S3) e transcrição do relato falado (Transcribe)
   - EMAIL_FROM_ADDRESS, CRON_SECRET: entrega ativa de lembretes por e-mail (SES)
   - VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT: entrega ativa de lembretes por Web Push
   - Rode `npm run migrate` (manualmente ou via job de deploy) após provisionar o banco

3. Configure o build command
   ```
   npm install && npm run build
   ```

4. Configure o start command
   ```
   npm start
   ```

5. Clique em "Create Web Service"

## API Endpoints

Autenticação é 100% via Supabase: o cliente obtém um JWT do Supabase Auth e envia `Authorization: Bearer <token>` em toda requisição. O backend apenas verifica o token (JWKS remoto) — não há rotas locais de registro/login nem tabela de usuários.

### Crianças
- `GET /api/children` - Listar todas as crianças
- `GET /api/children/:id` - Obter detalhes de uma criança
- `POST /api/children` - Cadastrar nova criança
- `PUT /api/children/:id` - Atualizar dados de uma criança
- `DELETE /api/children/:id` - Remover uma criança

Campos opcionais `sensoryTriggers`, `calmingStrategies`, `emergencyContact` (strings, `null` limpa o campo) guardam notas rápidas de cuidado — gatilhos sensoriais, estratégias de acalmar e contato de emergência — sincronizadas entre dispositivos via `POST`/`PUT` acima (antes eram somente locais no dispositivo, no frontend).

### Examinadores
- `GET /api/examiners` - Listar todos os examinadores
- `GET /api/examiners/:id` - Obter detalhes de um examinador
- `POST /api/examiners` - Cadastrar novo examinador
- `PUT /api/examiners/:id` - Atualizar dados de um examinador
- `DELETE /api/examiners/:id` - Remover um examinador

### Cuidadores
- `GET /api/caregivers` - Listar todos os cuidadores
- `GET /api/caregivers/:id` - Obter detalhes de um cuidador
- `POST /api/caregivers` - Cadastrar novo cuidador
- `PUT /api/caregivers/:id` - Atualizar dados de um cuidador
- `DELETE /api/caregivers/:id` - Remover um cuidador

### Avaliações
- `GET /api/assessments` - Listar todas as avaliações
- `GET /api/assessments/:id` - Obter detalhes de uma avaliação
- `POST /api/assessments` - Cadastrar nova avaliação (com respostas)
- `PUT /api/assessments/:id` - Atualizar uma avaliação
- `DELETE /api/assessments/:id` - Remover uma avaliação
- `GET /api/assessments/:id/report` - Gerar relatório de uma avaliação

Campo `instrumentId` (string, opcional no POST/PUT, ecoado no GET) identifica o
instrumento clínico usado na avaliação. Default: `crianca-3-14`. Outros valores
(ex.: `crianca-pequena-7-36`) são aceitos e armazenados; as validações
específicas do Criança 3-14 (faixa etária, contagem de itens por seção,
cálculo de raw scores) só são aplicadas quando `instrumentId === 'crianca-3-14'`.

### Itens do Questionário
- `GET /api/items` - Listar todos os itens
- `GET /api/items/:section` - Listar itens por seção

### Anamnese
- `GET /api/anamneses` - Listar anamneses do usuário (resumo)
- `GET /api/anamneses/:id` - Obter anamnese completa
- `POST /api/anamneses` - Criar nova anamnese
- `PUT /api/anamneses/:id` - Atualizar anamnese
- `DELETE /api/anamneses/:id` - Remover anamnese
- `POST /api/anamneses/:id/share` - Gerar link compartilhável (retorna `shareToken`)
- `DELETE /api/anamneses/:id/share` - Revogar link compartilhável
- `GET /api/anamneses/shared/:shareToken` - Acesso público somente leitura via token (sem autenticação)

### Profissionais (terapeutas, médicos)
- `GET /api/professionals` - Listar profissionais cadastrados pelo dono
- `POST /api/professionals` - Cadastrar profissional e gerar `invitationToken`
- `GET /api/professionals/:id` - Detalhes
- `PUT /api/professionals/:id` - Atualizar
- `DELETE /api/professionals/:id` - Remover (revoga todos os compartilhamentos)
- `POST /api/professionals/:id/rotate-token` - Reemitir o token de convite (apenas se ainda não aceito)
- `GET /api/professionals/me/identities` - Identidades de profissional do usuário logado
- `POST /api/professional-invites/accept` - Body `{ token }`: vincula o profissional ao `userId` Clerk do usuário logado

### Compartilhamentos por profissional
- `GET /api/anamneses/:id/shares` - Listar profissionais com acesso a uma anamnese
- `POST /api/anamneses/:id/shares` - Body `{ professionalId }`: conceder acesso
- `DELETE /api/anamneses/:id/shares/:professionalId` - Revogar acesso
- `GET /api/assessments/:id/shares` - Idem para avaliações
- `POST /api/assessments/:id/shares` - Idem para avaliações
- `DELETE /api/assessments/:id/shares/:professionalId` - Idem para avaliações

### Compartilhamento por criança (todos os domínios de uma vez)
Complementa os compartilhamentos acima: em vez de compartilhar avaliação por avaliação, concede acesso a domínios inteiros de dados de uma criança (assessments, daily_logs, therapy, medical, development) em um único grant.
- `GET /api/children/:childId/shares` - Listar profissionais com acesso à criança e os escopos concedidos a cada um
- `POST /api/children/:childId/shares` - Body `{ professionalId, scopes: string[] }` (`scopes` ∈ `assessments`, `daily_logs`, `therapy`, `medical`, `development`) — concede ou atualiza os escopos
- `DELETE /api/children/:childId/shares/:professionalId` - Revogar

### Co-cuidadores (leitura-escrita compartilhada)
Diferente do profissional (sempre somente leitura, com escopos), um cuidador é um co-gestor completo de uma criança específica — pais separados, avós, etc. — com leitura **e escrita** em todos os domínios.
- `POST /api/children/:childId/caregivers` - Body `{ caregiverName }`: cria convite e gera `invitationToken` (expira em 14 dias)
- `GET /api/children/:childId/caregivers` - Listar cuidadores (pendentes e aceitos)
- `DELETE /api/children/:childId/caregivers/:id` - Revogar
- `POST /api/caregiver-invites/accept` - Body `{ token }`: vincula o cuidador ao seu próprio `userId` Supabase

**Como funciona a delegação**: depois de aceitar, o cuidador envia o header `X-Delegate-Child-Id: <childId>` em qualquer requisição para atuar sobre os dados dessa criança como se fosse o dono — a leitura/escrita afeta os registros do dono, não do cuidador. Sem o header, o comportamento de qualquer endpoint existente é 100% inalterado (a delegação é totalmente opt-in). Se o cuidador enviar o header para uma criança com a qual não tem relação, a requisição é rejeitada (403) — nunca cai silenciosamente nos próprios dados (vazios) do cuidador. Aplica-se a praticamente toda a API (avaliações, registros diários, terapia, médico, desenvolvimento, educação, metas, lembretes, documentos, relatório consolidado); anamnese fica de fora porque não tem vínculo direto com `children.id`.

### Acesso somente leitura (profissional)
- `GET /api/shared/anamneses` - Anamneses compartilhadas comigo
- `GET /api/shared/anamneses/:id` - Anamnese compartilhada comigo (read-only)
- `GET /api/shared/assessments` - Avaliações compartilhadas comigo
- `GET /api/shared/assessments/:id` - Avaliação compartilhada comigo (read-only)
- `GET /api/shared/children` - Crianças compartilhadas comigo por escopo (todas as identidades de profissional aceitas)
- `GET /api/shared/children/:childId/assessments` - Avaliações da criança (requer escopo `assessments`)
- `GET /api/shared/children/:childId/daily-logs` - Registros diários da criança (requer escopo `daily_logs`)
- `GET /api/shared/children/:childId/therapy` - Sessões de terapia da criança (requer escopo `therapy`)
- `GET /api/shared/children/:childId/medical` - Medicamentos, comorbidades e consultas da criança (requer escopo `medical`)
- `GET /api/shared/children/:childId/development` - Marcos de desenvolvimento e registros de comunicação da criança (requer escopo `development`)

### Notas de profissional (escrita limitada)
Profissionais nunca alteram os registros do dono — uma nota é uma anotação separada, vinculada à criança e opcionalmente a um recurso específico. Requer um `child_shares` (qualquer escopo) com a criança.
- `POST /api/shared/children/:childId/notes` - Criar nota (`content`, `resourceType?`, `resourceId?`)
- `GET /api/shared/children/:childId/notes` - Listar minhas próprias notas sobre essa criança
- `PATCH /api/shared/notes/:id` - Atualizar (somente o autor)
- `DELETE /api/shared/notes/:id` - Remover (somente o autor)
- `GET /api/children/:childId/notes` - **Dono**: ver todas as notas de todos os profissionais sobre a criança

### Trilha de auditoria (LGPD)
- `GET /api/children/:childId/access-logs` - **Dono**: histórico paginado de quem leu ou escreveu dados da criança (leituras de anamnese/avaliação/domínios compartilhados + escrita de notas), com data/hora e identidade do profissional quando aplicável

### Portabilidade e eliminação de dados (LGPD Art. 18)
- `GET /api/children/:childId/export` - Exporta todos os dados ligados a uma criança (avaliações, registros diários, terapia, saúde, desenvolvimento, educação, metas, documentos, resumos de IA, notas profissionais, trilha de auditoria) como um arquivo JSON. Retorna `{ downloadUrl, expiresAt }` — uma URL pré-assinada do S3 válida por 15 minutos, não os bytes do arquivo diretamente
- `GET /api/account/export` - Exporta **tudo** que a conta possui: todas as crianças (cada uma com o mesmo conteúdo do endpoint acima), anamneses, profissionais cadastrados, rascunhos de formulário e histórico de notificações de lembrete. Anamneses guardam um retrato (JSONB) da criança no momento do preenchimento em vez de uma referência a `children.id`, então não têm como ser vinculadas com segurança a uma criança específica — por isso só aparecem na exportação de conta inteira, não na de uma criança
- `DELETE /api/account` - Apaga permanentemente tudo que a conta possui: todas as crianças (mesmo as que têm avaliações — ver nota abaixo), anamneses, profissionais, rascunhos, histórico de notificações, contatos cadastrados (terapeutas, examinadores, cuidadores), inscrições de push e o registro em `user_profiles`, incluindo os objetos correspondentes no S3. Tudo em **uma única transação** — uma eliminação parcial deixaria a conta num estado que nenhum código modela, e ainda assim reportaria sucesso. **Não é reversível.** Nenhum dos dois endpoints acima (`export`/`erase`) funciona através de acesso delegado por um cuidador — apenas o dono autenticado da conta pode chamá-los, mesmo que um `X-Delegate-Child-Id` válido esteja presente na requisição

**Por que `DELETE /api/children/:id` não é suficiente para eliminação completa**: esse endpoint recusa deliberadamente apagar uma criança que já tem avaliações associadas (proteção contra perda acidental de dados durante o uso normal do app) e não teria como remover os objetos S3 de documentos/fotos, já que essas linhas somem via `ON DELETE CASCADE` antes de qualquer código da aplicação rodar. `DELETE /api/account` contorna as duas coisas de propósito: uma solicitação de eliminação precisa funcionar independente do que a conta contém.

**Como a lista de tabelas é mantida honesta**: a eliminação percorre uma lista escrita à mão, que apodrece silenciosamente toda vez que alguém adiciona uma tabela com `user_id` (foi exatamente assim que `push_subscriptions` — de um PR mergeado enquanto este estava aberto — quase escapou, junto com `therapists`, `examiners` e `caregivers`). O teste `accountErasureCoverage.int.test.ts` lê o schema real via `information_schema` e falha se alguma tabela com coluna de usuário não estiver classificada como *apagada diretamente*, *removida por cascade* ou *retida de propósito* — então adicionar uma tabela obriga a uma decisão em vez de virar um vazamento silencioso.

**O que este endpoint não apaga**: a identidade de autenticação no Supabase (e-mail/senha) continua existindo — este backend não guarda credenciais do Supabase Admin API (mesma limitação documentada em `authMiddleware.ts`), então apagar a conta de autenticação em si é uma decisão separada, pendente de decidir se vale a pena provisionar uma credencial de admin só para isso.

### Documentos e anexos
Arquivos (laudos, receitas, fotos, vídeos) não passam pelo backend — o fluxo é upload direto ao S3 via URL pré-assinada:
- `POST /api/documents/upload-url` - Body `{ childId, title, mimeType, sizeBytes?, resourceType?, resourceId?, expiresAt? }`. Cria o registro do documento e retorna `{ document, uploadUrl }`; o cliente deve enviar o arquivo via `PUT` para `uploadUrl` em até 5 minutos.
- `GET /api/documents` - Listar documentos (filtros: `childId`, `resourceType`, `resourceId`)
- `GET /api/documents/:id` - Metadados do documento
- `GET /api/documents/:id/download-url` - Gera URL pré-assinada de leitura (válida por 15 minutos)
- `PATCH /api/documents/:id` - Atualizar título/descrição/`expiresAt` (envie `expiresAt: null` para remover a validade)
- `DELETE /api/documents/:id` - Remover (apaga também o objeto no S3)

`expiresAt` (string `YYYY-MM-DD`, opcional) marca a validade de um documento (ex.: laudo médico, autorização de terapia). Documentos com validade próxima aparecem em `GET /api/reminders/upcoming` (veja abaixo).

Requer as variáveis de ambiente `AWS_REGION` e `AWS_S3_BUCKET`; sem elas, os endpoints de upload/download retornam 503.

### Insights de comportamento (ABC)
- `GET /api/logs/insights/behavior?childId=&days=30` - Agrega os registros diários do tipo `abc` (antecedente/comportamento/consequência) em: total de ocorrências no período vs período anterior, intensidade média, distribuição por dia da semana e hora do dia, principais antecedentes/comportamentos e as 10 ocorrências mais recentes.

### Anexos de foto em registros diários
Assim como documentos, os bytes do arquivo não passam pelo backend — fluxo de upload direto ao S3 via URL pré-assinada. Usa um prefixo próprio no bucket (`log-attachments/...`, distinto de `documents/...`) para permitir uma política/lifecycle de S3 separada, já que fotos de registros (ex.: uma crise) podem ser mais sensíveis que um documento clínico de rotina. Somente imagens são aceitas (`image/*`).
- `POST /api/logs/:id/attachments` - Body `{ mimeType, sizeBytes? }`. Cria o registro do anexo e retorna `{ attachment, uploadUrl }`; o cliente envia o arquivo via `PUT` para `uploadUrl` em até 5 minutos.
- `GET /api/logs/:id/attachments` - Lista os anexos do registro, cada um já com uma URL de leitura pré-assinada (`url`, válida por 15 minutos)
- `DELETE /api/logs/:id/attachments/:attachmentId` - Remove o anexo (registro e objeto no S3)

`GET /api/logs` (lista) e `GET /api/logs/:id` (detalhe) já retornam `attachments: [{ id, mimeType, sizeBytes, createdAt, url }]` embutido em cada registro — a lista busca os anexos de todos os registros retornados em uma única consulta (sem N+1), e as URLs pré-assinadas são geradas localmente (sem round-trip de rede), então isso é seguro mesmo para páginas grandes.

Requer as variáveis de ambiente `AWS_REGION` e `AWS_S3_BUCKET` (mesmas de documentos); sem elas, os endpoints de upload retornam 503.

### Relato falado do dia
O cuidador grava um áudio contando como foi o dia da criança; o áudio é transcrito pelo AWS Transcribe (pt-BR) e o texto é organizado pelo Bedrock num relatório do dia, com registros diários (`mood`/`sleep`/`food`/`toileting`/`abc`) **sugeridos** para o cuidador confirmar. Nada é gravado em `daily_logs` automaticamente: um modelo entendendo "dormiu mal" como uma noite nota 5 corromperia em silêncio justamente o histórico em que os relatórios se baseiam.

Uma linha por criança por data (`UNIQUE (child_id, report_date)`): regravar substitui o relato do dia em vez de empilhar um segundo.

O fluxo é assíncrono porque o Transcribe é assíncrono, e é dirigido por polling do cliente em vez de fila/EventBridge — são poucos jobs por usuário por dia, e uma fila real seria infraestrutura nova para um problema que ainda não existe.

1. `POST /api/daily-reports` - Body `{ childId, reportDate: "YYYY-MM-DD", mimeType }`. Retorna `{ report, uploadUrl }`; o cliente envia o áudio via `PUT` para `uploadUrl` em até 5 minutos. Aceita os formatos que o `MediaRecorder` do navegador realmente produz (`audio/webm` no Chrome/Firefox, `audio/mp4` no Safari) e mais alguns que o Transcribe suporta; o parâmetro `;codecs=...` é ignorado.
2. `POST /api/daily-reports/:id/transcribe` - Upload concluído; dispara o job. Status vai para `transcribing`.
3. `GET /api/daily-reports/:id` - Consultado em loop enquanto o status for `transcribing`. O estado avança como efeito de ser lido (job pronto → busca o texto, estrutura via IA, finaliza), então não existe um endpoint "checar job" separado para manter em sincronia com este.
- `GET /api/daily-reports?childId=...&limit=30` - Lista os relatos da criança, mais recentes primeiro
- `GET /api/daily-reports/:id/audio` - URL pré-assinada para reouvir a própria gravação, enquanto o áudio existir
- `DELETE /api/daily-reports/:id` - Remove o relato e seus objetos no S3

Status: `draft` (linha criada, áudio ainda não enviado) → `transcribing` → `ready` | `failed`. Se a estruturação por IA falhar, o relato ainda vira `ready` com `structured: null` — perder o que o cuidador falou por causa de um serviço indisponível seria pior que entregar só a transcrição. Uma gravação muda vira `failed` com uma explicação, em vez de um relatório vazio.

O JSON de saída do Transcribe é escrito no **nosso** bucket (`OutputBucketName`), não no bucket gerenciado pela AWS, para ficar sujeito às mesmas regras de ciclo de vida, exportação e eliminação (LGPD) do resto. Áudio e JSON bruto expiram em 30 dias (ver "Retenção de dados"); ambos entram na coleta de chaves da eliminação de conta, e a transcrição e o `structured` entram na exportação de dados.

Requer `AWS_REGION` e `AWS_S3_BUCKET`; sem elas os endpoints retornam 503.

### Ditado (falar em vez de digitar)
O mesmo maquinário do relato do dia, exposto como uma ferramenta genérica: qualquer campo de texto do app pode oferecer um botão de microfone que grava, transcreve e devolve o texto. Não é ligado a nenhuma criança — o ditado é da conta de quem falou — e por isso as rotas **não** passam pelo `delegationMiddleware`: não há escopo de criança a verificar, e resolver a delegação aqui só criaria a chance de gravar o ditado na conta errada.

1. `POST /api/voice-notes` - Body `{ mimeType }`. Retorna `{ note, uploadUrl }`.
2. `POST /api/voice-notes/:id/transcribe` - Upload concluído; dispara o job.
3. `GET /api/voice-notes/:id` - Consultado em loop enquanto o status for `transcribing`; devolve `{ status, transcript, error }`.

A diferença de propósito em relação ao relato do dia dita a diferença de retenção: **o áudio de um ditado é apagado no instante em que a transcrição sai** (e também quando o job falha — sem texto ele não serve para nada, e regravar são segundos). No relato do dia a gravação *é* o registro e o cuidador pode querer reouvi-la; num ditado ela é insumo descartável, e guardá-la seria acumular a voz da pessoa sem motivo.

As linhas em si são apagadas por `VOICE_NOTE_RETENTION_DAYS` (padrão: 7 dias) no job de retenção, o que também limpa os `draft` abandonados cujo áudio nunca chegou a ser transcrito. Ao contrário do relato do dia, uma falha do S3 não adia o `DELETE`: a chave é derivada do id (`voice-notes/<userId>/<id>/...`) e continua encontrável, enquanto manter a linha guardaria a transcrição por mais tempo — exatamente o que essa limpeza existe para evitar.

### Lembretes
- `GET /api/reminders` - Listar lembretes criados manualmente (filtros: `childId`, `status`)
- `POST /api/reminders` - Criar lembrete (`title`, `dueAt`, `notes?`)
- `GET /api/reminders/:id` - Detalhes
- `PATCH /api/reminders/:id` - Atualizar (inclui marcar `status` como `done`/`dismissed`)
- `DELETE /api/reminders/:id` - Remover
- `GET /api/reminders/upcoming?childId=&days=14` - Combina os lembretes manuais pendentes com datas já registradas em outras partes do sistema e que ainda não tinham nenhum lembrete associado: retorno médico (`medical_appointments.follow_up_date`), revisão/fim de PEI (`education_plans.review_date`/`end_date`), retorno escolar (`school_communications.follow_up_date`), meta de marco de desenvolvimento (`developmental_milestones.target_date`), fim de medicação ativa (`medications.end_date`) e validade de documento (`documents.expires_at`)

### Entrega ativa de lembretes (e-mail + push)
O feed acima é *pull* — o app precisa ser aberto para ver o que vence. Isto adiciona entrega *push* por e-mail e por Web Push, cada canal rastreado e reenviado de forma independente:
- `GET /api/notifications/preferences` - Ver e-mail conhecido e se o envio de lembretes por e-mail está ativado
- `PATCH /api/notifications/preferences` - Body `{ reminderEmailsEnabled: boolean }` - Ativar/desativar o envio por e-mail
- `GET /api/notifications/push-subscriptions/public-key` - Chave pública VAPID, usada pelo frontend em `pushManager.subscribe({ applicationServerKey })`
- `POST /api/notifications/push-subscriptions` - Body igual ao retorno de `PushSubscription.toJSON()` do navegador (`{ endpoint, keys: { p256dh, auth } }`) - Registra/atualiza a inscrição push do dispositivo atual
- `DELETE /api/notifications/push-subscriptions` - Body `{ endpoint }` - Remove a inscrição (equivalente a "desativar notificações push" neste dispositivo)
- `POST /api/system/reminder-digest` - **Não é uma rota de usuário.** Protegida por header `X-Cron-Secret` (comparado a `CRON_SECRET`), não por sessão. Chamada diariamente por `.github/workflows/reminder-digest.yml` (ver "Jobs agendados" acima). Para cada usuário com e-mail conhecido/notificações ativadas e/ou pelo menos um dispositivo inscrito, busca os lembretes que vencem nos próximos 3 dias e envia por cada canal habilitado, nunca reenviando o mesmo lembrete no mesmo canal (idempotente via `reminder_notifications`, agora com uma coluna `channel`)

**Como o e-mail do usuário é descoberto**: não existe tabela local de usuários (a autenticação é 100% Supabase) e não há credenciais do Supabase Admin API configuradas. O `authMiddleware` captura o claim `email` do JWT de forma oportunista e best-effort a cada requisição autenticada — o e-mail de um usuário só fica conhecido depois que ele usa o app pelo menos uma vez após este recurso entrar no ar. Requer `EMAIL_FROM_ADDRESS` (identidade verificada no SES) e `AWS_REGION`. Diferente do Bedrock/S3, a falta deles **não** vira um 503: o erro é capturado por usuário dentro do laço do digest e só aparece como `emailsFailed` na resposta (os lembretes afetados são liberados para a próxima execução) — por isso o workflow agendado também falha quando esse contador é maior que zero.

**Web Push**: requer `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (gerar uma vez com `npx web-push generate-vapid-keys` e manter estável — trocar as chaves invalida toda inscrição já salva). Uma inscrição que o serviço de push reporta como definitivamente inválida (HTTP 404/410 — geralmente o usuário revogou a permissão ou desinstalou o navegador) é removida automaticamente na próxima tentativa de envio.

### Retenção de dados (LGPD Art. 6º III — minimização)
`access_logs` (trilha de auditoria) e `reminder_notifications` (guarda de idempotência do digest) não tinham nenhuma política de retenção — cresciam para sempre. O áudio dos relatos falados entra na mesma rotina, com uma janela própria.
- `POST /api/system/retention-cleanup` - **Não é uma rota de usuário**, mesmo padrão do `reminder-digest` acima: protegida pelo `cronAuthMiddleware` (header `X-Cron-Secret` comparado a `CRON_SECRET` em tempo constante), chamada por um agendador externo. Apaga linhas de `access_logs` mais antigas que `ACCESS_LOG_RETENTION_DAYS` (padrão: 180 dias) e de `reminder_notifications` mais antigas que `REMINDER_NOTIFICATION_RETENTION_DAYS` (padrão: 90 dias). Também apaga ditados (`voice_notes`) mais antigos que `VOICE_NOTE_RETENTION_DAYS` (padrão: 7 dias), junto com qualquer áudio abandonado deles, e expira o áudio dos relatos falados (ver abaixo): 30 dias após a gravação, o arquivo de áudio e o JSON bruto do Transcribe são apagados do S3 e as colunas correspondentes são zeradas — a transcrição e o relatório estruturado, que são o registro durável, permanecem. As colunas só são zeradas depois que o objeto realmente sai do bucket; se o S3 falhar, a linha fica como está e a próxima execução tenta de novo, em vez de perder a única referência ao arquivo. Linhas ainda em `transcribing` são puladas. Workflow semanal em `.github/workflows/retention-cleanup.yml`, reutilizando os mesmos secrets `BACKEND_URL`/`CRON_SECRET` do digest de lembretes.

### Metas estruturadas (PEI/terapêuticas)
- `GET /api/goals` - Listar metas (filtros: `childId`, `domain`, `status`)
- `POST /api/goals` - Criar meta (`domain`, `title`, `masteryCriteria?`, `baselineValue?`, `targetValue?`, `unit?`, `targetDate?`)
- `GET /api/goals/:id` - Detalhes
- `PATCH /api/goals/:id` - Atualizar
- `DELETE /api/goals/:id` - Remover (remove também os registros de progresso)
- `GET /api/goals/:goalId/progress` - Listar registros de progresso (mais recente primeiro)
- `POST /api/goals/:goalId/progress` - Registrar progresso (`recordedAt`, `value?`, `statusSnapshot?`, `therapySessionId?`)
- `GET /api/goals/:goalId/progress/summary` - Resumo: baseline, meta, último valor registrado e variação em relação ao baseline
- `DELETE /api/goals/:goalId/progress/:entryId` - Remover um registro de progresso

### Relatório consolidado e IA
- `GET /api/consolidated/summary?childId=&periodDays=90` - Agrega avaliações, terapia, medicamentos, comorbidades, marcos de desenvolvimento e planos educacionais de um período
- `POST /api/consolidated/shares` / `GET /api/consolidated/shares` / `DELETE /api/consolidated/shares/:id` - Link público (com expiração) do relatório consolidado
- `GET /api/consolidated/shared/:token` - Acesso público ao relatório consolidado via token (sem autenticação)
- `POST /api/consolidated/ai-summary` - Gera um resumo trimestral via IA (Bedrock) sem salvar (limite: 5/hora por usuário)
- `POST /api/consolidated/ai-summaries` - Gera **e salva** um resumo via IA, para comparar entre trimestres (limite: 5/hora por usuário)
- `GET /api/consolidated/ai-summaries?childId=&page=1&limit=50` - Histórico paginado de resumos salvos de uma criança (máx. 100 por página)
- `POST /api/consolidated/ai-question` - Body `{ childId, question, periodDays? }`: responde uma pergunta em linguagem livre com base nos mesmos dados do relatório consolidado (limite separado: 20/hora por usuário)
- `POST /api/consolidated/consultation-brief` - Body `{ childId, periodDays? }` (padrão: 60 dias). Gera uma pauta objetiva em tópicos para levar à consulta médica: o que mudou desde a última consulta, medicamentos/tratamentos atuais, e perguntas sugeridas para o médico. Não é salva (mesmo limite do `/ai-summary`: 5/hora por usuário)

### Busca global
- `GET /api/search?q=` - Busca por texto livre (mínimo 2 caracteres) em crianças (nome), registros diários (campo `notes`) e documentos (`title`/`description`), tudo escopado ao usuário autenticado (ou ao dono, se delegado). Retorna `{ children, logs, documents }`, até 8 resultados por categoria, cada um com o `childId`/nome da criança para dar contexto no resultado. Não busca o campo `data` (JSONB) estruturado dos registros diários — só o texto livre em `notes`.

## Cálculo de Pontuações

O sistema calcula automaticamente as pontuações brutas para cada seção do questionário:

1. Processamento Auditivo
2. Processamento Visual
3. Processamento Tátil
4. Processamento de Movimento
5. Processamento de Posição do Corpo
6. Processamento de Sensibilidade Oral
7. Respostas Socioemocionais
8. Respostas de Atenção

Além disso, calcula as pontuações por quadrante:
- Registro Aumentado (RA)
- Busca Sensorial (BS)
- Sensibilidade Sensorial (SS)
- Evitação Sensorial (ES)

## Licença

Este projeto está licenciado sob a licença MIT - consulte o arquivo LICENSE para obter detalhes.
