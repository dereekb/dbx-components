import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { createLocalJWKSet, exportJWK, SignJWT, type JWK } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { OAuthResourceError, type OAuthResourceErrorCode, type OAuthResourceErrorFactory } from '../error/oauth.resource.error';
import { firebaseIssuerForProject, type IssuerProfile, type IssuerProfiles } from '../issuer/issuer.profile';
import { verifyBearerJwt, type VerifyBearerOptions } from './verify.bearer';

const FIREBASE_PROJECT = 'dereekb-components-test';
const FIREBASE_ISSUER = firebaseIssuerForProject(FIREBASE_PROJECT);
const OIDC_ISSUER = 'https://api.dereekb.test/oidc';
const RESOURCE_ORIGIN = 'https://db.dereekb.test';
const NOW = 1_800_000_000;

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

interface SignInput {
  readonly keys: TestKeys;
  readonly issuer: string;
  readonly audience: string | readonly string[];
  readonly subject?: string;
  readonly expiresAt?: number;
  readonly issuedAt?: number;
  readonly notBefore?: number;
  readonly claims?: Record<string, unknown>;
}

async function sign(input: SignInput): Promise<string> {
  let builder = new SignJWT({ ...input.claims })
    .setProtectedHeader({ alg: 'RS256', kid: input.keys.kid })
    .setIssuer(input.issuer)
    .setAudience([...(typeof input.audience === 'string' ? [input.audience] : input.audience)])
    .setIssuedAt(input.issuedAt ?? NOW - 10)
    .setExpirationTime(input.expiresAt ?? NOW + 3600);

  if (input.subject !== undefined) {
    builder = builder.setSubject(input.subject);
  }

  if (input.notBefore !== undefined) {
    builder = builder.setNotBefore(input.notBefore);
  }

  return builder.sign(input.keys.privateKey);
}

