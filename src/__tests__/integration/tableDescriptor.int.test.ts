/**
 * O descritor de tabela contra Postgres real.
 *
 * Duas coisas se provam aqui, e a primeira é a que mais assusta: a diferença
 * entre "campo obrigatório" e "campo anulável" nos UPDATE gerados. Os `if` à
 * mão codificavam a distinção em duas formas parecidas demais —
 * `input.name !== undefined` e `'dosage' in input` — e colapsar as duas não
 * quebra nada visível: o PATCH devolve 200, a resposta parece certa, e o campo
 * simplesmente não limpa. Um teste que exercitasse só o caminho de PREENCHER
 * passaria verde com o de LIMPAR quebrado.
 *
 * A segunda é o descritor contra o schema vivo: coluna que existe no banco e
 * não está declarada some do INSERT e do mapeamento sem que nada falhe.
 */
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { PgMedicationRepository } from 'infrastructure/repositories/PgMedicationRepository';
import { readdirSync } from 'fs';
import { join } from 'path';
import { col, ColumnsFor, defineTable, read, registeredTables } from 'infrastructure/repositories/defineTable';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const medications = new PgMedicationRepository();

const owner = 'owner-' + randomUUID().slice(0, 8);
const child = randomUUID();

beforeAll(async () => {
  await pool.query(
    `INSERT INTO children (id,user_id,name,birth_date) VALUES ($1,$2,'Criança','2019-01-01')`,
    [child, owner],
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM children WHERE id = $1', [child]);
  await pool.end();
});

/** Um medicamento novo a cada teste: os casos alteram e apagam colunas. */
async function novoMedicamento() {
  return medications.save({
    id: randomUUID(),
    userId: owner,
    childId: child,
    name: 'Risperidona',
    dosage: '0,5 mg',
    frequency: '1x ao dia',
    notes: 'tomar à noite',
  });
}

async function linha(id: string) {
  const { rows } = await pool.query(
    'SELECT name, dosage, frequency, notes, updated_at FROM medications WHERE id = $1',
    [id],
  );
  return rows[0];
}

describe('campo anulável: null EXPLÍCITO limpa a coluna', () => {
  test('mandar { dosage: null } apaga a dosagem', async () => {
    const med = await novoMedicamento();
    const atualizado = await medications.update(med.getId(), owner, { dosage: null });

    expect(atualizado).not.toBeNull();
    expect(atualizado!.getDosage()).toBeNull();
    expect((await linha(med.getId())).dosage).toBeNull();
  });

  test('e não encosta nas colunas vizinhas', async () => {
    const med = await novoMedicamento();
    await medications.update(med.getId(), owner, { dosage: null });

    const row = await linha(med.getId());
    expect(row.name).toBe('Risperidona');
    expect(row.frequency).toBe('1x ao dia');
    expect(row.notes).toBe('tomar à noite');
  });

  test('dois anuláveis de uma vez, e só eles', async () => {
    const med = await novoMedicamento();
    await medications.update(med.getId(), owner, { dosage: null, notes: null });

    const row = await linha(med.getId());
    expect(row.dosage).toBeNull();
    expect(row.notes).toBeNull();
    expect(row.frequency).toBe('1x ao dia');
  });
});

describe('ausente é diferente de null', () => {
  test('mandar {} não altera coluna nenhuma — nem o updated_at', async () => {
    const med = await novoMedicamento();
    const antes = await linha(med.getId());

    const atualizado = await medications.update(med.getId(), owner, {});

    expect(atualizado).not.toBeNull();
    const depois = await linha(med.getId());
    expect(depois).toEqual(antes);
  });

  test('alterar o obrigatório deixa os anuláveis exatamente como estavam', async () => {
    const med = await novoMedicamento();
    await medications.update(med.getId(), owner, { name: 'Aripiprazol' });

    const row = await linha(med.getId());
    expect(row.name).toBe('Aripiprazol');
    expect(row.dosage).toBe('0,5 mg');
    expect(row.notes).toBe('tomar à noite');
  });

  test('a chave PRESENTE com undefined limpa o anulável — é o que `in` decide', async () => {
    // Aqui mora a diferença observável entre `'dosage' in input` e
    // `input.dosage !== undefined`: com `null` explícito as duas formas fazem
    // a mesma coisa, e é por isso que um teste que só exercitasse
    // `{ dosage: null }` passaria verde com a distinção já colapsada. A chave
    // presente valendo undefined é o caso que separa as duas — e é o
    // comportamento que os `if` à mão tinham.
    const med = await novoMedicamento();
    await medications.update(med.getId(), owner, { dosage: undefined });

    expect((await linha(med.getId())).dosage).toBeNull();
  });

  test('e a mesma chave presente com undefined NÃO toca o obrigatório', async () => {
    // O outro lado da distinção. Colapsar para `in` faria esta atualização
    // tentar gravar NULL numa coluna NOT NULL.
    const med = await novoMedicamento();
    await medications.update(med.getId(), owner, { name: undefined, notes: null });

    const row = await linha(med.getId());
    expect(row.name).toBe('Risperidona');
    expect(row.notes).toBeNull();
  });

  test('limpar um anulável não ressuscita o que já tinha sido limpo, nem apaga mais nada', async () => {
    const med = await novoMedicamento();
    await medications.update(med.getId(), owner, { dosage: null });
    await medications.update(med.getId(), owner, { name: 'Aripiprazol' });

    const row = await linha(med.getId());
    expect(row.dosage).toBeNull();
    expect(row.name).toBe('Aripiprazol');
    expect(row.frequency).toBe('1x ao dia');
  });
});

/**
 * A mesma distinção no SQL emitido, sem banco no meio: é aqui que se lê, numa
 * linha, o que as duas formas produzem.
 */
describe('a forma do SET que cada modo produz', () => {
  interface DemoProps {
    id: string;
    userId: string;
    obrigatorio: string;
    anulavel: string | null;
  }

  const DEMO = defineTable({
    table: 'descriptor_demo',
    columns: {
      id: col.immutable('id', read.text),
      userId: col.immutable('user_id', read.text),
      obrigatorio: col.required('obrigatorio', read.text),
      anulavel: col.nullable('anulavel', read.textOrNull),
    } satisfies ColumnsFor<DemoProps>,
  });

  const setOf = (input: Record<string, unknown>): string | null => {
    const statement = DEMO.update('id-1', 'user-1', input);
    return statement === null ? null : /SET ([\s\S]*?)\n\s*WHERE/.exec(statement.sql)![1];
  };

  test('o anulável entra no SET quando a chave veio com null', () => {
    expect(setOf({ anulavel: null })).toBe('anulavel = $1');
  });

  test('o obrigatório NÃO entra no SET quando o valor é undefined', () => {
    expect(setOf({ obrigatorio: undefined })).toBeNull();
  });

  test('mas o anulável ENTRA, porque quem decide é a chave e não o valor', () => {
    expect(setOf({ anulavel: undefined })).toBe('anulavel = $1');
  });

  test('e entrada vazia não produz UPDATE nenhum', () => {
    expect(setOf({})).toBeNull();
  });

  test('os parâmetros do SET vêm antes do predicado, na ordem declarada', () => {
    const statement = DEMO.update('id-1', 'user-1', { obrigatorio: 'x', anulavel: null })!;
    expect(statement.params).toEqual(['x', null, 'id-1', 'user-1']);
  });
});

describe('o descritor contra o schema vivo', () => {
  /** Carrega todo `Pg*` para que os descritores se registrem. */
  beforeAll(() => {
    const dir = join(__dirname, '../../infrastructure/repositories');
    for (const file of readdirSync(dir).filter((f) => f.startsWith('Pg') && f.endsWith('.ts'))) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require(join(dir, file));
    }
  });

  test('as colunas declaradas são exatamente as colunas da tabela', async () => {
    const divergentes: string[] = [];
    for (const descritor of registeredTables()) {
      if (descritor.table === 'descriptor_demo') continue; // a tabela de exemplo acima
      const { rows } = await pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1`,
        [descritor.table],
      );
      const noBanco = new Set(rows.map((r) => r.column_name));
      const declaradas = new Set(Object.values(descritor.columns).map((c) => c.column));

      // Coluna do banco que ninguém declarou some do INSERT e do mapeamento em
      // silêncio; coluna declarada que não existe explode só quando alguém
      // chama aquele caminho.
      const naoDeclaradas = [...noBanco].filter((c) => !declaradas.has(c)).sort();
      const inexistentes = [...declaradas].filter((c) => !noBanco.has(c)).sort();
      if (naoDeclaradas.length > 0 || inexistentes.length > 0) {
        divergentes.push(`${descritor.table}: sem declaração ${naoDeclaradas}, sem coluna ${inexistentes}`);
      }
    }
    expect(divergentes).toEqual([]);
  });
});
