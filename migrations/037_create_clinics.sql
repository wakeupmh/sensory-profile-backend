-- Clínicas e seu quadro de profissionais.
--
-- O QUE ESTA TABELA NÃO FAZ: dar acesso a dado nenhum.
--
-- O princípio da equipe de cuidado continua valendo sem exceção — o dado é do
-- responsável, e quem concede acesso é ele, a um profissional com nome. Uma
-- clínica nunca vira caminho de acesso: pertencer a uma clínica não alcança
-- criança nenhuma, e o admin não herda o que os profissionais dele alcançam.
--
-- Por isso `clinic_members` não tem `child_id` e não aparece em
-- `CHILD_SCOPED_TABLES`. Ela responde "quem trabalha aqui", e só.
--
-- A consequência prática, que é deliberada: o admin vê o quadro e QUANTAS
-- crianças cada profissional atende, nunca QUAIS. O responsável convidou uma
-- pessoa, não uma organização — a clínica saber o nome da criança seria mais
-- do que ele concedeu.

CREATE TABLE clinics (
  id                  UUID PRIMARY KEY,
  name                TEXT NOT NULL,
  -- Quem criou vira o primeiro admin. Guardado para a trilha; a autorização
  -- de verdade lê `clinic_members`, porque um criador pode sair depois.
  --
  -- NULLABLE de propósito: quando essa pessoa apaga a conta (LGPD Art. 18 VI)
  -- o campo é zerado e a clínica continua existindo. Nascer NOT NULL criaria
  -- um identificador impossível de remover sem apagar a clínica dos outros —
  -- o problema que `professional_notes.author_user_id` tem hoje.
  created_by_user_id  TEXT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE clinic_members (
  id                    UUID PRIMARY KEY,
  clinic_id             UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  -- `sub` do Supabase; NULL até aceitar o convite.
  member_user_id        TEXT NULL,
  member_name           TEXT NOT NULL,
  role                  TEXT NOT NULL CHECK (role IN ('admin', 'profissional')),
  -- Nullable pelo mesmo motivo de `clinics.created_by_user_id`.
  invited_by_user_id    TEXT NULL,
  invitation_token      TEXT UNIQUE,
  invitation_expires_at TIMESTAMPTZ,
  accepted_at           TIMESTAMPTZ,
  -- Saída é SOFT, como na equipe de cuidado: a linha fica para a trilha saber
  -- quando a pessoa entrou e quando saiu.
  revoked_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Uma pessoa entra uma vez por clínica enquanto estiver ativa. Parcial porque
-- as linhas revogadas ficam, e ela pode ser convidada de novo depois.
CREATE UNIQUE INDEX idx_clinic_members_unique_active
  ON clinic_members(clinic_id, member_user_id)
  WHERE member_user_id IS NOT NULL AND revoked_at IS NULL;

-- "De quais clínicas eu faço parte" — a consulta de toda requisição da tela.
CREATE INDEX idx_clinic_members_member
  ON clinic_members(member_user_id)
  WHERE member_user_id IS NOT NULL AND revoked_at IS NULL AND accepted_at IS NOT NULL;

-- O quadro de uma clínica, incluindo os convites ainda pendentes.
CREATE INDEX idx_clinic_members_clinic ON clinic_members(clinic_id);

CREATE UNIQUE INDEX idx_clinic_members_invitation_token
  ON clinic_members(invitation_token)
  WHERE invitation_token IS NOT NULL;
