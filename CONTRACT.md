# Contrato do care team — fase 1 (fixo, não negociar)

## Princípio
O DADO É SEMPRE DO RESPONSÁVEL. `children.user_id` continua sendo o dono e
não muda de significado. O profissional recebe um ACESSO CONCEDIDO, revogável,
sempre concedido pelo responsável — nunca por uma clínica, nunca por um
delegado. Clínicas/organizações NÃO entram na fase 1.

## Tabela (migration 035)
CREATE TABLE care_team_members (
  id UUID PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  member_user_id TEXT NULL,              -- sub do Supabase; NULL até aceitar
  member_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('fonoaudiologia','psicologia','terapia_ocupacional','acompanhante_terapeutico','educacao_fisica','fisioterapia','psicopedagogia','outro')),
  granted_by_user_id TEXT NOT NULL,      -- SEMPRE o dono da criança
  invitation_token TEXT UNIQUE,
  invitation_expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,                -- revogação é SOFT (preserva a trilha)
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX ... ON care_team_members(child_id, member_user_id) WHERE member_user_id IS NOT NULL AND revoked_at IS NULL;
CREATE INDEX ... ON care_team_members(member_user_id) WHERE revoked_at IS NULL AND accepted_at IS NOT NULL;

## Escopo da requisição (requestScope.ts) — assinatura fixa
export interface RequestScope {
  restrictedToChildId?: string;   // já existe, NÃO remover
  actingUserId?: string;          // quem realmente está agindo (autoria)
  careTeamChildIds?: string[];    // crianças acessíveis por concessão
}

## Predicado (queryUtils.ts) — compatibilidade obrigatória
buildWhere e scopedById MANTÊM as assinaturas atuais. Quando
`careTeamChildIds` está presente e a tabela é child-scoped, o predicado vira
`(user_id = $1 OR child_id = ANY($n::uuid[]))`. Com a lista vazia, o SQL
emitido tem de ser IDÊNTICO ao de hoje — conta de responsável sem equipe não
pode mudar de comportamento. Isso é testável e será testado.

## Autoria
`author_user_id TEXT NULL` nas tabelas clínicas escrevíveis. NUNCA fazer
backfill com `user_id` — isso afirmaria uma autoria que nunca foi registrada.
NULL significa "desconhecido / anterior à mudança".

## Fase 1 NÃO inclui
clínicas, organizações, papel de admin, permissões por disciplina,
agendamento, mensageria.
