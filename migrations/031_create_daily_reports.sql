-- Relato falado do dia: o cuidador grava um áudio contando como foi o dia da
-- criança, o áudio é transcrito (AWS Transcribe) e o texto vira um relatório
-- estruturado (Bedrock). Uma linha por criança por dia.
--
-- Por que tabela própria e não um `log_type` novo em daily_logs: daily_logs
-- modela *eventos* (várias por dia, cada uma com hora), enquanto isto é um
-- resumo do dia inteiro — no máximo um por criança por data, com um ciclo de
-- vida assíncrono (gravando -> transcrevendo -> pronto) que os logs não têm.
CREATE TABLE daily_reports (
  id                  UUID PRIMARY KEY,
  user_id             TEXT NOT NULL,
  child_id            UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  report_date         DATE NOT NULL,

  -- draft:      linha criada, cliente ainda vai subir o áudio
  -- transcribing: job do Transcribe em andamento
  -- ready:      transcrição + estruturação concluídas
  -- failed:     job falhou; `error` explica
  status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'transcribing', 'ready', 'failed')),

  -- Objeto no S3 com o áudio original. Mantido por um tempo (audio_expires_at)
  -- para o cuidador reouvir ou para reprocessar uma transcrição ruim; o job de
  -- retenção apaga o objeto e zera estas colunas depois disso.
  audio_storage_key   TEXT NULL UNIQUE,
  audio_mime_type     VARCHAR(150) NULL,
  audio_expires_at    TIMESTAMPTZ NULL,

  -- Nome do job no Transcribe (único na conta) e onde ele grava o JSON de saída.
  transcribe_job_name TEXT NULL UNIQUE,
  transcript_key      TEXT NULL,

  transcript          TEXT NULL,
  -- Saída da IA: resumo, pontos de atenção e os registros estruturados
  -- sugeridos (humor/sono/alimentação/etc.) para o cuidador confirmar.
  structured          JSONB NULL,
  error               TEXT NULL,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Um relato por criança por dia: regravar substitui o do dia, não empilha.
  UNIQUE (child_id, report_date)
);

CREATE INDEX idx_daily_reports_user_id ON daily_reports(user_id);
CREATE INDEX idx_daily_reports_child_date ON daily_reports(child_id, report_date DESC);
-- Usado pelo job de retenção para achar áudios vencidos sem varrer a tabela.
CREATE INDEX idx_daily_reports_audio_expiry ON daily_reports(audio_expires_at)
  WHERE audio_storage_key IS NOT NULL;

CREATE OR REPLACE TRIGGER trg_daily_reports_updated_at
  BEFORE UPDATE ON daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
