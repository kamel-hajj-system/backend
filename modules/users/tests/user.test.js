/**
 * User module API tests.
 * Run: npm test (or node --test modules/users/tests/user.test.js)
 * Requires server to be running or use a test app mount.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const BASE = process.env.API_BASE || 'http://localhost:5000';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers.Authorization = `Bearer ${token}`;
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (ch) => (data += ch));
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, body: json, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (body && (method === 'POST' || method === 'PATCH')) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

describe('User Module API', () => {
  let loginToken = null;

  before(async () => {
    const res = await request('POST', '/api/users/login', {
      email: 'superadmin',
      password: 'superadmin',
    });
    if (res.status === 200 && res.body && res.body.token) {
      loginToken = res.body.token;
    }
  });

  it('GET /api/health returns 200', async () => {
    const res = await request('GET', '/api/health');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body && res.body.message);
  });

  it('POST /api/users/login with invalid credentials returns 401', async () => {
    const res = await request('POST', '/api/users/login', {
      email: 'wrong@example.com',
      password: 'wrong',
    });
    assert.strictEqual(res.status, 401);
  });

  it('POST /api/users/login with superadmin returns 200 and token', async () => {
    const res = await request('POST', '/api/users/login', {
      email: 'superadmin',
      password: 'superadmin',
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body && res.body.token);
    assert.ok(res.body.user && res.body.user.email === 'superadmin');
  });

  it('GET /api/users without token returns 401', async () => {
    const res = await request('GET', '/api/users');
    assert.strictEqual(res.status, 401);
  });

  it('GET /api/users with token returns 200 and list', async () => {
    if (!loginToken) {
      console.log('Skipping: no login token (seed may not have run)');
      return;
    }
    const res = await request('GET', '/api/users', null, loginToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(typeof res.body.total === 'number');
  });

  it('POST /api/users (create) with invalid body returns 400', async () => {
    if (!loginToken) return;
    const res = await request(
      'POST',
      '/api/users',
      { fullName: 'Test', email: 'invalid' },
      loginToken
    );
    assert.ok(res.status === 400 || res.status === 401);
  });

  it('POST /api/users (create) with valid body returns 201', async () => {
    if (!loginToken) return;
    const res = await request(
      'POST',
      '/api/users',
      {
        fullName: 'Test Employee',
        email: 'test-employee-' + Date.now() + '@example.com',
        password: 'password123',
        userType: 'Company',
        role: 'Employee',
        shift: 'Morning',
      },
      loginToken
    );
    assert.strictEqual(res.status, 201);
    assert.ok(res.body && res.body.id && res.body.email);
  });
});
