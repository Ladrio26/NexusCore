#!/usr/bin/env node
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { buildApp } from '../src/app.js';
import { getJwtSecret } from '../src/config/auth.js';

process.env.JWT_SECRET ||= 'smoke-test-secret';

function logStep(message) {
  console.log(`[smoke] ${message}`);
}

async function main() {
  const app = await buildApp({ logger: false });

  try {
    logStep('verification du healthcheck');
    const health = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(health.statusCode, 200, `health status attendu 200, recu ${health.statusCode}`);
    assert.deepEqual(JSON.parse(health.body), { status: 'ok' });

    logStep('verification de register sans payload');
    const registerMissing = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {}
    });
    assert.equal(registerMissing.statusCode, 400);
    assert.equal(JSON.parse(registerMissing.body).error, 'PSEUDO_EMAIL_AND_PASSWORD_REQUIRED');

    logStep('verification de login sans payload');
    const loginMissing = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {}
    });
    assert.equal(loginMissing.statusCode, 400);
    assert.equal(JSON.parse(loginMissing.body).error, 'PSEUDO_AND_PASSWORD_REQUIRED');

    logStep('verification auth/me sans token');
    const meWithoutToken = await app.inject({
      method: 'GET',
      url: '/auth/me'
    });
    assert.equal(meWithoutToken.statusCode, 401);

    logStep('verification auth/me avec token invalide');
    const meWithInvalidToken = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: 'Bearer invalid-token' }
    });
    assert.equal(meWithInvalidToken.statusCode, 401);

    logStep('verification route admin avec token non admin');
    const playerToken = jwt.sign(
      {
        id: 1,
        email: 'player@example.test',
        display_name: 'Player',
        role: 'player'
      },
      getJwtSecret(),
      { expiresIn: '5m' }
    );
    const adminDenied = await app.inject({
      method: 'GET',
      url: '/admin/units',
      headers: { authorization: `Bearer ${playerToken}` }
    });
    assert.equal(adminDenied.statusCode, 403);

    console.log('Smoke tests OK');
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
