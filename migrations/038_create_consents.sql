-- Consentimento do responsável para o tratamento de dados de saúde da
-- criança (LGPD Art. 11 e 14). Uma linha por versão do termo aceita: quando o
-- termo muda, o aceite anterior continua registrado e o novo vira outra linha.
CREATE TABLE consents (
  id          UUID PRIMARY KEY,
  user_id     TEXT NOT NULL,
  version     TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, version)
);
