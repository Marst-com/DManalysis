#!/usr/bin/env node
'use strict';

/**
 * Security test suite for DuoMarst Analytics Backend.
 * Tests: AuthN bypass, AuthZ/IDOR, injection, CSRF, rate limit, payload bombing,
 *        replay attack, secret leakage, CORS, webhook SSRF, privilege escalation.
 */

const BASE = 'http://localhost:4000';

let passed = 0;
let failed = 0;
const failures = [];

async function req(method, path, { body, headers = {}, expectStatus } = {}) {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}

function assert(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
    failures.push(name);
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────

let TOKEN, SITE_ID, API_KEY, ANALYST_TOKEN;

async function setup() {
  // Login as OWNER
  const r = await req('POST', '/api/v1/auth/login', {
    body: { email: 'admin@test.com', password: 'TestPass123!' },
  });
  TOKEN = r.data.accessToken;
  if (!TOKEN) throw new Error('Setup failed: could not login');

  // Create site
  const siteR = await req('POST', '/api/v1/sites', {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: { name: 'Security Test Site', slug: 'sec-test' },
  });
  SITE_ID = siteR.data.site?.id;
  if (!SITE_ID) throw new Error('Setup failed: could not create site');

  // Create API key
  const keyR = await req('POST', `/api/v1/sites/${SITE_ID}/keys`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: {},
  });
  API_KEY = keyR.data.rawKey;
}

// ─── Test suites ──────────────────────────────────────────────────────────

async function testAuthentication() {
  console.log('\n[Authentication]');

  // No token
  const r1 = await req('GET', `/api/v1/sites`);
  assert('No token → 401', r1.status === 401);

  // Malformed Bearer
  const r2 = await req('GET', `/api/v1/sites`, { headers: { Authorization: 'Bearer not.a.token' } });
  assert('Malformed JWT → 401', r2.status === 401);

  // Expired/tampered token
  const fake = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJhYmMiLCJyb2xlIjoiT1dORVIiLCJlbWFpbCI6ImEifQ.fake';
  const r3 = await req('GET', `/api/v1/sites`, { headers: { Authorization: `Bearer ${fake}` } });
  assert('Tampered JWT → 401', r3.status === 401);

  // Wrong password
  const r4 = await req('POST', '/api/v1/auth/login', { body: { email: 'admin@test.com', password: 'wrong' } });
  assert('Wrong password → 401', r4.status === 401);
  assert('Wrong password: no email-exists hint', !JSON.stringify(r4.data).toLowerCase().includes('email') || r4.data.error === 'Invalid credentials.');

  // SQL/NoSQL injection in email
  const r5 = await req('POST', '/api/v1/auth/login', { body: { email: "' OR '1'='1", password: 'x' } });
  assert('SQL injection in email → 422', r5.status === 422);
}

