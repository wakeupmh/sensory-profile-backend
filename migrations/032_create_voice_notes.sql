-- Ditado avulso: o cuidador fala em vez de digitar, em qualquer campo de texto
-- do app (observação de um registro, pergunta para a IA, etc). O áudio é
-- transcrito e o texto volta para o campo.
--
-- Por que não reusar daily_reports: aquilo é *o relato do dia* — pertence a uma
-- criança, tem data, é guardado e reouvido. Isto é um meio para um fim: o áudio
-- existe só até virar texto e é apagado no mesmo instante (ver VoiceNoteService),
-- por isso não tem `audio_expires_at` nem entra no job de retenção.
--
-- Sem child_id de propósito: o ditado é da conta, não da criança — o mesmo botão
-- serve num campo que ainda nem escolheu criança.
CREATE TABLE voice_notes (
  id                  UUID PRIMARY KEY,
  user_id             TEXT NOT NULL,

  -- transcribing: job em andamento | ready: texto pronto | failed: `error` explica
  status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'transcribing', 'ready', 'failed')),

  -- Zerada assim que a transcrição sai: o áudio de um ditado não é registro,
  -- é insumo descartável.
  audio_storage_key   TEXT NULL UNIQUE,
  audio_mime_type     VARCHAR(150) NULL,

  transcribe_job_name TEXT NULL UNIQUE,
  transcript_key      TEXT NULL,
  transcript          TEXT NULL,
  error               TEXT NULL,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_voice_notes_user_id ON voice_notes(user_id);
-- Usado pela limpeza de ditados abandonados (draft/failed que ninguém buscou).
CREATE INDEX idx_voice_notes_created_at ON voice_notes(created_at);

CREATE OR REPLACE TRIGGER trg_voice_notes_updated_at
  BEFORE UPDATE ON voice_notes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
