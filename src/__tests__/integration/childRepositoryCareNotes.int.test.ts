/**
 * Real-Postgres integration test for PgChildRepository's care-notes fields
 * (sensoryTriggers, calmingStrategies, emergencyContact). No prior test
 * exercised PgChildRepository against a real database at all.
 *
 * Covers:
 *  1. create() persists all three fields
 *  2. update() sets a previously-null field
 *  3. update() with an explicit null clears a previously-set field
 *  4. update() omitting a field leaves its existing value untouched
 *     (partial update must not clobber fields the caller didn't send)
 */

import { v7 as uuidv7 } from 'uuid';
import pool from 'infrastructure/database/connection';
import { PgChildRepository } from 'infrastructure/repositories/PgChildRepository';

const USER_ID = `test-user-${uuidv7()}`;
const repo = new PgChildRepository();

afterAll(async () => {
  await pool.query(`DELETE FROM children WHERE user_id = $1`, [USER_ID]);
  await pool.end();
});

describe('PgChildRepository — care-notes fields (real Postgres)', () => {
  test('create() persists sensoryTriggers/calmingStrategies/emergencyContact', async () => {
    const child = await repo.create({
      id: uuidv7(),
      userId: USER_ID,
      name: 'Ana',
      birthDate: '2018-03-15',
      sensoryTriggers: 'Barulhos altos',
      calmingStrategies: 'Abraço apertado',
      emergencyContact: 'Mãe: 11 99999-0000',
    });

    expect(child.getSensoryTriggers()).toBe('Barulhos altos');
    expect(child.getCalmingStrategies()).toBe('Abraço apertado');
    expect(child.getEmergencyContact()).toBe('Mãe: 11 99999-0000');
  });

  test('update() sets a previously-null field', async () => {
    const child = await repo.create({
      id: uuidv7(), userId: USER_ID, name: 'Bruno', birthDate: '2019-01-01',
    });
    expect(child.getEmergencyContact()).toBeNull();

    const updated = await repo.update(child.getId(), USER_ID, {
      emergencyContact: 'Pai: 11 98888-0000',
    });

    expect(updated?.getEmergencyContact()).toBe('Pai: 11 98888-0000');
  });

  test('update() with explicit null clears a previously-set field', async () => {
    const child = await repo.create({
      id: uuidv7(), userId: USER_ID, name: 'Carla', birthDate: '2017-06-10',
      calmingStrategies: 'Música calma',
    });
    expect(child.getCalmingStrategies()).toBe('Música calma');

    const updated = await repo.update(child.getId(), USER_ID, {
      calmingStrategies: null,
    });

    expect(updated?.getCalmingStrategies()).toBeNull();
  });

  test('update() omitting a field leaves its existing value untouched', async () => {
    const child = await repo.create({
      id: uuidv7(), userId: USER_ID, name: 'Duda', birthDate: '2020-02-02',
      sensoryTriggers: 'Luzes piscando',
      emergencyContact: 'Avó: 11 97777-0000',
    });

    // Only update name — sensoryTriggers/emergencyContact are not in the payload.
    const updated = await repo.update(child.getId(), USER_ID, { name: 'Duda Silva' });

    expect(updated?.getName()).toBe('Duda Silva');
    expect(updated?.getSensoryTriggers()).toBe('Luzes piscando');
    expect(updated?.getEmergencyContact()).toBe('Avó: 11 97777-0000');
  });
});
