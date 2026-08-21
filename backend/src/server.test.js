import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordHash, verifyPassword } from './server.js';
import { GenXClient, GenXUnavailableError } from './services/ai/GenXClient.js';

test('password hashing is salted and verifies only the original password', () => {
  const first = passwordHash('A-secure-password-123');
  const second = passwordHash('A-secure-password-123');
  assert.notEqual(first, second);
  assert.equal(verifyPassword('A-secure-password-123', first), true);
  assert.equal(verifyPassword('not-the-password', first), false);
});

test('GenX client fails closed when the gateway is not configured', async () => {
  const client = new GenXClient({ fetchImpl: async () => { throw new Error('fetch must not be called'); } });
  await assert.rejects(
    () => client.generate({ feature: 'chat', requestId: 'unit-test', messages: [{ role: 'user', content: 'hello' }] }),
    (error) => error instanceof GenXUnavailableError && error.code === 'GENX_NOT_CONFIGURED',
  );
});
