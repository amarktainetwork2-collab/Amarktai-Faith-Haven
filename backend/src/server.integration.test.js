import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { app, payfastSign } from './server.js';
import { closePool, query, runMigrations } from './db/index.js';
import { AIService } from './services/ai/AIService.js';

const password = 'StrongPassword123';
let server;
let baseUrl;

const decodeSetCookie = (value) => value.split(';')[0].split('=');
const newClient = () => {
  const cookies = new Map();
  return {
    cookies,
    async request(path, options = {}) {
      const headers = new Headers(options.headers || {});
      const serialized = [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
      if (serialized) headers.set('cookie', serialized);
      const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
      for (const header of response.headers.getSetCookie?.() || []) {
        const [name, value] = decodeSetCookie(header);
        if (/Max-Age=0/i.test(header)) cookies.delete(name); else cookies.set(name, value);
      }
      return response;
    },
    async csrf() {
      const response = await this.request('/api/auth/csrf');
      assert.equal(response.status, 200);
      const body = await response.json();
      return body.csrfToken;
    },
  };
};

const resetDatabase = async () => {
  await query(`TRUNCATE TABLE audit_logs, notifications, contact_messages, newsletter_subscriptions, media_items, generated_documents, devotional_favorites, devotionals, calendar_events, prayer_wall_reports, prayer_wall_reactions, prayer_wall_posts, prayer_entries, ai_messages, ai_conversations, ai_requests, payments, subscriptions, password_reset_tokens, email_verification_tokens, refresh_tokens, users RESTART IDENTITY CASCADE`);
};

test.before(async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL must be supplied for integration tests');
  await runMigrations();
  await resetDatabase();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await closePool();
});

