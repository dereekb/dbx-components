import { type IssuerProfile, type IssuerProfiles, OAUTH_PROTECTED_RESOURCE_PATH, firebaseIssuerForProject } from '@dereekb/oauth-resource';
import express, { type Express } from 'express';
import { createLocalJWKSet, exportJWK, SignJWT, type JWK } from 'jose';
import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { requireBearer } from './bearer.middleware';
import { createWellKnownRouter } from './well-known.router';

const OIDC_ISSUER = 'https://api.dereekb.test/oidc';
const FIREBASE_PROJECT = 'dereekb-components-test';
const RESOURCE_ORIGIN = 'https://db.dereekb.test';
const RESOURCE = `${RESOURCE_ORIGIN}/mcp`;
const RESOURCE_METADATA_URL = `${RESOURCE_ORIGIN}${OAUTH_PROTECTED_RESOURCE_PATH}/mcp`;
const REALM = 'dereekb-db';

interface TestKeys {
  readonly privateKey: KeyObject;
  readonly publicJwk: JWK;
  readonly kid: string;
}

async function buildKeys(kid: string): Promise<TestKeys> {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
  return { privateKey, publicJwk, kid };
}

describe('requireBearer()', () => {
  let keys: TestKeys;
  let profiles: IssuerProfiles;

  async function signToken(claims: Record<string, unknown>): Promise<string> {
    return new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: keys.kid }).setIssuer(OIDC_ISSUER).setAudience(RESOURCE).setSubject('uid-1').setIssuedAt().setExpirationTime('1h').sign(keys.privateKey);
  }

  function buildApp(app: Express): Express {
    app.get('/mcp', (req, res) => {
      res.json({ auth: req.auth });
    });
    return app;
  }

  beforeAll(async () => {
    keys = await buildKeys('oidc-1');

    const oidcProfile: IssuerProfile = { kind: 'oidc', issuer: OIDC_ISSUER, audiences: [RESOURCE_ORIGIN, RESOURCE], getKey: async () => createLocalJWKSet({ keys: [keys.publicJwk] }) };
    profiles = new Map([[OIDC_ISSUER, oidcProfile]]);
  });

  function appWithBearer(overrides?: Partial<Parameters<typeof requireBearer>[0]>): Express {
    const app = express();
    app.use(requireBearer({ verify: { profiles }, resourceMetadataUrl: RESOURCE_METADATA_URL, realm: REALM, ...overrides }));
    return buildApp(app);
  }

  it('should attach the verified bearer as req.auth', async () => {
    const token = await signToken({ client_id: 'claude', scope: 'openid profile' });
    const res = await request(appWithBearer()).get('/mcp').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.auth.clientId).toBe('claude');
    expect(res.body.auth.scopes).toEqual(['openid', 'profile']);
    expect(res.body.auth.extra.sub).toBe('uid-1');
  });

  it('should challenge with invalid_request when no token is presented', async () => {
    const res = await request(appWithBearer()).get('/mcp');

    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toBe(`Bearer realm="${REALM}", resource_metadata="${RESOURCE_METADATA_URL}", error="invalid_request"`);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('should challenge with invalid_token when the token is bad', async () => {
    const res = await request(appWithBearer()).get('/mcp').set('Authorization', 'Bearer not-a-jwt');

    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toContain('error="invalid_token"');
  });

  it('should challenge with insufficient_scope when a required scope is missing', async () => {
    const token = await signToken({ client_id: 'claude', scope: 'openid' });
    const res = await request(appWithBearer({ requiredScopes: ['profile'] }))
      .get('/mcp')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.headers['www-authenticate']).toContain('error="insufficient_scope"');
    expect(res.headers['www-authenticate']).toContain('scope="profile"');
  });

  it('should attach a placeholder auth when verification is disabled', async () => {
    const res = await request(appWithBearer({ authDisabled: true })).get('/mcp');

    expect(res.status).toBe(200);
    expect(res.body.auth.clientId).toBe('dev');
  });

  it('should use the configured error response factory', async () => {
    const res = await request(appWithBearer({ errorResponseFactory: () => ({ status: 418, code: 'unauthorized', body: { nope: true } }) }))
      .get('/mcp')
      .set('Authorization', 'Bearer not-a-jwt');

    expect(res.status).toBe(418);
    expect(res.body).toEqual({ nope: true });
  });
});

describe('createWellKnownRouter()', () => {
  const app = express().use(createWellKnownRouter({ resource: RESOURCE, authorizationServers: [OIDC_ISSUER, firebaseIssuerForProject(FIREBASE_PROJECT)], scopesSupported: ['openid'] }));

  it('should serve the metadata at the path-suffixed well-known path', async () => {
    const res = await request(app).get(`${OAUTH_PROTECTED_RESOURCE_PATH}/mcp`);

    expect(res.status).toBe(200);
    expect(res.body.resource).toBe(RESOURCE);
    expect(res.body.authorization_servers).toEqual([OIDC_ISSUER, firebaseIssuerForProject(FIREBASE_PROJECT)]);
    expect(res.body.bearer_methods_supported).toEqual(['header']);
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('should serve the metadata at the bare well-known path', async () => {
    const res = await request(app).get(OAUTH_PROTECTED_RESOURCE_PATH);

    expect(res.status).toBe(200);
    expect(res.body.resource).toBe(RESOURCE);
  });
});