// An unsigned emulator-style token: base64url header + payload, empty signature.
function unsignedToken(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`;
}

describe('verifyBearerJwt()', () => {
  let firebaseKeys: TestKeys;
  let oidcKeys: TestKeys;
  let profiles: IssuerProfiles;
  let baseOptions: VerifyBearerOptions;

  beforeAll(async () => {
    firebaseKeys = await buildKeys('firebase-1');
    oidcKeys = await buildKeys('oidc-1');

    const firebaseProfile: IssuerProfile = { kind: 'firebase', issuer: FIREBASE_ISSUER, audiences: [FIREBASE_PROJECT], getKey: async () => createLocalJWKSet({ keys: [firebaseKeys.publicJwk] }) };
    const oidcProfile: IssuerProfile = { kind: 'oidc', issuer: OIDC_ISSUER, audiences: [RESOURCE_ORIGIN, `${RESOURCE_ORIGIN}/mcp`], getKey: async () => createLocalJWKSet({ keys: [oidcKeys.publicJwk] }) };

    profiles = new Map([
      [FIREBASE_ISSUER, firebaseProfile],
      [OIDC_ISSUER, oidcProfile]
    ]);
    baseOptions = { profiles, firebaseEmulator: false, nowSeconds: () => NOW };
  });

  async function expectRejection(promise: Promise<unknown>, code: OAuthResourceErrorCode, messagePattern: RegExp): Promise<void> {
    const error = await promise.then(() => undefined).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OAuthResourceError);
    expect((error as OAuthResourceError).code).toBe(code);
    expect((error as OAuthResourceError).message).toMatch(messagePattern);
  }

  describe('firebase profile', () => {
    it('should accept a valid Firebase ID token', async () => {
      const token = await sign({ keys: firebaseKeys, issuer: FIREBASE_ISSUER, audience: FIREBASE_PROJECT, subject: 'uid-1', claims: { auth_time: NOW - 100, o: true } });
      const verified = await verifyBearerJwt(token, baseOptions);

      expect(verified.kind).toBe('firebase');
      expect(verified.issuer).toBe(FIREBASE_ISSUER);
      expect(verified.subject).toBe('uid-1');
      expect(verified.token).toBe(token);
    });

    it('should reject a token with the wrong audience', async () => {
      const token = await sign({ keys: firebaseKeys, issuer: FIREBASE_ISSUER, audience: 'other-project', subject: 'uid-1' });
      await expectRejection(verifyBearerJwt(token, baseOptions), 'unauthorized', /ERR_JWT_CLAIM_VALIDATION_FAILED/);
    });

    it('should reject an expired token (beyond the 60 s tolerance)', async () => {
      const token = await sign({ keys: firebaseKeys, issuer: FIREBASE_ISSUER, audience: FIREBASE_PROJECT, subject: 'uid-1', expiresAt: NOW - 120 });
      await expectRejection(verifyBearerJwt(token, baseOptions), 'unauthorized', /ERR_JWT_EXPIRED/);
    });

    it('should accept a token that expired within the 60 s tolerance', async () => {
      const token = await sign({ keys: firebaseKeys, issuer: FIREBASE_ISSUER, audience: FIREBASE_PROJECT, subject: 'uid-1', expiresAt: NOW - 30 });
      const verified = await verifyBearerJwt(token, baseOptions);

      expect(verified.subject).toBe('uid-1');
    });

    it('should reject a token whose nbf is in the future', async () => {
      const token = await sign({ keys: firebaseKeys, issuer: FIREBASE_ISSUER, audience: FIREBASE_PROJECT, subject: 'uid-1', notBefore: NOW + 600 });
      await expectRejection(verifyBearerJwt(token, baseOptions), 'unauthorized', /ERR_JWT_CLAIM_VALIDATION_FAILED/);
    });

    it('should reject a token signed by an unknown key', async () => {
      const rogue = await buildKeys('firebase-1'); // same kid, different key
      const token = await sign({ keys: rogue, issuer: FIREBASE_ISSUER, audience: FIREBASE_PROJECT, subject: 'uid-1' });
      await expectRejection(verifyBearerJwt(token, baseOptions), 'unauthorized', /Invalid bearer token/);
    });

    it('should reject a token whose kid is unknown to the key set', async () => {
      const rotatedOut = await buildKeys('firebase-unpublished');
      const token = await sign({ keys: rotatedOut, issuer: FIREBASE_ISSUER, audience: FIREBASE_PROJECT, subject: 'uid-1' });
      await expectRejection(verifyBearerJwt(token, baseOptions), 'unauthorized', /Invalid bearer token/);
    });

    it('should reject a token without a subject', async () => {
      const token = await sign({ keys: firebaseKeys, issuer: FIREBASE_ISSUER, audience: FIREBASE_PROJECT });
      await expectRejection(verifyBearerJwt(token, baseOptions), 'unauthorized', /no subject/);
    });

    it('should reject a token whose auth_time is in the future', async () => {
      const token = await sign({ keys: firebaseKeys, issuer: FIREBASE_ISSUER, audience: FIREBASE_PROJECT, subject: 'uid-1', claims: { auth_time: NOW + 600 } });
      await expectRejection(verifyBearerJwt(token, baseOptions), 'unauthorized', /auth_time/);
    });
  });

  describe('claim gates', () => {
    it('should gate on a required claim', async () => {
      const withoutClaim = await sign({ keys: firebaseKeys, issuer: FIREBASE_ISSUER, audience: FIREBASE_PROJECT, subject: 'uid-1' });
      const withClaim = await sign({ keys: firebaseKeys, issuer: FIREBASE_ISSUER, audience: FIREBASE_PROJECT, subject: 'uid-1', claims: { o: true } });
      const options: VerifyBearerOptions = { ...baseOptions, requiredClaims: ['o'] };

      await expectRejection(verifyBearerJwt(withoutClaim, options), 'forbidden', /required "o" claim/);
      expect((await verifyBearerJwt(withClaim, options)).subject).toBe('uid-1');
    });

    it('should gate on the claim predicate', async () => {
      const token = await sign({ keys: firebaseKeys, issuer: FIREBASE_ISSUER, audience: FIREBASE_PROJECT, subject: 'uid-1', claims: { tier: 'free' } });

      await expectRejection(verifyBearerJwt(token, { ...baseOptions, claimPredicate: (claims) => claims['tier'] === 'pro' }), 'forbidden', /claim policy/);
      expect((await verifyBearerJwt(token, { ...baseOptions, claimPredicate: async (claims) => claims['tier'] === 'free' })).subject).toBe('uid-1');
    });

    it('should not run the claim gates on OIDC tokens by default', async () => {
      const token = await sign({ keys: oidcKeys, issuer: OIDC_ISSUER, audience: RESOURCE_ORIGIN, subject: 'api' });
      const verified = await verifyBearerJwt(token, { ...baseOptions, requiredClaims: ['o'], claimPredicate: () => false });

      expect(verified.subject).toBe('api');
    });

    it('should run the claim gates on OIDC tokens when the kind is opted in', async () => {
      const token = await sign({ keys: oidcKeys, issuer: OIDC_ISSUER, audience: RESOURCE_ORIGIN, subject: 'api' });
      await expectRejection(verifyBearerJwt(token, { ...baseOptions, requiredClaims: ['o'], claimGateKinds: ['firebase', 'oidc'] }), 'forbidden', /required "o" claim/);
    });
  });

  describe('error factory', () => {
    class AppError extends Error {
      constructor(readonly code: OAuthResourceErrorCode) {
        super(`app:${code}`);
      }
    }

    const errorFactory: OAuthResourceErrorFactory = (input) => new AppError(input.code);

    it('should throw the consumer error type for an invalid token', async () => {
      const error = await verifyBearerJwt('not-a-jwt', { ...baseOptions, errorFactory }).then(
        () => undefined,
        (e: unknown) => e
      );

      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('unauthorized');
    });

    it('should throw the consumer error type for a policy failure', async () => {
      const token = await sign({ keys: firebaseKeys, issuer: FIREBASE_ISSUER, audience: FIREBASE_PROJECT, subject: 'uid-1' });
      const error = await verifyBearerJwt(token, { ...baseOptions, errorFactory, requiredClaims: ['o'] }).then(
        () => undefined,
        (e: unknown) => e
      );

      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('forbidden');
    });
  });

  describe('firebase emulator (alg: none)', () => {
    const payload = { iss: FIREBASE_ISSUER, aud: FIREBASE_PROJECT, sub: 'emu-1', iat: NOW - 10, exp: NOW + 3600, auth_time: NOW - 10 };

    it('should reject an unsigned token when the emulator flag is off', async () => {
      await expectRejection(verifyBearerJwt(unsignedToken(payload), baseOptions), 'unauthorized', /Invalid bearer token/);
    });

    it('should accept an unsigned token when the emulator flag is on', async () => {
      const verified = await verifyBearerJwt(unsignedToken(payload), { ...baseOptions, firebaseEmulator: true });

      expect(verified.kind).toBe('firebase');
      expect(verified.subject).toBe('emu-1');
    });

    it('should still enforce aud + exp + nbf on an unsigned emulator token', async () => {
      const options: VerifyBearerOptions = { ...baseOptions, firebaseEmulator: true };

      await expectRejection(verifyBearerJwt(unsignedToken({ ...payload, aud: 'other' }), options), 'unauthorized', /aud/);
      await expectRejection(verifyBearerJwt(unsignedToken({ ...payload, exp: NOW - 600 }), options), 'unauthorized', /ERR_JWT_EXPIRED/);
      await expectRejection(verifyBearerJwt(unsignedToken({ ...payload, nbf: NOW + 600 }), options), 'unauthorized', /nbf/);
    });

    it('should never accept an unsigned token for an OIDC issuer', async () => {
      const options: VerifyBearerOptions = { ...baseOptions, firebaseEmulator: true };
      await expectRejection(verifyBearerJwt(unsignedToken({ ...payload, iss: OIDC_ISSUER, aud: RESOURCE_ORIGIN }), options), 'unauthorized', /Invalid bearer token/);
    });
  });

  describe('oidc profile', () => {
    it('should accept an API-minted token with the origin audience', async () => {
      const token = await sign({ keys: oidcKeys, issuer: OIDC_ISSUER, audience: RESOURCE_ORIGIN, subject: 'dereekb-api', claims: { client_id: 'dereekb-api', scope: 'openid' } });
      const verified = await verifyBearerJwt(token, baseOptions);

      expect(verified.kind).toBe('oidc');
      expect(verified.subject).toBe('dereekb-api');
      expect(verified.claims['client_id']).toBe('dereekb-api');
    });

    it('should accept an OAuth access token with the /mcp resource audience', async () => {
      const token = await sign({ keys: oidcKeys, issuer: OIDC_ISSUER, audience: `${RESOURCE_ORIGIN}/mcp`, subject: 'user-1', claims: { client_id: 'claude', scope: 'openid profile' } });
      const verified = await verifyBearerJwt(token, baseOptions);

      expect(verified.kind).toBe('oidc');
      expect(verified.subject).toBe('user-1');
    });

    it('should reject an OIDC token aimed at another resource', async () => {
      const token = await sign({ keys: oidcKeys, issuer: OIDC_ISSUER, audience: 'https://api.dereekb.test/mcp', subject: 'user-1' });
      await expectRejection(verifyBearerJwt(token, baseOptions), 'unauthorized', /ERR_JWT_CLAIM_VALIDATION_FAILED/);
    });

    it('should reject a token signed with a disallowed algorithm', async () => {
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'PS256', kid: oidcKeys.kid })
        .setIssuer(OIDC_ISSUER)
        .setAudience(RESOURCE_ORIGIN)
        .setSubject('user-1')
        .setIssuedAt(NOW - 10)
        .setExpirationTime(NOW + 3600)
        .sign(oidcKeys.privateKey);

      await expectRejection(verifyBearerJwt(token, baseOptions), 'unauthorized', /Invalid bearer token/);
    });
  });

  describe('issuer dispatch', () => {
    it('should reject a token from an untrusted issuer', async () => {
      const token = await sign({ keys: oidcKeys, issuer: 'https://evil.test', audience: RESOURCE_ORIGIN, subject: 'x' });
      await expectRejection(verifyBearerJwt(token, baseOptions), 'unauthorized', /Untrusted token issuer/);
    });

    it('should reject a malformed token', async () => {
      await expectRejection(verifyBearerJwt('not-a-jwt', baseOptions), 'unauthorized', /Malformed bearer token/);
    });

    it('should reject a token with no issuer', async () => {
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', kid: oidcKeys.kid })
        .setSubject('x')
        .setExpirationTime(NOW + 100)
        .sign(oidcKeys.privateKey);
      await expectRejection(verifyBearerJwt(token, baseOptions), 'unauthorized', /Untrusted token issuer/);
    });
  });
});
