import { type INestApplication } from '@nestjs/common';
import { type Configurable, unixDateTimeSecondsNumberForNow } from '@dereekb/util';
import { buildIssuerProfiles, buildProtectedResourceMetadata, firebaseIssuerForProject, OAuthResourceError, OAUTH_PROTECTED_RESOURCE_PATH, type IssuerProfile, type IssuerProfiles, verifyBearerJwt } from '@dereekb/oauth-resource';
import { buildOidcResourceServer, firebaseServerIssuerProfiles, JwksService, OidcAccountService, OidcJwtSigningService, OidcModuleConfig, type OidcResourceServerInfo } from '@dereekb/firebase-server/oidc';
import { setupAndPerformFullOAuthFlow } from '@dereekb/firebase-server/test';
import { createLocalJWKSet, importJWK, SignJWT, type JWK, type JWTVerifyGetKey } from 'jose';
import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import request from 'supertest';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';

/**
 * A satellite resource server: an off-box service (a Docker'd sidecar, a worker, a standalone MCP
 * host) that the demo API issues tokens for but does not run in.
 *
 * Registered with `accessTokenFormat: 'jwt'` — the whole point of the exercise. The default opaque
 * format is a key into the provider's Firestore adapter, so a remote service cannot validate one.
 */
const SATELLITE_ORIGIN = 'https://satellite.test.dereekb.com';
const SATELLITE_RESOURCE = `${SATELLITE_ORIGIN}/mcp`;
const SATELLITE_SCOPE = 'openid profile email demo';
const REQUESTED_SCOPES = 'openid profile email demo';

/**
 * Reads the provider's published JWKS over HTTP, exactly as a remote resource server would, and
 * turns it into the key resolver an {@link IssuerProfile} verifies with.
 *
 * The socket is supertest's rather than a listening port, but the document is the real one the
 * emulator-hosted provider serves at `/.well-known/jwks.json`.
 *
 * @param app - The initialized NestJS application hosting the provider.
 * @returns The key resolver over the provider's live JWKS.
 */
