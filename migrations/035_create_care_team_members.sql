-- Equipe de cuidado: o profissional que atende a criança (fono, psicologia,
-- TO, AT, ...) entra por CONVITE DO RESPONSÁVEL e ganha um acesso concedido,
-- revogável, sempre nomeado por quem é dono do dado.
--
-- Por que tabela própria e não `child_shares` (profissional + escopos) ou
-- `caregiver_shares` (co-cuidador com acesso total):
--   * `child_shares` liga uma criança a um registro de `professionals`, que é
--     uma agenda PRIVADA de cada responsável — dois responsáveis do mesmo
--     fonoaudiólogo criam duas linhas sem relação nenhuma entre si, então não
--     existe "as crianças deste profissional". É essa ausência que torna o
--     login único do profissional inviável hoje.
--   * `caregiver_shares` concede tudo, sem papel e sem revogação preservada.
-- Aqui a concessão é endereçada ao `sub` do próprio profissional
-- (`member_user_id`), então uma conta serve várias crianças, e o fim da
-- relação vira linha na trilha em vez de sumir.
--
-- O convite segue o ciclo já usado por `professionals` e `caregiver_shares`:
-- token de uso único, validade de 14 dias, aceite feito já autenticado.
CREATE TABLE care_team_members (
  id                     UUID PRIMARY KEY,
  child_id               UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,

  -- `sub` do Supabase de quem aceitou. NULL enquanto o convite está pendente:
  -- no momento do convite o responsável só sabe o nome de quem convidou, não
  -- a identidade da conta que vai aceitar.
  member_user_id         TEXT NULL,
  member_name            TEXT NOT NULL,
  role                   TEXT NOT NULL CHECK (role IN (
                           'fonoaudiologia',
                           'psicologia',
                           'terapia_ocupacional',
                           'acompanhante_terapeutico',
                           'educacao_fisica',
                           'fisioterapia',
                           'psicopedagogia',
                           'outro'
                         )),

  -- SEMPRE o dono da criança (`children.user_id`). Não é "quem clicou": um
  -- cuidador delegado não concede acesso a criança que não é dele, e clínica
  -- não existe na fase 1.
  granted_by_user_id     TEXT NOT NULL,

  invitation_token       TEXT UNIQUE,
  invitation_expires_at  TIMESTAMPTZ,
  accepted_at            TIMESTAMPTZ,

  -- Revogação é SOFT. Apagar a linha destruiria justamente o dado que uma
  -- auditoria precisa: quando a relação começou e quando terminou.
  revoked_at             TIMESTAMPTZ,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Um profissional só tem UMA participação viva por criança. Parcial de
-- propósito: convites pendentes (member_user_id NULL) podem coexistir, e uma
-- participação revogada não impede que o responsável convide a mesma pessoa
-- de novo mais tarde.
CREATE UNIQUE INDEX idx_care_team_members_child_member_active
  ON care_team_members(child_id, member_user_id)
  WHERE member_user_id IS NOT NULL AND revoked_at IS NULL;

-- O caseload: "quais crianças este profissional atende". É a consulta que faz
-- um login servir muitas crianças, e a única que parte do profissional.
CREATE INDEX idx_care_team_members_member_active
  ON care_team_members(member_user_id)
  WHERE revoked_at IS NULL AND accepted_at IS NOT NULL;

-- A listagem da equipe de uma criança. Nenhum índice acima a atende: o único
-- que começa em `child_id` ignora as linhas pendentes, que são exatamente as
-- que o responsável abre a tela para ver.
CREATE INDEX idx_care_team_members_child
  ON care_team_members(child_id);

CREATE OR REPLACE TRIGGER trg_care_team_members_updated_at
  BEFORE UPDATE ON care_team_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
