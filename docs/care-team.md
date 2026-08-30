# Equipe de cuidado

O responsável convida um profissional — fonoaudiologia, psicologia, terapia
ocupacional, acompanhante terapêutico, educação física, fisioterapia,
psicopedagogia — para a equipe de UMA criança. O profissional aceita com o
próprio login e passa a ler e escrever os dados das crianças concedidas. Uma
conta serve várias famílias.

Este documento registra as decisões que não são óbvias no código, e
principalmente as que é perigoso desfazer sem entender.

## O dado é sempre do responsável

`children.user_id` continua sendo o dono e não muda de significado. O
profissional recebe um **acesso concedido**, revogável, sempre concedido por
quem é dono do dado — nunca por uma clínica, nunca por um delegado.

É por isso que todo endpoint de administração da equipe usa
`requireOwnUserId`, e não `requireUserId`. O segundo resolve a delegação: sob
`X-Delegate-Child-Id` ele devolve o `sub` do DONO, e com ele um cuidador
delegado poderia convidar profissional para uma criança que não é dele.
Conceder acesso é ato do titular.

## Por que a concessão e não a criança como tenant

Havia dois desenhos possíveis:

- **criança como tenant**: a autorização passa a ser "esta requisição pode ver
  esta criança", e as consultas filtram por `child_id`;
- **concessão** (o escolhido): `children.user_id` continua sendo o dono, e a
  concessão entra como disjunção no predicado que já existia.

A diferença que decidiu é o modo de falha. Esquecer um filtro no primeiro
desenho mostra dados demais; no segundo, mostra de menos. Este repositório já
vazou entre crianças três vezes — a mais recente foi um `UPDATE` que endereçava
o registro só por `id` e `user_id`. Falhar fechado não é uma preferência
estética aqui.

## Onde a autorização mora

Em dois lugares, e só neles:

- `careTeamScopeMiddleware` **descobre** a lista de crianças concedidas, uma
  vez por requisição, e corre o resto dentro do escopo;
- `buildWhere` / `scopedById` / `scopedChildRead`, em `queryUtils.ts`,
  **aplicam** o predicado.

A alternativa — cada consulta resolvendo a concessão por conta própria —
penduraria uma subconsulta a `care_team_members` em cada uma das ~160
instruções do app, e criaria 160 lugares de onde a autorização pode ser
esquecida. `delegationScopeCoverage.int.test.ts` guarda essa fronteira.

### Invariantes que os testes cobram

1. **Responsável sem equipe não muda de comportamento.** Com a lista vazia, o
   SQL emitido é idêntico, letra por letra, ao de antes da feature existir.
   É a maioria absoluta das contas, e a asserção é sobre a string de SQL.
2. **A delegação estreita, nunca alarga.** Sob delegação a concessão não entra
   no predicado: a requisição já está presa a uma criança e corre sob o
   `user_id` do dono, então a disjunção não alcançaria linha nenhuma a mais —
   só afrouxaria o predicado do dono por nada.
3. **Ler a criança não é mexer na criança.** `scopedChildRead` existe separado
   de `scopedById` porque `PgChildRepository` usa o mesmo helper para LER e
   para APAGAR. Ensinar a concessão dentro de `scopedById` daria a um
   profissional o poder de apagar a criança de uma família. `update` e
   `delete` continuam só do dono.
4. **O middleware precisa estar montado.** Ele já ficou pronto e sem montagem
   nenhuma, e nada quebrou: o profissional simplesmente não enxergava nada.
   `careTeamScopeMounted.test.ts` cobra a montagem em todo router que monta
   delegação, e registra as exceções com o motivo.

## Autoria

`author_user_id` é preenchido a partir de `currentScope().actingUserId`, e só
quando difere do dono — assim "não nulo" significa mesmo "outra pessoa
escreveu isto". Nunca houve backfill: afirmar uma autoria que nunca foi
registrada seria pior do que não ter o dado. `NULL` significa "desconhecido,
ou anterior a esta mudança".

Na eliminação de conta (LGPD Art. 18 VI), a autoria de um profissional em
dados de OUTRAS famílias é zerada, e o registro clínico fica: ele é da
família, que não pediu eliminação nenhuma. O guard de cobertura classifica
pares `(tabela, coluna)`, e não tabelas — classificar por tabela deixava a
coluna nova passar despercebida, que é exatamente como essa lacuna apareceu.

## O que a fase 1 não inclui

Clínicas, organizações, papel de administrador, permissão por disciplina,
agendamento e mensageria. Um membro da equipe alcança os dados clínicos das
crianças concedidas, e nada além disso — a exportação e a eliminação da conta
ficam deliberadamente fora da concessão.