test('secure account, refresh, protected content, and authorization lifecycle', async () => {
  const client = newClient();
  const csrf = await client.csrf();

  const blocked = await newClient().request('/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'blocked@example.test', password, name: 'Blocked User' }),
  });
  assert.equal(blocked.status, 403);

  const registration = await client.request('/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
    body: JSON.stringify({ email: 'member@example.test', password, name: 'Member User', denomination: 'nondenominational' }),
  });
  assert.equal(registration.status, 201);
  const registered = await registration.json();
  assert.equal(registered.user.emailVerified, false);
  assert.ok(client.cookies.get('fh_access'));
  const originalRefresh = client.cookies.get('fh_refresh');
  const originalCsrf = client.cookies.get('fh_csrf');

  const me = await client.request('/api/auth/me');
  assert.equal(me.status, 200);
  const member = (await me.json()).user;

  const unverifiedChat = await client.request('/api/ai/chat', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': client.cookies.get('fh_csrf') },
    body: JSON.stringify({ prompt: 'Please help me reflect.' }),
  });
  assert.equal(unverifiedChat.status, 403);

  const rawVerificationToken = 'integration-verification-token-1234567890';
  await query(
    `INSERT INTO email_verification_tokens(user_id, token_hash, expires_at) VALUES($1, $2, now() + interval '1 hour')`,
    [member.id, crypto.createHash('sha256').update(rawVerificationToken).digest('hex')],
  );
  const verified = await client.request('/api/auth/verify-email', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': client.cookies.get('fh_csrf') },
    body: JSON.stringify({ token: rawVerificationToken }),
  });
  assert.equal(verified.status, 200);

  const wallCreated = await client.request('/api/prayer-wall', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': client.cookies.get('fh_csrf') },
    body: JSON.stringify({ content: 'Anonymous integration prayer request.', isAnonymous: true }),
  });
  assert.equal(wallCreated.status, 201);
  const wallId = (await wallCreated.json()).prayer.id;
  const wallRead = await client.request('/api/prayer-wall');
  assert.equal(wallRead.status, 200);
  const wallItem = (await wallRead.json()).prayers.find((item) => item.id === wallId);
  assert.equal(wallItem.author_name, null);
  assert.equal(wallItem.is_owner, true);
  const wallUpdated = await client.request(`/api/prayer-wall/${wallId}`, {
    method: 'PUT', headers: { 'content-type': 'application/json', 'x-csrf-token': client.cookies.get('fh_csrf') },
    body: JSON.stringify({ content: 'Updated anonymous integration prayer.', isAnonymous: true }),
  });
  assert.equal(wallUpdated.status, 200);
  const wallDeleted = await client.request(`/api/prayer-wall/${wallId}`, { method: 'DELETE', headers: { 'x-csrf-token': client.cookies.get('fh_csrf') } });
  assert.equal(wallDeleted.status, 204);

  const journalCreated = await client.request('/api/prayer-journal', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': client.cookies.get('fh_csrf') },
    body: JSON.stringify({ title: 'Integration prayer', content: 'A private persistent prayer entry.', tags: ['Testing'] }),
  });
  assert.equal(journalCreated.status, 201);
  const journal = await journalCreated.json();
  const journalId = journal.prayer.id;

  const journalRead = await client.request('/api/prayer-journal');
  assert.equal(journalRead.status, 200);
  assert.equal((await journalRead.json()).prayers.length, 1);

  const journalUpdated = await client.request(`/api/prayer-journal/${journalId}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json', 'x-csrf-token': client.cookies.get('fh_csrf') },
    body: JSON.stringify({ isAnswered: true }),
  });
  assert.equal(journalUpdated.status, 200);

  const calendarCreated = await client.request('/api/calendar', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': client.cookies.get('fh_csrf') },
    body: JSON.stringify({ title: 'Integration event', description: 'Protected event', startsAt: '2026-08-21T10:00:00.000Z', timezone: 'UTC', category: 'personal' }),
  });
  assert.equal(calendarCreated.status, 201);
  const event = (await calendarCreated.json()).event;

  const calendarUpdated = await client.request(`/api/calendar/${event.id}`, {
    method: 'PUT', headers: { 'content-type': 'application/json', 'x-csrf-token': client.cookies.get('fh_csrf') },
    body: JSON.stringify({ title: 'Updated event', description: 'Updated', startsAt: '2026-08-21T11:00:00.000Z', timezone: 'UTC', category: 'personal' }),
  });
  assert.equal(calendarUpdated.status, 200);

  const ordinaryAdmin = await client.request('/api/admin/stats');
  assert.equal(ordinaryAdmin.status, 403);

  const refreshed = await client.request('/api/auth/refresh', { method: 'POST', headers: { 'x-csrf-token': client.cookies.get('fh_csrf') } });
  assert.equal(refreshed.status, 200);
  assert.notEqual(client.cookies.get('fh_refresh'), originalRefresh);

  const replayClient = newClient();
  replayClient.cookies.set('fh_refresh', originalRefresh);
  replayClient.cookies.set('fh_csrf', originalCsrf);
  const replay = await replayClient.request('/api/auth/refresh', { method: 'POST', headers: { 'x-csrf-token': originalCsrf } });
  assert.equal(replay.status, 401);

  const revokedFamily = await client.request('/api/auth/refresh', { method: 'POST', headers: { 'x-csrf-token': client.cookies.get('fh_csrf') } });
  assert.equal(revokedFamily.status, 401);
});

test('admin role authorization and protected resource ownership are enforced', async () => {
  const owner = newClient();
  const ownerCsrf = await owner.csrf();
  const registered = await owner.request('/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': ownerCsrf },
    body: JSON.stringify({ email: 'admin@example.test', password, name: 'Admin User' }),
  });
  assert.equal(registered.status, 201);
  const userId = (await registered.json()).user.id;
  await query(`UPDATE users SET role = 'admin', email_verified_at = now() WHERE id = $1`, [userId]);

  const refreshedCsrf = await owner.csrf();
  const adminLogin = await owner.request('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': refreshedCsrf },
    body: JSON.stringify({ email: 'admin@example.test', password }),
  });
  assert.equal(adminLogin.status, 200);
  const adminStats = await owner.request('/api/admin/stats');
  assert.equal(adminStats.status, 200);
  const devotionalCreated = await owner.request('/api/devotionals', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': owner.cookies.get('fh_csrf') },
    body: JSON.stringify({ title: 'Integration devotional', scriptureReference: 'Psalm 23', reflection: 'Reflection for integration testing.', prayer: 'A short prayer.', status: 'draft' }),
  });
  assert.equal(devotionalCreated.status, 201);
  const devotionalId = (await devotionalCreated.json()).devotional.id;
  const devotionalPublished = await owner.request(`/api/devotionals/${devotionalId}`, {
    method: 'PUT', headers: { 'content-type': 'application/json', 'x-csrf-token': owner.cookies.get('fh_csrf') },
    body: JSON.stringify({ title: 'Integration devotional', scriptureReference: 'Psalm 23', reflection: 'Reflection for integration testing.', prayer: 'A short prayer.', status: 'published' }),
  });
  assert.equal(devotionalPublished.status, 200);

  const other = newClient();
  const otherCsrf = await other.csrf();
  const otherRegistration = await other.request('/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': otherCsrf },
    body: JSON.stringify({ email: 'other@example.test', password, name: 'Other User' }),
  });
  assert.equal(otherRegistration.status, 201);
  const publishedDevotionals = await other.request('/api/devotionals');
  assert.equal(publishedDevotionals.status, 200);
  assert.ok((await publishedDevotionals.json()).devotionals.some((item) => item.id === devotionalId));
  const deniedEditorial = await other.request(`/api/devotionals/${devotionalId}`, {
    method: 'PUT', headers: { 'content-type': 'application/json', 'x-csrf-token': other.cookies.get('fh_csrf') },
    body: JSON.stringify({ title: 'No access', scriptureReference: 'Psalm 23', reflection: 'No access', prayer: 'No access', status: 'draft' }),
  });
  assert.equal(deniedEditorial.status, 403);
  const forbiddenDelete = await other.request('/api/calendar/00000000-0000-0000-0000-000000000000', {
    method: 'DELETE', headers: { 'x-csrf-token': other.cookies.get('fh_csrf') },
  });
  assert.equal(forbiddenDelete.status, 404);
});


test('PayFast callback verifies signed payment state, plan activation, and duplicate notifications', async () => {
  const client = newClient();
  const csrf = await client.csrf();
  const registration = await client.request('/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
    body: JSON.stringify({ email: 'payer@example.test', password, name: 'Payer User' }),
  });
  assert.equal(registration.status, 201);
  const payer = (await registration.json()).user;
  await query(`UPDATE users SET email_verified_at = now() WHERE id=$1`, [payer.id]);
  const loginCsrf = await client.csrf();
  const login = await client.request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': loginCsrf }, body: JSON.stringify({ email: 'payer@example.test', password }) });
  assert.equal(login.status, 200);

  const checkout = await client.request('/api/payments/checkout', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': client.cookies.get('fh_csrf') },
    body: JSON.stringify({ planCode: 'family', amountCents: 12_500 }),
  });
  assert.equal(checkout.status, 200);
  const checkoutBody = await checkout.json();
  const itn = { ...checkoutBody.payload, amount_gross: '125.00', currency: 'ZAR', payment_status: 'COMPLETE' };
  const callbackBody = new URLSearchParams({ ...Object.fromEntries(Object.entries(itn).map(([key, value]) => [key, String(value)])), signature: payfastSign(itn) });
  const callback = await client.request('/api/payments/payfast/itn', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: callbackBody });
  assert.equal(callback.status, 200);
  const payment = await query(`SELECT status, plan_code FROM payments WHERE provider_payment_id=$1`, [checkoutBody.payload.m_payment_id]);
  assert.deepEqual(payment.rows[0], { status: 'complete', plan_code: 'family' });
  const subscription = await query(`SELECT plan_code, status FROM subscriptions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [payer.id]);
  assert.deepEqual(subscription.rows[0], { plan_code: 'family', status: 'active' });
  const duplicate = await client.request('/api/payments/payfast/itn', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: callbackBody });
  assert.equal(duplicate.status, 200);
  const subscriptionCount = await query(`SELECT count(*)::int AS count FROM subscriptions WHERE user_id=$1`, [payer.id]);
  assert.equal(subscriptionCount.rows[0].count, 1);
  const invalid = await client.request('/api/payments/payfast/itn', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...Object.fromEntries(callbackBody), signature: 'bad' }) });
  assert.equal(invalid.status, 400);
});

