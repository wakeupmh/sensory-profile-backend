-- Índice que faltava, e índices que só custavam escrita.
--
-- O BehaviorInsightsService faz oito consultas por requisição, todas na forma
-- `user_id AND child_id AND log_type = 'abc' AND occurred_at >= ...`. Nenhum
-- índice tinha `log_type` em posição útil, então o planejador caía em
-- `idx_daily_logs_log_type` e descartava a maior parte do que lia.
--
-- Medido com 10.950 registros (3 crianças × 2 anos × 5/dia):
--   antes:  2.190 linhas lidas, 1.759 descartadas por filtro, 152 buffers, 0,81 ms
--   depois:   431 linhas lidas,     0 descartadas,             36 buffers, 0,24 ms
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_child_type_occurred
  ON daily_logs(user_id, child_id, log_type, occurred_at DESC);

-- Cada índice abaixo é PREFIXO ESTRITO de um composto que já existe, e o
-- Postgres usa um composto para consultas pelo prefixo — então nenhum deles
-- responde nada que o composto não responda. O que eles fazem é somar uma
-- escrita de B-tree por INSERT/UPDATE.
--
-- Só prefixos estritos entram aqui, de propósito: é uma propriedade que se
-- prova olhando as definições. Índices de baixa cardinalidade que *podem* ser
-- inúteis (`developmental_milestones.status`, `.category`,
-- `communication_logs.occurred_at`) ficaram, porque não os medi — derrubar
-- índice sem medida é como se chega neste estado.
DROP INDEX IF EXISTS idx_daily_logs_user_id;              -- ⊂ (user_id, child_id, occurred_at)
DROP INDEX IF EXISTS idx_daily_logs_child_id;             -- ⊂ (child_id, occurred_at)
DROP INDEX IF EXISTS idx_sensory_assessments_user_child;  -- ⊂ (user_id, child_id, assessment_date)
DROP INDEX IF EXISTS idx_medications_user_id;             -- ⊂ (user_id, child_id)
DROP INDEX IF EXISTS idx_medications_child_id;            -- ⊂ (child_id, active)
DROP INDEX IF EXISTS idx_communication_logs_user_id;      -- ⊂ (user_id, child_id, occurred_at)
DROP INDEX IF EXISTS idx_communication_logs_child_id;     -- ⊂ (child_id, occurred_at)
DROP INDEX IF EXISTS idx_developmental_milestones_user_id;  -- ⊂ (user_id, child_id, status)
DROP INDEX IF EXISTS idx_developmental_milestones_child_id; -- ⊂ (child_id, status, achieved_date)
DROP INDEX IF EXISTS idx_education_plans_user_id;         -- ⊂ (user_id, child_id)
DROP INDEX IF EXISTS idx_school_comms_user_id;            -- ⊂ (user_id, child_id, occurred_at)
DROP INDEX IF EXISTS idx_school_comms_child_id;           -- ⊂ (child_id, occurred_at)
DROP INDEX IF EXISTS idx_anamneses_user_id;               -- ⊂ (user_id, created_at)

-- `log_type` sozinho tem cinco valores na tabela inteira, então nunca foi
-- seletivo — e era justamente por ele que o planejador entrava na varredura
-- cara acima. Com o composto novo, não sobra consulta que o queira.
DROP INDEX IF EXISTS idx_daily_logs_log_type;
