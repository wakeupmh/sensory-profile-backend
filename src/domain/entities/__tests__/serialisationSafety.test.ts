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
  'token',           // token de capacidade de um compartilhamento
  'shareToken',      // idem, na anamnese
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
  ['CareTeamMember.toOwnerView.invitationToken', 'resposta da criação do convite — a listagem usa toListView()'],
  ['CaregiverShare.toOwnerView.invitationToken', 'resposta da criação do convite — a listagem usa toListView()'],
  ['Professional.toOwnerView.invitationToken', 'criação, consulta por id e rotação — a listagem usa toListView()'],

  // ABERTOS, e declarados para não ficarem invisíveis. Nos dois casos a tela
  // monta a URL do compartilhamento a partir do token que veio NA LISTAGEM, e
  // não existe endpoint de consulta por id nem de rotação para servir de
  // alternativa. Fechar aqui é decisão de produto (ou some o "copiar link"
  // dos compartilhamentos existentes, ou eles ganham rotação), não um ajuste
  // que caiba num refactor. Enquanto isso, a listagem devolve o token vivo de
  // todo compartilhamento.
  ['ReportShare.toJSON.token', 'ABERTO: SharePanel monta a URL a partir da listagem; sem rotação nem get-by-id'],
  ['Anamnese.toJSON.shareToken', 'ABERTO: mesma forma que ReportShare'],
]);

interface EntityModule {
  name: string;
  ctor: new (props: Record<string, unknown>) => object;
  propNames: string[];
}

/**
 * Lê os nomes de campo de TODAS as `interface ...Props` do arquivo.
 *
 * Cada tolerância aqui é um buraco que já se abriu numa revisão: a primeira
 * versão parava na primeira interface, não entendia `extends`, não entendia
 * chave de campo `readonly` nem entre aspas — e um campo não reconhecido não
 * entra na varredura, ou seja, some sem falhar. Escrever
 * `readonly storageKey: string` bastava para a entidade passar limpa expondo
 * a chave do S3.
 */