async function fetchLiveJwks(app: INestApplication): Promise<JWTVerifyGetKey> {
  const res = await request(app.getHttpServer()).get('/.well-known/jwks.json').expect(200);
  return createLocalJWKSet({ keys: res.body.keys as JWK[] });
}

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  demoAuthorizedUserContext({ f }, (u) => {
    let app: INestApplication;
    let oidcModuleConfig: OidcModuleConfig;
    let jwksService: JwksService;
    let projectId: string;
    let issuer: string;
    let profiles: IssuerProfiles;

    beforeAll(() => {
      vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });
    });

    beforeEach(async () => {
      app = await f.loadInitializedNestApplication();
      oidcModuleConfig = app.get(OidcModuleConfig);
      jwksService = app.get(JwksService);
      projectId = app.get(OidcAccountService).authService.auth.app.options.projectId as string;
      issuer = oidcModuleConfig.issuer;

      // Register the satellite as a JWT-format resource server. `getResourceServerInfo` reads
      // `config.resourceServers` per request, so this takes effect on the already-built provider.
      (oidcModuleConfig as Configurable<OidcModuleConfig>).resourceServers = {
        ...oidcModuleConfig.resourceServers,
        ...buildOidcResourceServer({ url: SATELLITE_RESOURCE, scope: SATELLITE_SCOPE, audience: SATELLITE_ORIGIN, accessTokenFormat: 'jwt', accessTokenTTL: 3600 })
      } as Record<string, OidcResourceServerInfo>;

      await jwksService.rotateKeys();

      // The satellite's view of the world, emitted from the provider's OWN config so the two
      // cannot drift. The key set is re-read per verification because the flow helper rotates keys
      // itself, so a set captured here would not hold the key the issued token is signed with.
      profiles = buildIssuerProfiles(
        firebaseServerIssuerProfiles({
          oidcModuleConfig,
          firebaseProjectIds: [projectId],
          audiences: [SATELLITE_ORIGIN],
          getKey: () => fetchLiveJwks(app)
        })
      );
    });

    afterEach(async () => {
      await app.close();
    });

    describe('the OAuth flow across the package boundary', () => {
      it('should issue a JWT access token a remote resource server can verify', async () => {
        const result = await setupAndPerformFullOAuthFlow(app, u.uid, { scopes: REQUESTED_SCOPES, resource: SATELLITE_RESOURCE });

        // an opaque token has no dots; a JWT has exactly two
        expect(result.accessToken.split('.')).toHaveLength(3);

        const verified = await verifyBearerJwt(result.accessToken, { profiles });

        expect(verified.kind).toBe('oidc');
        expect(verified.issuer).toBe(issuer);
        expect(verified.subject).toBe(u.uid);
        expect(verified.claims.aud).toBe(SATELLITE_ORIGIN);
        expect(verified.claims['client_id']).toBeDefined();
        expect((verified.claims['scope'] as string).split(' ').sort()).toEqual(REQUESTED_SCOPES.split(' ').sort());
      });

      it('should NOT let a remote resource server verify an opaque access token', async () => {
        // the regression guard for the accessTokenFormat default: this is what makes an off-box
        // resource server impossible without `accessTokenFormat: 'jwt'`
        const result = await setupAndPerformFullOAuthFlow(app, u.uid, { scopes: REQUESTED_SCOPES });

        expect(result.accessToken.split('.')).not.toHaveLength(3);
        await expect(verifyBearerJwt(result.accessToken, { profiles })).rejects.toThrow(OAuthResourceError);
      });

      it('should accept the JWT access token on the API own protected paths', async () => {
        // the in-process half: a JWT access token is never persisted, so the provider's adapter
        // lookup always misses and OidcService must fall through to signature verification
        const result = await setupAndPerformFullOAuthFlow(app, u.uid, { scopes: REQUESTED_SCOPES, resource: SATELLITE_RESOURCE });
        const res = await request(app.getHttpServer()).post('/mcp').set('Authorization', `Bearer ${result.accessToken}`).send({});

        expect(res.status).not.toBe(401);
        expect(res.headers['www-authenticate']).toBeUndefined();
      });

      it('should resolve the same auth data from the JWT access token as from an opaque one', async () => {
        const result = await setupAndPerformFullOAuthFlow(app, u.uid, { scopes: REQUESTED_SCOPES, resource: SATELLITE_RESOURCE });
        const authData = await f.instance.apiServerNestContext.oidcService.verifyAccessToken(result.accessToken);

        expect(authData).toBeDefined();
        expect(authData?.uid).toBe(u.uid);
        expect(authData?.oidcValidatedToken.sub).toBe(u.uid);
        expect(authData?.oidcValidatedToken.scope).toBeDefined();
        expect(authData?.token.uid).toBe(u.uid);
      });
    });

    describe('the server-to-server leg', () => {
      it('should verify a token minted by OidcJwtSigningService for a resource origin', async () => {
        const signingService = app.get(OidcJwtSigningService);
        const signed = await signingService.signJwt({ audience: SATELLITE_ORIGIN, subject: 'demo-api', claims: { client_id: 'demo-api', scope: 'demo' } });
        const verified = await verifyBearerJwt(signed.token, { profiles });

        expect(verified.kind).toBe('oidc');
        expect(verified.issuer).toBe(issuer);
        expect(verified.subject).toBe('demo-api');
        expect(verified.claims.aud).toBe(SATELLITE_ORIGIN);
        expect(verified.claims['scope']).toBe('demo');
        expect(signed.expiresAt.getTime()).toBeGreaterThan(Date.now());
      });

      it('should still verify a token signed with a rotated-out key while it stays published', async () => {
        const signingService = app.get(OidcJwtSigningService);
        const signed = await signingService.signJwt({ audience: SATELLITE_ORIGIN, subject: 'demo-api' });

        await jwksService.rotateKeys();

        // the satellite refetches and sees both the new active key and the rotated-out one
        const rotatedJwks = await request(app.getHttpServer()).get('/.well-known/jwks.json').expect(200);
        expect((rotatedJwks.body.keys as JWK[]).map((key) => key.kid)).toContain(signed.kid);

        const verified = await verifyBearerJwt(signed.token, { profiles });

        expect(verified.subject).toBe('demo-api');
      });
    });

    describe('the firebase leg', () => {
      function emulatorIdToken(uid: string, overrides?: Record<string, unknown>): string {
        const now = unixDateTimeSecondsNumberForNow();
        const payload = {
          iss: firebaseIssuerForProject(projectId),
          aud: projectId,
          auth_time: now,
          user_id: uid,
          sub: uid,
          iat: now,
          exp: now + 3600,
          firebase: { identities: {}, sign_in_provider: 'custom' },
          ...overrides
        };

        const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
        const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
        return `${header}.${body}.`;
      }

      it('should verify an emulator ID token through the firebase profile', async () => {
        const verified = await verifyBearerJwt(emulatorIdToken(u.uid), { profiles, firebaseEmulator: true });

        expect(verified.kind).toBe('firebase');
        expect(verified.issuer).toBe(firebaseIssuerForProject(projectId));
        expect(verified.subject).toBe(u.uid);
      });

      it('should reject an emulator ID token when the emulator flag is off', async () => {
        await expect(verifyBearerJwt(emulatorIdToken(u.uid), { profiles })).rejects.toThrow(OAuthResourceError);
      });

      it('should reject an emulator ID token for another project', async () => {
        await expect(verifyBearerJwt(emulatorIdToken(u.uid, { aud: 'some-other-project' }), { profiles, firebaseEmulator: true })).rejects.toThrow(/aud/);
      });
    });

    describe('the failure matrix', () => {
      let rogueKeys: { readonly privateKey: KeyObject; readonly kid: string };

      beforeEach(() => {
        const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        rogueKeys = { privateKey, kid: 'rogue-1' };
      });

      /**
       * Signs a token with the provider's CURRENT active JWKS key, so it passes signature
       * verification and the assertion is about the claims alone.
       *
       * @param build - Applies the claims to the builder.
       * @returns The compact token.
       */
      async function signWithProviderKey(build: (builder: SignJWT) => SignJWT): Promise<string> {
        const jwk = (await jwksService.getActiveSigningKey()) as JWK & { readonly kid: string };
        const key = await importJWK(jwk, 'RS256');
        return build(new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: jwk.kid })).sign(key);
      }

      async function signRogue(overrides: { readonly issuer?: string; readonly audience?: string; readonly subject?: string; readonly expiresAt?: number; readonly notBefore?: number; readonly alg?: string }): Promise<string> {
        let builder = new SignJWT({})
          .setProtectedHeader({ alg: overrides.alg ?? 'RS256', kid: rogueKeys.kid })
          .setIssuer(overrides.issuer ?? issuer)
          .setAudience(overrides.audience ?? SATELLITE_ORIGIN)
          .setIssuedAt()
          .setExpirationTime(overrides.expiresAt ?? unixDateTimeSecondsNumberForNow() + 3600);

        if (overrides.subject !== undefined) {
          builder = builder.setSubject(overrides.subject);
        }

        if (overrides.notBefore !== undefined) {
          builder = builder.setNotBefore(overrides.notBefore);
        }

        return builder.sign(rogueKeys.privateKey);
      }

      it('should reject an untrusted issuer', async () => {
        await expect(verifyBearerJwt(await signRogue({ issuer: 'https://evil.test.dereekb.com', subject: u.uid }), { profiles })).rejects.toThrow(/Untrusted token issuer/);
      });

      it('should reject a malformed token', async () => {
        await expect(verifyBearerJwt('not-a-jwt', { profiles })).rejects.toThrow(/Malformed bearer token/);
      });

      it('should reject a token signed with an unknown kid', async () => {
        await expect(verifyBearerJwt(await signRogue({ subject: u.uid }), { profiles })).rejects.toThrow(/Invalid bearer token/);
      });

      it('should reject a token with the wrong audience', async () => {
        const signingService = app.get(OidcJwtSigningService);
        const signed = await signingService.signJwt({ audience: 'https://elsewhere.test.dereekb.com', subject: 'demo-api' });

        await expect(verifyBearerJwt(signed.token, { profiles })).rejects.toThrow(/ERR_JWT_CLAIM_VALIDATION_FAILED/);
      });

      it('should reject an expired token', async () => {
        const signingService = app.get(OidcJwtSigningService);
        const signed = await signingService.signJwt({ audience: SATELLITE_ORIGIN, subject: 'demo-api', expiresIn: 1 });

        await expect(verifyBearerJwt(signed.token, { profiles, nowSeconds: () => unixDateTimeSecondsNumberForNow() + 3600 })).rejects.toThrow(/ERR_JWT_EXPIRED/);
      });

      it('should reject a token whose nbf is in the future', async () => {
        const now = unixDateTimeSecondsNumberForNow();
        const token = await signWithProviderKey((builder) =>
          builder
            .setIssuer(issuer)
            .setAudience(SATELLITE_ORIGIN)
            .setSubject('demo-api')
            .setIssuedAt(now)
            .setNotBefore(now + 3600)
            .setExpirationTime(now + 7200)
        );

        await expect(verifyBearerJwt(token, { profiles })).rejects.toThrow(/ERR_JWT_CLAIM_VALIDATION_FAILED/);
      });

      it('should reject a token with no subject', async () => {
        const signingService = app.get(OidcJwtSigningService);
        const signed = await signingService.signJwt({ audience: SATELLITE_ORIGIN, subject: '' });

        await expect(verifyBearerJwt(signed.token, { profiles })).rejects.toThrow(/no subject/);
      });

      it('should reject an HS256 token forged against the published RSA key material', async () => {
        // alg confusion: the attacker signs with the public key bytes as an HMAC secret
        const jwks = await request(app.getHttpServer()).get('/.well-known/jwks.json').expect(200);
        const publicJwk = jwks.body.keys[0] as JWK;
        const secret = Buffer.from(JSON.stringify(publicJwk));
        const forged = await new SignJWT({}).setProtectedHeader({ alg: 'HS256', kid: publicJwk.kid }).setIssuer(issuer).setAudience(SATELLITE_ORIGIN).setSubject(u.uid).setIssuedAt().setExpirationTime('1h').sign(secret);

        await expect(verifyBearerJwt(forged, { profiles })).rejects.toThrow(/Invalid bearer token/);
      });
    });

    describe('RFC 9728 + RFC 6750 discovery and challenge', () => {
      it('should build the protected-resource metadata from the provider config', () => {
        const metadata = buildProtectedResourceMetadata({ resource: SATELLITE_RESOURCE, authorizationServers: [issuer], scopesSupported: SATELLITE_SCOPE.split(' ') });

        expect(metadata.resource).toBe(SATELLITE_RESOURCE);
        expect(metadata.authorization_servers).toEqual([issuer]);
        expect(metadata.scopes_supported).toEqual(['openid', 'profile', 'email', 'demo']);
        expect(metadata.bearer_methods_supported).toEqual(['header']);
      });

      it('should advertise the provider as the authorization server it claims to be', async () => {
        const res = await request(app.getHttpServer()).get('/.well-known/openid-configuration').expect(200);

        expect(res.body.issuer).toBe(issuer);
        expect(res.body.jwks_uri).toBeDefined();
      });

      it('should discover the JWKS from the live discovery document', async () => {
        // exercises buildIssuerProfiles' own discovery path against the real document
        // the provider mounts `.well-known` at the origin root while the issuer carries a `/oidc`
        // path, so strip the issuer prefix to land on the route supertest can serve
        let requestedPath: string | undefined;
        const fetchViaServer: typeof fetch = async (input) => {
          requestedPath = String(input).slice(issuer.length);
          const res = await request(app.getHttpServer()).get(requestedPath);
          return new Response(JSON.stringify(res.body), { status: res.status, headers: { 'content-type': 'application/json' } });
        };

        const discovered = buildIssuerProfiles({ oidcIssuers: [issuer], audiences: [SATELLITE_ORIGIN], fetch: fetchViaServer });
        const profile = discovered.get(issuer) as IssuerProfile;

        expect(profile).toBeDefined();
        await expect(profile.getKey()).resolves.toBeDefined();
        expect(requestedPath).toBe('/.well-known/openid-configuration');
      });

      it('should challenge with invalid_request when no token is presented', async () => {
        const res = await request(app.getHttpServer()).post('/mcp').send({}).expect(401);

        expect(res.headers['www-authenticate']).toMatch(/^Bearer\b/);
        expect(res.headers['www-authenticate']).toMatch(/error="invalid_request"/);
        expect(res.headers['www-authenticate']).toContain(`resource_metadata="${oidcModuleConfig.resourceMetadataUrl}"`);
      });

      it('should challenge with invalid_token when the token is bad', async () => {
        const res = await request(app.getHttpServer()).post('/mcp').set('Authorization', 'Bearer not-a-real-token').send({}).expect(401);

        expect(res.headers['www-authenticate']).toMatch(/error="invalid_token"/);
      });

      it('should serve the protected-resource metadata path the challenge points at', () => {
        expect(oidcModuleConfig.resourceMetadataUrl).toContain(OAUTH_PROTECTED_RESOURCE_PATH);
      });
    });

    describe('firebaseServerIssuerProfiles()', () => {
      it('should accept every registered resource server audience', async () => {
        const config = firebaseServerIssuerProfiles({ oidcModuleConfig, firebaseProjectIds: [projectId] });
        const oidcEntry = config.oidcIssuers?.[0] as { readonly issuer: string; readonly audiences: readonly string[] };

        expect(oidcEntry.issuer).toBe(issuer);
        expect(oidcEntry.audiences).toContain(SATELLITE_RESOURCE);
        expect(oidcEntry.audiences).toContain(SATELLITE_ORIGIN);
        expect(config.firebaseProjectIds).toEqual([projectId]);
      });

      it('should produce a profile map holding both legs', async () => {
        const built = buildIssuerProfiles(firebaseServerIssuerProfiles({ oidcModuleConfig, firebaseProjectIds: [projectId], getKey: async () => createLocalJWKSet({ keys: [] }) }));

        expect(built.get(issuer)?.kind).toBe('oidc');
        expect(built.get(firebaseIssuerForProject(projectId))?.kind).toBe('firebase');
      });
    });
  });
});
