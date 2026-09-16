import { beforeAll, describe, expect, it } from 'vitest';
import { exportJWK, generateKeyPair } from 'jose';
import { DOWNLOAD_TOKEN_AUDIENCE, DOWNLOAD_TOKEN_TYP } from '@dereekb/firebase-server';
import { type OidcModuleConfig } from '../oidc.config';
import { type JwksService } from './oidc.jwks.service';
import { DEFAULT_OIDC_SIGNED_JWT_TYP, OidcJwtSigningService } from './oidc.jwt-signing.service';

const TEST_ISSUER = 'https://test.dereekb.com/oidc';
const TEST_RESOURCE_AUDIENCE = 'https://test.dereekb.com/mcp';

/**
 * Coverage for the `typ` + `aud` discriminators that keep a signed asset-download capability token
 * and an OAuth JWT access token from ever being interchangeable.
 *
 * They are signed by the SAME JWKS — that is the whole reason the download path needs no new secret —
 * so the discriminators are the only thing separating them, and this spec asserts the rejection in
 * BOTH directions.
 */
describe('OidcJwtSigningService download-token discrimination', () => {
  let service: OidcJwtSigningService;

  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
    const privateJwk = { ...(await exportJWK(privateKey)), kid: 'test-kid', alg: 'RS256', use: 'sig' };
    const publicJwk = { ...(await exportJWK(publicKey)), kid: 'test-kid', alg: 'RS256', use: 'sig' };

    const jwks = {
      getActiveSigningKey: async () => privateJwk,
      generateKeyPair: async () => ({ signingKey: privateJwk }),
      getLatestPublicJwks: async () => ({ keys: [publicJwk] })
    } as unknown as JwksService;

    service = new OidcJwtSigningService(jwks, { issuer: TEST_ISSUER } as OidcModuleConfig);
  });

  it('verifies a download token presented with its own typ + audience', async () => {
    const signed = await service.signJwt({ audience: DOWNLOAD_TOKEN_AUDIENCE, subject: 'dbx:asset', typ: DOWNLOAD_TOKEN_TYP, expiresIn: 600, claims: { p: 'demo-cli' } });
    const payload = await service.verifyJwt({ token: signed.token, audience: DOWNLOAD_TOKEN_AUDIENCE, typ: DOWNLOAD_TOKEN_TYP });

    expect(payload?.['p']).toBe('demo-cli');
    expect(payload?.jti).toBeDefined();
  });

  it('rejects a download token presented as an access token (wrong audience AND wrong typ)', async () => {
    const downloadToken = await service.signJwt({ audience: DOWNLOAD_TOKEN_AUDIENCE, subject: 'dbx:asset', typ: DOWNLOAD_TOKEN_TYP, expiresIn: 600, claims: { p: 'demo-cli' } });

    // this is the shape `OidcService.verifyAccessToken` uses: the registered resource-server
    // audiences plus the issuer, with the RFC 9068 `at+jwt` typ
    await expect(service.verifyJwt({ token: downloadToken.token, audience: [TEST_RESOURCE_AUDIENCE, TEST_ISSUER], typ: DEFAULT_OIDC_SIGNED_JWT_TYP })).resolves.toBeUndefined();
    await expect(service.verifyJwt({ token: downloadToken.token, audience: [TEST_RESOURCE_AUDIENCE, TEST_ISSUER] })).resolves.toBeUndefined();
  });

  it('rejects an access token presented as a download token (wrong audience AND wrong typ)', async () => {
    const accessToken = await service.signJwt({ audience: TEST_RESOURCE_AUDIENCE, subject: 'some-uid', expiresIn: 600, claims: { scope: 'openid demo', p: 'demo-cli' } });

    expect(accessToken.token).toBeDefined();
    await expect(service.verifyJwt({ token: accessToken.token, audience: DOWNLOAD_TOKEN_AUDIENCE, typ: DOWNLOAD_TOKEN_TYP })).resolves.toBeUndefined();
  });

  it('rejects a download-audience token minted with the wrong typ', async () => {
    // an attacker who could choose only the audience must still not be able to produce a token the
    // download verifier accepts
    const wrongTyp = await service.signJwt({ audience: DOWNLOAD_TOKEN_AUDIENCE, subject: 'dbx:asset', expiresIn: 600, claims: { p: 'demo-cli' } });

    await expect(service.verifyJwt({ token: wrongTyp.token, audience: DOWNLOAD_TOKEN_AUDIENCE, typ: DOWNLOAD_TOKEN_TYP })).resolves.toBeUndefined();
  });

  it('rejects an expired download token', async () => {
    const expired = await service.signJwt({ audience: DOWNLOAD_TOKEN_AUDIENCE, subject: 'dbx:asset', typ: DOWNLOAD_TOKEN_TYP, expiresIn: -60, claims: { p: 'demo-cli' } });

    await expect(service.verifyJwt({ token: expired.token, audience: DOWNLOAD_TOKEN_AUDIENCE, typ: DOWNLOAD_TOKEN_TYP })).resolves.toBeUndefined();
  });

  it('rejects a token from a different issuer', async () => {
    const other = new OidcJwtSigningService(
      {
        getActiveSigningKey: async () => ({ ...(await exportJWK((await generateKeyPair('RS256', { extractable: true })).privateKey)), kid: 'other-kid', alg: 'RS256', use: 'sig' }),
        generateKeyPair: async () => {
          throw new Error('not used');
        },
        getLatestPublicJwks: async () => ({ keys: [] })
      } as unknown as JwksService,
      { issuer: 'https://evil.example.com/oidc' } as OidcModuleConfig
    );

    const foreign = await other.signJwt({ audience: DOWNLOAD_TOKEN_AUDIENCE, subject: 'dbx:asset', typ: DOWNLOAD_TOKEN_TYP, expiresIn: 600, claims: { p: 'demo-cli' } });

    await expect(service.verifyJwt({ token: foreign.token, audience: DOWNLOAD_TOKEN_AUDIENCE, typ: DOWNLOAD_TOKEN_TYP })).resolves.toBeUndefined();
  });
});