function propNamesOf(source: string): string[] {
  const interfaces = [...source.matchAll(/export interface \w+Props\b[^{]*\{([\s\S]*?)\n\}/g)];
  const names: string[] = [];
  for (const iface of interfaces) {
    for (const field of iface[1].matchAll(
      /(?:^|\n)\s*(?:\/\*[\s\S]*?\*\/\s*)?(?:readonly\s+)?['"`]?(\w+)['"`]?\??\s*:/g,
    )) {
      names.push(field[1]);
    }
  }
  return [...new Set(names)];
}

/**
 * Arquivos sem `interface ...Props`, com o motivo. Ficar de fora da varredura
 * tem de ser uma decisão escrita: uma entidade pulada é indistinguível de uma
 * entidade aprovada.
 */
const NOT_PROPS_SHAPED = new Map<string, string>([
  ['Entity', 'é a própria base'],
  ['Assessment', 'recebe os campos por argumento de construtor, não por um objeto Props'],
  ['Response', 'idem'],
]);

const skipped: string[] = [];

function loadEntities(): EntityModule[] {
  const out: EntityModule[] = [];
  for (const file of readdirSync(ENTITIES_DIR).filter((f) => f.endsWith('.ts'))) {
    const name = file.replace(/\.ts$/, '');
    const source = readFileSync(join(ENTITIES_DIR, file), 'utf8');
    const propNames = propNamesOf(source);
    if (propNames.length === 0) {
      if (!NOT_PROPS_SHAPED.has(name)) skipped.push(`${name}: nenhuma interface Props reconhecida`);
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const mod = require(join(ENTITIES_DIR, name)) as Record<string, unknown>;

    // TODA classe exportada, e não `mod[nomeDoArquivo]`. `ChildShare.ts`
    // exporta `ChildShareGrant`, e casar pelo nome do arquivo o descartava em
    // silêncio — a varredura dizia 27 arquivos e não afirmava nada sobre ele.
    const ctors = Object.entries(mod).filter(
      ([, value]) => typeof value === 'function' && /^\s*class\s/.test(String(value)),
    );
    if (ctors.length === 0) {
      skipped.push(`${name}: nenhuma classe exportada`);
      continue;
    }
    for (const [exportName, ctor] of ctors) {
      out.push({ name: exportName, ctor: ctor as EntityModule['ctor'], propNames });
    }
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

  test('nenhuma entidade fica de fora da varredura sem motivo escrito', () => {
    // Sem isto, uma entidade pulada passa como uma entidade aprovada — que foi
    // exatamente como `ChildShareGrant` ficou de fora sem ninguém notar.
    expect(skipped).toEqual([]);
  });

  test.each(entities.map((e) => [e.name, e] as const))(
    '%s não devolve nenhum campo sensível',
    (_name, entity) => {
      const instance = new entity.ctor(markedProps(entity.propNames));
      const sensitiveHere = SENSITIVE_FIELDS.filter((f) => entity.propNames.includes(f));
      if (sensitiveHere.length === 0) return;

      for (const method of serialisers(instance)) {
        const output = (instance as unknown as Record<string, () => unknown>)[method]();
        const serialised = JSON.stringify(output);
        for (const field of sensitiveHere) {
          // A exceção é por CAMPO, não por método. Liberar o método inteiro
          // transformava "pode devolver o token do convite" em "pode devolver
          // qualquer coisa", e um campo sensível novo entrava de carona.
          if (ALLOWED_EXPOSURES.has(`${entity.name}.${method}.${field}`)) continue;
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
      const [entityName, method, field] = key.split('.');
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
      if (!serialised.includes(`"${field}"`)) {
        problemas.push(`${key}: não expõe mais este campo — remova a exceção`);
      }
    }
    expect(problemas).toEqual([]);
  });

  test('o parâmetro de tipo Hidden bate com o hiddenFields() de verdade', () => {
    // `Entity<Props, 'storageKey'>` promete um retorno sem `storageKey`, mas
    // quem esconde de fato é o corpo de `hiddenFields()`. Nada no TypeScript
    // liga os dois: declarar o tipo e esquecer o corpo compila limpo, devolve
    // uma assinatura `Omit<...>` honrada só no papel e vaza em produção.
    // Este teste é o que amarra os dois lados.
    const divergentes: string[] = [];
    for (const file of readdirSync(ENTITIES_DIR).filter((f) => f.endsWith('.ts'))) {
      const source = readFileSync(join(ENTITIES_DIR, file), 'utf8');
      const declaration = source.match(/extends Entity<\s*\w+\s*,([^>]+)>/);
      const declared = declaration
        ? [...declaration[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()
        : [];

      const name = file.replace(/\.ts$/, '');
      const entity = entities.find((e) => e.name === name || source.includes(`class ${e.name} `));
      if (!entity) continue;

      const instance = new entity.ctor(markedProps(entity.propNames)) as unknown as {
        hiddenFields?: () => readonly string[];
      };
      const actual = [...(instance.hiddenFields?.() ?? [])].sort();

      if (JSON.stringify(declared) !== JSON.stringify(actual)) {
        divergentes.push(`${name}: tipo diz [${declared}], hiddenFields() devolve [${actual}]`);
      }
    }
    expect(divergentes).toEqual([]);
  });
});

/**
 * A entidade pode ter uma view segura e o controller continuar chamando a
 * insegura — foi assim que `GET /api/professionals` passou a devolver o token
 * vivo de todo convite pendente. O guard de entidade não pega isso: ele prova
 * que `toListView()` é limpa, nunca que alguém a chama.
 */
describe('nenhuma listagem mapeia por uma view que expõe segredo', () => {
  const CONTROLLERS_DIR = join(ENTITIES_DIR, '..', '..', 'interfaces', 'http', 'controllers');

  /**
   * Views que expõem um campo sensível, deduzidas do próprio allowlist —
   * menos `toJSON`, que é genérico demais para casar por texto: quase toda
   * entidade tem uma, e a esmagadora maioria não expõe nada. Os dois casos de
   * `toJSON` que expõem token estão declarados como ABERTOS no allowlist
   * acima, que é onde eles ficam visíveis. Aqui a rede pega a forma que já
   * mordeu: uma view própria da entidade, criada para carregar o segredo,
   * usada sem querer numa listagem.
   */
  const UNSAFE_VIEWS = new Set(
    [...ALLOWED_EXPOSURES.keys()]
      .map((key) => key.split('.')[1])
      .filter((view) => view !== 'toJSON'),
  );

  test('nenhum controller faz .map(x => x.<view insegura>())', () => {
    const ofensores: string[] = [];
    for (const file of readdirSync(CONTROLLERS_DIR).filter((f) => f.endsWith('.ts'))) {
      const source = readFileSync(join(CONTROLLERS_DIR, file), 'utf8');
      for (const view of UNSAFE_VIEWS) {
        // `.map(... .toOwnerView())` — uma coleção inteira saindo pela view
        // que carrega o segredo. Uma resposta única continua permitida: é o
        // momento em que o dono pediu o código.
        // Cuidado com o `[^)]*` óbvio aqui: ele não atravessa o `)` de
        // `(p) =>`, então não casava com `items.map((p) => p.toOwnerView())`
        // — a forma exata que este teste existe para pegar. A primeira versão
        // passou verde com o bug reintroduzido.
        const mapsThroughView = new RegExp(`\\.map\\([\\s\\S]{0,120}?\\.${view}\\(\\)`);
        if (mapsThroughView.test(source)) ofensores.push(`${file}: .map(... ${view}())`);
      }
    }
    expect(ofensores).toEqual([]);
  });
});
