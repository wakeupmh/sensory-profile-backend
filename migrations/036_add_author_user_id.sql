-- Fase 1 do care team: quem escreveu a linha, quando pode ser alguém além
-- do dono. Até aqui, toda tabela clínica tinha só `user_id` — que é do
-- RESPONSÁVEL e continua sendo (`children.user_id` não muda de significado,
-- ver CONTRACT.md). Com o profissional podendo escrever no prontuário de
-- uma criança sob concessão, falta um lugar para registrar quem de fato
-- digitou aquela linha.
--
-- NULLABLE, SEM DEFAULT, SEM BACKFILL. Preencher com `user_id` para as
-- linhas existentes afirmaria uma autoria que nunca foi registrada — nunca
-- soubemos, para essas linhas, se foi o responsável ou alguém mais (o
-- recurso não existia). NULL aqui significa "desconhecido / anterior a esta
-- mudança", não "foi o responsável". `BaseDomainService.create` só grava
-- este campo quando quem age difere de quem é dono (ver
-- requestScope.actingUserId) — quando o próprio responsável escreve,
-- author_user_id fica NULL também, de propósito: assim "não-nulo" continua
-- querendo dizer de forma confiável "outra pessoa escreveu isto".
--
-- `professional_notes` já tem `author_user_id` desde a migration 024 — mas
-- lá a coluna é NOT NULL e é a razão de existir da tabela (uma nota SEM
-- autor não faz sentido), não um metadado opcional sobre uma linha que
-- continuaria significando algo sem ela. Por isso fica de fora daqui.
ALTER TABLE communication_logs        ADD COLUMN IF NOT EXISTS author_user_id TEXT NULL;
ALTER TABLE comorbidities             ADD COLUMN IF NOT EXISTS author_user_id TEXT NULL;
ALTER TABLE daily_logs                ADD COLUMN IF NOT EXISTS author_user_id TEXT NULL;
ALTER TABLE daily_reports             ADD COLUMN IF NOT EXISTS author_user_id TEXT NULL;
ALTER TABLE developmental_milestones  ADD COLUMN IF NOT EXISTS author_user_id TEXT NULL;
ALTER TABLE documents                 ADD COLUMN IF NOT EXISTS author_user_id TEXT NULL;
ALTER TABLE education_plans           ADD COLUMN IF NOT EXISTS author_user_id TEXT NULL;
ALTER TABLE goals                     ADD COLUMN IF NOT EXISTS author_user_id TEXT NULL;
ALTER TABLE goal_progress_entries     ADD COLUMN IF NOT EXISTS author_user_id TEXT NULL;
ALTER TABLE medical_appointments      ADD COLUMN IF NOT EXISTS author_user_id TEXT NULL;
ALTER TABLE medications               ADD COLUMN IF NOT EXISTS author_user_id TEXT NULL;
ALTER TABLE reminders                 ADD COLUMN IF NOT EXISTS author_user_id TEXT NULL;
ALTER TABLE school_communications     ADD COLUMN IF NOT EXISTS author_user_id TEXT NULL;
ALTER TABLE therapy_sessions          ADD COLUMN IF NOT EXISTS author_user_id TEXT NULL;
-- professional_notes: JÁ TEM author_user_id (NOT NULL, migration 024). Sem
-- ALTER aqui de propósito — ver comentário acima.

-- Índice só onde alguém de fato vai filtrar/agrupar por autor. As outras
-- doze tabelas ganham a coluna sem índice: "quais linhas este profissional
-- escreveu" hoje só importa para daily_logs e therapy_sessions (registro do
-- dia a dia, que é o grosso do que um profissional escreve) e
-- professional_notes (a tela do responsável "notas da equipe" já filtra por
-- author_user_id). Parcial porque a esmagadora maioria das linhas continua
-- com author_user_id NULL — o dono escrevendo o próprio dado.
CREATE INDEX IF NOT EXISTS idx_daily_logs_author_user_id
  ON daily_logs(author_user_id) WHERE author_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_author_user_id
  ON therapy_sessions(author_user_id) WHERE author_user_id IS NOT NULL;
-- Aqui a cláusula WHERE não filtra nada de fato (author_user_id é NOT NULL
-- nesta tabela) — fica só para a definição casar visualmente com as outras
-- duas acima; o índice cobre a tabela inteira.
CREATE INDEX IF NOT EXISTS idx_professional_notes_author_user_id
  ON professional_notes(author_user_id) WHERE author_user_id IS NOT NULL;