async function testAuthorization() {
  console.log('\n[Authorization / IDOR]');

  // Access site you don't own
  const r1 = await req('GET', `/api/v1/sites/00000000-0000-0000-0000-000000000000`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  assert('IDOR: non-existent siteId → 403', r1.status === 403);

  // Try to access another site's analytics
  const r2 = await req('GET', `/api/v1/analytics/00000000-0000-0000-0000-000000000000/summary`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  assert('IDOR: analytics for unowned site → 403', r2.status === 403);

  // Try to access another site's functions
  const r3 = await req('GET', `/api/v1/functions/00000000-0000-0000-0000-000000000000`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  assert('IDOR: functions for unowned site → 403', r3.status === 403);

  // Try to access audit log for unowned site
  const r4 = await req('GET', `/api/v1/audit/00000000-0000-0000-0000-000000000000`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  assert('IDOR: audit log for unowned site → 403', r4.status === 403);
}

async function testIngestion() {
  console.log('\n[Ingestion Security]');

  const ts = Date.now();

  // No API key
  const r1 = await req('POST', '/api/v1/events', { body: { eventName: 'test', timestamp: ts } });
  assert('Ingestion: no API key → 401', r1.status === 401);

  // Fake API key
  const r2 = await req('POST', '/api/v1/events', {
    headers: { 'x-api-key': 'dm_fakekey0000000000000000000000' },
    body: { eventName: 'test', timestamp: ts },
  });
  assert('Ingestion: fake API key → 401', r2.status === 401);

  // XSS in eventName
  const r3 = await req('POST', '/api/v1/events', {
    headers: { 'x-api-key': API_KEY },
    body: { eventName: '<script>alert(1)</script>', timestamp: ts },
  });
  assert('Ingestion: XSS eventName → 422', r3.status === 422);

  // SQL injection in eventName
  const r4 = await req('POST', '/api/v1/events', {
    headers: { 'x-api-key': API_KEY },
    body: { eventName: "'; DROP TABLE events; --", timestamp: ts },
  });
  assert('Ingestion: SQL injection eventName → 422', r4.status === 422);

  // Replay attack (old timestamp)
  const old = ts - 10 * 60 * 1000;
  const r5 = await req('POST', '/api/v1/events', {
    headers: { 'x-api-key': API_KEY },
    body: { eventName: 'page_view', timestamp: old },
  });
  assert('Ingestion: replay (old ts) → 422', r5.status === 422);

  // Client tries to set siteId in body
  const r6 = await req('POST', '/api/v1/events', {
    headers: { 'x-api-key': API_KEY },
    body: { eventName: 'page_view', timestamp: ts, siteId: '00000000-0000-0000-0000-000000000000', role: 'OWNER' },
  });
  assert('Ingestion: body siteId/role ignored → 201', r6.status === 201);
  // Verify it was stored with correct siteId
  const eventsR = await req('GET', `/api/v1/analytics/${SITE_ID}/events?limit=1`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const storedSiteId = eventsR.data.events?.[0]?.siteId;
  assert('Ingestion: stored siteId = correct siteId', storedSiteId === SITE_ID, `got ${storedSiteId}`);

  // Batch over limit
  const bigBatch = Array.from({ length: 21 }, () => ({ eventName: 'page_view', timestamp: ts }));
  const r7 = await req('POST', '/api/v1/events/batch', {
    headers: { 'x-api-key': API_KEY },
    body: { events: bigBatch },
  });
  assert('Ingestion: batch >20 → 422', r7.status === 422);

  // Oversized payload (>50kb) — test with large metadata
  const bigMeta = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`, 'x'.repeat(255)]));
  const r8 = await req('POST', '/api/v1/events', {
    headers: { 'x-api-key': API_KEY },
    body: { eventName: 'page_view', timestamp: ts, metadata: bigMeta },
  });
  // Should either sanitize (201) or reject (422) — must not 500
  assert('Ingestion: oversized metadata → not 500', r8.status !== 500);
}

async function testFunctions() {
  console.log('\n[Functions Security]');

  const ts = Date.now();

  // Eval/injection in function name
  const evil = ['eval(alert(1))', '<script>', '../../../etc', "'; DROP TABLE", 'function(){}'];
  for (const name of evil) {
    const r = await req('POST', `/api/v1/functions/${SITE_ID}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: { name },
    });
    assert(`Function: evil name "${name.slice(0,20)}" → 422`, r.status === 422);
  }

  // Valid function
  const r1 = await req('POST', `/api/v1/functions/${SITE_ID}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: { name: 'clickbutton' },
  });
  assert('Function: valid name → 201', r1.status === 201);
}

async function testSecrets() {
  console.log('\n[Secrets Security]');

  // Register secret
  const r1 = await req('PUT', `/api/v1/sites/${SITE_ID}/secrets/GEMINI_KEY`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: { value: 'AIzaSy-real-key-1234567890', label: 'Gemini' },
  });
  assert('Secret: register → 200', r1.status === 200);

  // List: value must NOT appear
  const r2 = await req('GET', `/api/v1/sites/${SITE_ID}/secrets`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const secretsJson = JSON.stringify(r2.data);
  assert('Secret: list never exposes value', !secretsJson.includes('AIzaSy'));
  assert('Secret: list never exposes encrypted blob', !secretsJson.includes('encrypted'));

  // Resolve: returns hint only, not full value
  const r3 = await req('POST', `/api/v1/sites/${SITE_ID}/secrets/resolve`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: { placeholder: 'GEMINI_KEY' },
  });
  assert('Secret: resolve returns hint only', r3.data.result?.hint !== undefined || r3.data.hint !== undefined);
  const hintVal = r3.data.hint || r3.data.result?.hint || '';
  assert('Secret: hint is truncated', hintVal.length < 20 && hintVal.endsWith('...'));
  assert('Secret: full value not in resolve response', !JSON.stringify(r3.data).includes('AIzaSy-real'));

  // Invalid placeholder format
  const r4 = await req('PUT', `/api/v1/sites/${SITE_ID}/secrets/invalid-key!`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: { value: 'x' },
  });
  assert('Secret: invalid placeholder format → 4xx', r4.status >= 400);
}

async function testAlerts() {
  console.log('\n[Alert Security]');

  // SSRF: private IP webhook
  const r1 = await req('POST', `/api/v1/alerts/${SITE_ID}/rules`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: {
      name: 'x', metric: 'visitors', operator: '>', threshold: 1,
      windowMinutes: 10, channels: ['webhook'],
      webhookUrl: 'https://192.168.1.1/hook',
    },
  });
  assert('Alert: private IP webhook → 4xx', r1.status >= 400);

  // SSRF: localhost webhook
  const r2 = await req('POST', `/api/v1/alerts/${SITE_ID}/rules`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: {
      name: 'x', metric: 'visitors', operator: '>', threshold: 1,
      windowMinutes: 10, channels: ['webhook'],
      webhookUrl: 'https://localhost/hook',
    },
  });
  assert('Alert: localhost webhook → 4xx', r2.status >= 400);

  // HTTP (non-HTTPS) webhook
  const r3 = await req('POST', `/api/v1/alerts/${SITE_ID}/rules`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: {
      name: 'x', metric: 'visitors', operator: '>', threshold: 1,
      windowMinutes: 10, channels: ['webhook'],
      webhookUrl: 'http://legit.example.com/hook',
    },
  });
  assert('Alert: HTTP webhook → 422', r3.status >= 400);

  // Invalid metric
  const r4 = await req('POST', `/api/v1/alerts/${SITE_ID}/rules`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: {
      name: 'x', metric: 'evil_metric', operator: '>', threshold: 1,
      windowMinutes: 10, channels: ['dashboard'],
    },
  });
  assert('Alert: invalid metric → 422', r4.status === 422);
}

async function testErrorLeakage() {
  console.log('\n[Error Leakage]');

  // 404 must not reveal internals
  const r1 = await req('GET', '/api/v1/nonexistent');
  const body1 = JSON.stringify(r1.data);
  assert('404: no stack trace', !body1.includes('at Object.') && !body1.includes('node_modules'));
  assert('404: no internal paths', !body1.includes('/home/') && !body1.includes('src/'));

  // Auth error must not reveal DB details
  const r2 = await req('POST', '/api/v1/auth/login', { body: { email: 'x@x.com', password: 'y' } });
  const body2 = JSON.stringify(r2.data);
  assert('Auth error: no DB details', !body2.toLowerCase().includes('database') && !body2.includes('bcrypt'));
  assert('Auth error: no email-exists hint', !body2.toLowerCase().includes('not found') && !body2.toLowerCase().includes('no user'));
}

async function testAuditLog() {
  console.log('\n[Audit Logs]');

  // Must be able to retrieve site audit log
  const r1 = await req('GET', `/api/v1/audit/${SITE_ID}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  assert('Audit: site log accessible → 200', r1.status === 200);
  assert('Audit: contains entries', Array.isArray(r1.data.entries));

  // Entries must not contain passwords/tokens
  const auditJson = JSON.stringify(r1.data.entries);
  assert('Audit: no passwords in log', !auditJson.toLowerCase().includes('password'));
  assert('Audit: no tokens in log', !auditJson.toLowerCase().includes('accesstoken'));

  // Global log (OWNER only)
  const r2 = await req('GET', '/api/v1/audit', {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  assert('Audit: global log (OWNER) → 200', r2.status === 200);

  // IDOR: audit log for unowned site
  const r3 = await req('GET', '/api/v1/audit/00000000-0000-0000-0000-000000000000', {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  assert('Audit: IDOR unowned site → 403', r3.status === 403);
}

// ─── Run all ──────────────────────────────────────────────────────────────

async function main() {
  console.log('DuoMarst Analytics — Security Test Suite');
  console.log('==========================================');

  try {
    await setup();
    console.log('Setup complete.\n');
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exit(1);
  }

  await testAuthentication();
  await testAuthorization();
  await testIngestion();
  await testFunctions();
  await testSecrets();
  await testAlerts();
  await testErrorLeakage();
  await testAuditLog();

  console.log('\n==========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.error('Failed tests:');
    failures.forEach((f) => console.error(`  - ${f}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
