/**
 * Contrato de resposta dos controllers CRUD.
 *
 * O golden ao lado foi gravado com os controllers ESCRITOS À MÃO, antes de
 * existir a fábrica `crudController`. Para cada handler ele fixa: os argumentos
 * que chegam ao service (já com as datas convertidas), as linhas de log, o
 * status e o envelope inteiro — incluindo os metadados (`message`, `count`,
 * `total/page/limit`) que o frontend desempacota. Uma refatoração que troque
 * `jsonResponse(res, x, 200, { count })` por `jsonResponse(res, x)` não quebra
 * nenhum teste de serviço; quebra a tela. Este teste é o que a apanha.
 *
 * Regenerar SÓ quando a mudança de resposta for deliberada:
 *   WRITE_CRUD_GOLDEN=1 npx jest crudControllerContract
 */

import fs from 'fs';
import path from 'path';

import { CRUD_CASES, ServiceCall, recordToJson, runHandler } from './crudContractHarness';

const GOLDEN_PATH = path.join(__dirname, 'crudControllerContract.golden.json');

describe('CRUD controller response contract', () => {
  test('every handler produces byte-identical output to the recorded golden', async () => {
    const transcript: Record<string, unknown> = {};

    for (const testCase of CRUD_CASES) {
      for (const [op, req] of Object.entries(testCase.reqs)) {
        const calls: ServiceCall[] = [];
        const handlers = testCase.build(calls);
        const record = await runHandler(handlers[op], req, calls);
        transcript[`${testCase.controller}.${op}`] = recordToJson(record);
      }
    }

    const serialized = `${JSON.stringify(transcript, null, 2)}\n`;

    if (process.env.WRITE_CRUD_GOLDEN === '1') {
      fs.writeFileSync(GOLDEN_PATH, serialized);
    }

    expect(fs.existsSync(GOLDEN_PATH)).toBe(true);
    expect(serialized).toBe(fs.readFileSync(GOLDEN_PATH, 'utf8'));
  });
});