test('AI monthly quota remains safe under simultaneous requests', async () => {
  const client = newClient();
  const csrf = await client.csrf();
  const registration = await client.request('/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
    body: JSON.stringify({ email: 'quota@example.test', password, name: 'Quota User' }),
  });
  assert.equal(registration.status, 201);
  const user = (await registration.json()).user;
  await query(`UPDATE users SET email_verified_at=now(), ai_quota_monthly=1 WHERE id=$1`, [user.id]);
  const record = (await query(`SELECT * FROM users WHERE id=$1`, [user.id])).rows[0];
  const service = new AIService({ client: { generate: async () => ({ content: 'Generated integration response.', inputUnits: 1, outputUnits: 1 }) } });
  const results = await Promise.allSettled([
    service.generate({ user: record, feature: 'prayer', prompt: 'First request' }),
    service.generate({ user: record, feature: 'prayer', prompt: 'Second request' }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.equal(rejected?.reason?.code, 'AI_QUOTA_EXCEEDED');
  const counted = await query(`SELECT count(*)::int AS count FROM ai_requests WHERE user_id=$1 AND status='succeeded'`, [user.id]);
  assert.equal(counted.rows[0].count, 1);
});

test('privacy export and account deletion preserve control over authenticated data', async () => {
  const client = newClient();
  const csrf = await client.csrf();
  const registration = await client.request('/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
    body: JSON.stringify({ email: 'privacy@example.test', password, name: 'Privacy User' }),
  });
  assert.equal(registration.status, 201);
  const exported = await client.request('/api/user/export');
  assert.equal(exported.status, 200);
  const payload = await exported.json();
  assert.equal(payload.profile.email, 'privacy@example.test');
  assert.ok(Array.isArray(payload.prayerJournal));

  const deleted = await client.request('/api/user/account', {
    method: 'DELETE', headers: { 'content-type': 'application/json', 'x-csrf-token': client.cookies.get('fh_csrf') },
    body: JSON.stringify({ password }),
  });
  assert.equal(deleted.status, 204);
  const afterDeletion = await client.request('/api/auth/me');
  assert.equal(afterDeletion.status, 401);
});


test('CORS permits the configured application origin and rejects untrusted origins explicitly', async () => {
  const allowed = await fetch(`${baseUrl}/health`, { headers: { Origin: process.env.CORS_ORIGIN || 'http://localhost:5173' } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('access-control-allow-origin'), process.env.CORS_ORIGIN || 'http://localhost:5173');
  const rejected = await fetch(`${baseUrl}/health`, { headers: { Origin: 'https://untrusted.example' } });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get('access-control-allow-origin'), null);
});
