/**
 * Nenhuma entidade pode serializar um segredo.
 *
 * Hoje isso é só convenção: `Document.toJSON` omite `storageKey`,
 * `PushSubscription.toJSON` omite as chaves cripto, `CareTeamMember.toListView`
 * omite o token do convite — cada um por escrito, à mão, e nada impede que a
 * próxima pessoa que acrescentar um campo passe a devolvê-lo. A omissão é uma
 * propriedade de segurança mantida por atenção, que é a forma que ela tem de
 * se perder.
 *
 * Este teste lê o `Props` de cada entidade, instancia com valores marcados e
 * inspeciona TUDO que ela devolve. Não conhece as entidades uma a uma: uma
 * entidade nova entra na varredura sozinha, e um campo sensível novo é
 * declarado em SENSITIVE_FIELDS abaixo.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const ENTITIES_DIR = join(__dirname, '..');

/**
 * Campos que NUNCA podem sair numa resposta. A lista é por nome porque é
 * assim que eles reaparecem: alguém acrescenta `storageKey` a uma entidade
 * nova e repete o padrão do vizinho sem reparar no que está repetindo.
 */
const SENSITIVE_FIELDS = [
  'storageKey',      // chave do S3 — dá acesso ao objeto por fora da API
  'p256dhKey',       // cripto do push
  'authKey',         // cripto do push
  'invitationToken', // token de uso único de convite
];

/**
 * As ÚNICAS views autorizadas a devolver um campo sensível, com o motivo.
 *
 * Um token de convite precisa sair uma vez — senão o responsável não tem como
 * repassar o link a quem convidou. O que não pode é sair de novo a cada
 * listagem: aí ele passa a viver no cache, no histórico e em todo log de
 * rede, e quem conseguir ler a listagem aceita um convite que não é dele.
 *
 * A chave aqui é `Entidade.metodo`. Acrescentar uma linha é uma decisão
 * consciente e revisável; é esse o ponto.
 */
const ALLOWED_EXPOSURES = new Map<string, string>([
  ['CareTeamMember.toOwnerView', 'resposta da criação do convite — a listagem usa toListView()'],
  ['CaregiverShare.toOwnerView', 'resposta da criação do convite — a listagem usa toListView()'],
  ['Professional.toOwnerView', 'criação, consulta por id e rotação — a listagem usa toListView()'],
]);

interface EntityModule {
  name: string;
  ctor: new (props: Record<string, unknown>) => object;
  propNames: string[];
}

/** Lê os nomes de campo do `interface ...Props` do próprio arquivo. */
function propNamesOf(source: string): string[] {
  const match = source.match(/export interface \w+Props \{([\s\S]*?)\n\}/);
  if (!match) return [];
  return [...match[1].matchAll(/^\s*(?:\/\*[\s\S]*?\*\/\s*)?(\w+)\??:/gm)].map((m) => m[1]);
}

function loadEntities(): EntityModule[] {
  const out: EntityModule[] = [];
  for (const file of readdirSync(ENTITIES_DIR).filter((f) => f.endsWith('.ts'))) {
    const source = readFileSync(join(ENTITIES_DIR, file), 'utf8');
    const propNames = propNamesOf(source);
    if (propNames.length === 0) continue;

    const name = file.replace(/\.ts$/, '');
    // A varredura é o ponto do teste: carregar por nome descoberto em disco
    // é o que faz uma entidade nova entrar sozinha.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const mod = require(join(ENTITIES_DIR, name)) as Record<string, unknown>;
    const ctor = mod[name];
    if (typeof ctor !== 'function') continue;
    out.push({ name, ctor: ctor as EntityModule['ctor'], propNames });
  }
  return out;
}

/** Valor marcado por campo, para reconhecê-lo em qualquer canto da saída. */
function markedProps(propNames: string[]): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const p of propNames) {
    if (p.endsWith('At') || p === 'createdAt' || p === 'updatedAt') props[p] = new Date(0);
    else props[p] = `<<${p}>>`;
  }
  return props;
}

/**
 * Todo método sem argumentos que devolve um objeto — toJSON, toListView, ...
 *
 * Sobe a cadeia de protótipos, e não só o protótipo da própria classe: desde
 * que `toJSON` passou a vir de `Entity`, olhar um nível só não encontrava
 * serializador NENHUM nas 24 entidades convertidas, e este teste passava sem
 * inspecionar nada. Ele só foi pego porque a mutação (reexpor `storageKey`)
 * continuou verde.
 */
function serialisers(instance: object): string[] {
  const found = new Set<string>();
  let proto = Object.getPrototypeOf(instance) as object | null;
  while (proto && proto !== Object.prototype) {
    for (const m of Object.getOwnPropertyNames(proto)) {
      if (m === 'constructor' || !/^to[A-Z]/.test(m)) continue;
      const fn = (instance as Record<string, unknown>)[m];
      if (typeof fn === 'function' && (fn as () => unknown).length === 0) found.add(m);
    }
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  return [...found];
}

const entities = loadEntities();

describe('nenhuma entidade serializa um segredo', () => {
  test('a varredura encontrou entidades (senão este teste é um carimbo)', () => {
    expect(entities.length).toBeGreaterThan(20);
  });

  test.each(entities.map((e) => [e.name, e] as const))(
    '%s não devolve nenhum campo sensível',
    (_name, entity) => {
      const instance = new entity.ctor(markedProps(entity.propNames));
      const sensitiveHere = SENSITIVE_FIELDS.filter((f) => entity.propNames.includes(f));
      if (sensitiveHere.length === 0) return;

      for (const method of serialisers(instance)) {
        if (ALLOWED_EXPOSURES.has(`${entity.name}.${method}`)) continue;
        const output = (instance as unknown as Record<string, () => unknown>)[method]();
        const serialised = JSON.stringify(output);
        for (const field of sensitiveHere) {
          // Confere pelo NOME da chave e pelo VALOR marcado: renomear a chave
          // na saída não é desculpa para o segredo sair junto.
          expect(serialised).not.toContain(`"${field}"`);
          expect(serialised).not.toContain(`<<${field}>>`);
        }
      }
    },
  );

  test('toda exceção declarada ainda existe e ainda é necessária', () => {
    const problemas: string[] = [];
    for (const [key] of ALLOWED_EXPOSURES) {
      const [entityName, method] = key.split('.');
      const entity = entities.find((e) => e.name === entityName);
      if (!entity) {
        problemas.push(`${key}: entidade não existe mais`);
        continue;
      }
      const instance = new entity.ctor(markedProps(entity.propNames));
      if (typeof (instance as unknown as Record<string, unknown>)[method] !== 'function') {
        problemas.push(`${key}: método não existe mais`);
        continue;
      }
      // Se a view parou de expor o campo sensível, a exceção virou ruído e
      // some daqui — senão ela vira licença esquecida para expor de novo.
      const output = (instance as unknown as Record<string, () => unknown>)[method]();
      const serialised = JSON.stringify(output);
      const aindaExpoe = SENSITIVE_FIELDS.some(
        (f) => entity.propNames.includes(f) && serialised.includes(`"${f}"`),
      );
      if (!aindaExpoe) problemas.push(`${key}: não expõe mais nada sensível — remova a exceção`);
    }
    expect(problemas).toEqual([]);
  });
});
