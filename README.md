# Backend do Perfil Sensorial 2

Este é o backend para a aplicação de Perfil Sensorial 2, desenvolvido para armazenar e processar dados de avaliações sensoriais de crianças entre 3 e 14 anos.

## Tecnologias Utilizadas

- Node.js com Express.js
- TypeScript
- `pg` (cliente PostgreSQL puro, sem ORM) + SQL parametrizado
- PostgreSQL
- Supabase Auth (JWT verificado via JWKS remoto, biblioteca `jose`) — não há tabela local de usuários nem rotas de registro/login
- AWS SDK v3 (Bedrock para resumos por IA, S3 para documentos, SES para e-mails de lembrete)
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
├── .github/workflows/ci.yml   # CI: typecheck + migrações + testes
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
   - AWS_REGION, AWS_S3_BUCKET: resumos por IA (Bedrock) e armazenamento de documentos (S3)
   - EMAIL_FROM_ADDRESS, CRON_SECRET: entrega ativa de lembretes por e-mail (SES)
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

### Lembretes
- `GET /api/reminders` - Listar lembretes criados manualmente (filtros: `childId`, `status`)
- `POST /api/reminders` - Criar lembrete (`title`, `dueAt`, `notes?`)
- `GET /api/reminders/:id` - Detalhes
- `PATCH /api/reminders/:id` - Atualizar (inclui marcar `status` como `done`/`dismissed`)
- `DELETE /api/reminders/:id` - Remover
- `GET /api/reminders/upcoming?childId=&days=14` - Combina os lembretes manuais pendentes com datas já registradas em outras partes do sistema e que ainda não tinham nenhum lembrete associado: retorno médico (`medical_appointments.follow_up_date`), revisão/fim de PEI (`education_plans.review_date`/`end_date`), retorno escolar (`school_communications.follow_up_date`), meta de marco de desenvolvimento (`developmental_milestones.target_date`), fim de medicação ativa (`medications.end_date`) e validade de documento (`documents.expires_at`)

### Entrega ativa de lembretes (e-mail)
O feed acima é *pull* — o app precisa ser aberto para ver o que vence. Isto adiciona entrega *push* por e-mail:
- `GET /api/notifications/preferences` - Ver e-mail conhecido e se o envio de lembretes está ativado
- `PATCH /api/notifications/preferences` - Body `{ reminderEmailsEnabled: boolean }` - Ativar/desativar o envio
- `POST /api/system/reminder-digest` - **Não é uma rota de usuário.** Protegida por header `X-Cron-Secret` (comparado a `CRON_SECRET`), não por sessão. Deve ser chamada periodicamente (ex.: diariamente) por um agendador externo (Render Cron Job, GitHub Actions schedule, etc.). Para cada usuário com e-mail conhecido e notificações ativadas, busca os lembretes que vencem nos próximos 3 dias, envia um e-mail único por usuário e nunca reenvia o mesmo lembrete (idempotente via `reminder_notifications`)

**Como o e-mail do usuário é descoberto**: não existe tabela local de usuários (a autenticação é 100% Supabase) e não há credenciais do Supabase Admin API configuradas. O `authMiddleware` captura o claim `email` do JWT de forma oportunista e best-effort a cada requisição autenticada — o e-mail de um usuário só fica conhecido depois que ele usa o app pelo menos uma vez após este recurso entrar no ar. Requer `EMAIL_FROM_ADDRESS` (identidade verificada no SES) e `AWS_REGION`; sem eles, o disparo retorna 503 (mesmo padrão do Bedrock/S3).

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
