import request from 'supertest';
import {
  EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE,
  USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE,
  type UserExternalConnectionAccessToken,
  userExternalConnectionTokenApiPath,
  ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as ZOHO
} from '@dereekb/firebase';
import { type FirebaseServerEnvService, MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE } from '@dereekb/firebase-server';
import { oAuthAuthorizedSuperTestContextFactory } from '@dereekb/firebase-server/test';
import { MS_IN_MINUTE } from '@dereekb/util';
import { DEMO_ZOHO_ADMIN_EXTERNAL_CONNECTION_PROVIDER_TYPE as ZOHO_ADMIN, EXTERNAL_TOKEN_OIDC_PROVIDER_PROFILE_KEY } from 'demo-firebase';
import { DEMO_EXTERNAL_CONNECTION_TOKEN_OIDC_CLIENT_IDS_ENV_KEY, demoExternalConnectionTokenApiModuleConfigFactory } from './externaltoken.module';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoOAuthAuthorizedSuperTestContext, demoUserExternalConnectionContext, demoUserExternalConnectionTestCredentials } from '../../../test/fixture';

vi.setConfig({ hookTimeout: 40000, testTimeout: 40000 });

const ZOHO_ADMIN_TOKEN_PATH = `/api${userExternalConnectionTokenApiPath(ZOHO_ADMIN)}`;
const ZOHO_TOKEN_PATH = `/api${userExternalConnectionTokenApiPath(ZOHO)}`;

/**
 * OAuth fixture shaped like demo-cli's dedicated `external-token` env: a client assigned the admin-only
 * `external-token` provider profile, requesting `openid offline_access token.external` and nothing else.
 *
 * Both halves are required: the scope is unlocked ONLY by that profile (so the client has to carry it),
 * and the test flow's default "all registered scopes" resolution excludes assignment-only scopes (so
 * it has to be spelled out).
 */
const demoOAuthSuperTestContextWithExternalTokenScope = oAuthAuthorizedSuperTestContextFactory({
  clientName: 'demo-external-token-oauth-context',
  providerProfiles: [EXTERNAL_TOKEN_OIDC_PROVIDER_PROFILE_KEY],
  scopes: `openid offline_access ${EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE}`
});

/**
 * The provider values a real Zoho connection stores beside its tokens. `apiDomain` + `location` are on
 * the Zoho adapter's export allowlist; `accountsServer` is not, so it must never leave the server.
 */
const ZOHO_ADMIN_EXTRA = { apiDomain: 'https://www.zohoapis.com', location: 'us', accountsServer: 'https://accounts.zoho.com' };

/**
 * Coverage for the external connection token API (`GET /api/session/external/:providerType`) as wired
 * into demo-api by `DemoExternalConnectionTokenApiModule` — the endpoint `demo-cli external-token`
 * calls to hand zoho-cli a `zoho_admin` access token.
 *
 * Every demo-side gate is exercised:
 *
 * 1. The OIDC client allowlist (`DEMO_EXTERNAL_CONNECTION_TOKEN_OIDC_CLIENT_IDS`; unset outside
 *    production means any client).
 * 2. The admin predicate — the load-bearing check.
 * 3. The `token.external` OIDC scope.
 * 4. The provider's `tokenExport` policy: `zoho_admin` is opted in, plain `zoho` is not.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describe('GET /api/session/external/:providerType', () => {
    describe('admin caller holding the token.external scope', () => {
      demoAuthorizedUserAdminContext({ f }, (au) => {
        demoUserExternalConnectionContext({ f, u: au }, (uec) => {
          demoOAuthSuperTestContextWithExternalTokenScope({ f, u: au }, (oauth) => {
            describe('with a zoho_admin connection', () => {
              beforeEach(async () => {
                await uec.connect({
                  providerType: ZOHO_ADMIN,
                  credentials: demoUserExternalConnectionTestCredentials({
                    accessToken: 'zoho-admin-access-token',
                    refreshToken: 'zoho-admin-refresh-token',
                    tokenType: 'Bearer',
                    scopes: ['ZohoCRM.modules.ALL'],
                    expiresAt: new Date(Date.now() + MS_IN_MINUTE * 30).toISOString(),
                    extra: ZOHO_ADMIN_EXTRA
                  })
                });
              });

              it('mints the caller’s own zoho_admin access token', async () => {
                const res = await oauth.authRequest('get', ZOHO_ADMIN_TOKEN_PATH).expect(200);
                const result = res.body as UserExternalConnectionAccessToken;

                expect(result.uid).toBe(au.uid);
                expect(result.providerType).toBe(ZOHO_ADMIN);
                expect(result.accessToken).toBe('zoho-admin-access-token');
                expect(result.tokenType).toBe('Bearer');
                expect(result.scopes).toEqual(['ZohoCRM.modules.ALL']);
                expect(new Date(result.expiresAt as string).getTime()).toBeGreaterThan(Date.now());
              });

              it('marks the response uncacheable', async () => {
                const res = await oauth.authRequest('get', ZOHO_ADMIN_TOKEN_PATH).expect(200);
                expect(res.headers['cache-control']).toBe('no-store');
              });

              it('never returns the refresh token, and only the allowlisted extra values', async () => {
                const res = await oauth.authRequest('get', ZOHO_ADMIN_TOKEN_PATH).expect(200);
                const result = res.body as UserExternalConnectionAccessToken;

                expect(JSON.stringify(result)).not.toContain('zoho-admin-refresh-token');
                expect(result).not.toHaveProperty('refreshToken');
                expect(result.extra).toEqual({ apiDomain: ZOHO_ADMIN_EXTRA.apiDomain, location: ZOHO_ADMIN_EXTRA.location });
              });

              it('refuses the plain zoho connection, which is not opted in to token export', async () => {
                await uec.connect({ providerType: ZOHO, credentials: demoUserExternalConnectionTestCredentials({ accessToken: 'zoho-access-token' }) });

                const res = await oauth.authRequest('get', ZOHO_TOKEN_PATH).expect(403);
                expect(res.body.code).toBe(USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR_CODE);
                expect(JSON.stringify(res.body)).not.toContain('zoho-access-token');
              });

              describe('client allowlist', () => {
                let previousClientIds: string | undefined;

                beforeEach(() => {
                  previousClientIds = process.env[DEMO_EXTERNAL_CONNECTION_TOKEN_OIDC_CLIENT_IDS_ENV_KEY];
                  // read per mint, so setting it after the module graph was built applies immediately
                  process.env[DEMO_EXTERNAL_CONNECTION_TOKEN_OIDC_CLIENT_IDS_ENV_KEY] = 'some-other-client, another-client';
                });

                afterEach(() => {
                  if (previousClientIds == null) {
                    delete process.env[DEMO_EXTERNAL_CONNECTION_TOKEN_OIDC_CLIENT_IDS_ENV_KEY];
                  } else {
                    process.env[DEMO_EXTERNAL_CONNECTION_TOKEN_OIDC_CLIENT_IDS_ENV_KEY] = previousClientIds;
                  }
                });

                it('refuses a token issued to an OIDC client that is not allowlisted', async () => {
                  const res = await oauth.authRequest('get', ZOHO_ADMIN_TOKEN_PATH).expect(403);

                  expect(res.body.code).toBe(USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE);
                  expect(JSON.stringify(res.body)).not.toContain('zoho-admin-access-token');
                });
              });
            });

            describe('without a zoho_admin connection', () => {
              it('reports the provider as not connected', async () => {
                const res = await oauth.authRequest('get', ZOHO_ADMIN_TOKEN_PATH).expect(409);
                expect(res.body.code).toBe(USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE);
              });
            });
          });
        });
      });
    });

    describe('admin caller whose token lacks the token.external scope', () => {
      demoAuthorizedUserAdminContext({ f }, (au) => {
        demoUserExternalConnectionContext({ f, u: au }, (uec) => {
          demoOAuthAuthorizedSuperTestContext({ f, u: au }, (oauth) => {
            it('is refused by the scope gate, even with a zoho_admin connection', async () => {
              // an everyday login (demo-cli's default scopes) cannot mint
              await uec.connect({ providerType: ZOHO_ADMIN });

              const res = await oauth.authRequest('get', ZOHO_ADMIN_TOKEN_PATH).expect(403);

              expect(res.body.code).toBe(MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE);
              expect(res.body.message).toContain(EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE);
            });
          });
        });
      });
    });

    describe('non-admin caller', () => {
      demoAuthorizedUserContext({ f }, (u) => {
        demoUserExternalConnectionContext({ f, u }, (uec) => {
          demoOAuthAuthorizedSuperTestContext({ f, u }, (oauth) => {
            it('is refused by the admin predicate', async () => {
              // staged directly: a non-admin cannot obtain a zoho_admin connect state, but the token API
              // must not rely on that
              await uec.connect({ providerType: ZOHO_ADMIN });

              const res = await oauth.authRequest('get', ZOHO_ADMIN_TOKEN_PATH).expect(403);
              expect(res.body.code).toBe(USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE);
            });
          });
        });
      });
    });

    describe('unauthenticated caller', () => {
      it('is rejected by the bearer middleware', async () => {
        // proves the route sits under '/api/session', which the OIDC module protects
        const app = await f.loadInitializedNestApplication();
        await request(app.getHttpServer()).get(ZOHO_ADMIN_TOKEN_PATH).expect(401);
      });
    });
  });
});

describe('demoExternalConnectionTokenApiModuleConfigFactory()', () => {
  let previousClientIds: string | undefined;

  beforeEach(() => {
    previousClientIds = process.env[DEMO_EXTERNAL_CONNECTION_TOKEN_OIDC_CLIENT_IDS_ENV_KEY];
    delete process.env[DEMO_EXTERNAL_CONNECTION_TOKEN_OIDC_CLIENT_IDS_ENV_KEY];
  });

  afterEach(() => {
    if (previousClientIds == null) {
      delete process.env[DEMO_EXTERNAL_CONNECTION_TOKEN_OIDC_CLIENT_IDS_ENV_KEY];
    } else {
      process.env[DEMO_EXTERNAL_CONNECTION_TOKEN_OIDC_CLIENT_IDS_ENV_KEY] = previousClientIds;
    }
  });

  function allowedClientIdsFor(isProduction: boolean) {
    const config = demoExternalConnectionTokenApiModuleConfigFactory({ isProduction } as FirebaseServerEnvService);
    return config.allowedClientIds as (clientId: string) => boolean;
  }

  it('allows only the listed clients when the variable is set', () => {
    process.env[DEMO_EXTERNAL_CONNECTION_TOKEN_OIDC_CLIENT_IDS_ENV_KEY] = ' demo-cli-client , other-client ';

    for (const isProduction of [true, false]) {
      const allowed = allowedClientIdsFor(isProduction);

      expect(allowed('demo-cli-client')).toBe(true);
      expect(allowed('other-client')).toBe(true);
      expect(allowed('unknown-client')).toBe(false);
    }
  });

  it('allows no client in production when the variable is unset', () => {
    expect(allowedClientIdsFor(true)('demo-cli-client')).toBe(false);
  });

  it('treats a blank variable as unset', () => {
    process.env[DEMO_EXTERNAL_CONNECTION_TOKEN_OIDC_CLIENT_IDS_ENV_KEY] = ' , ';

    expect(allowedClientIdsFor(true)('demo-cli-client')).toBe(false);
    expect(allowedClientIdsFor(false)('demo-cli-client')).toBe(true);
  });

  it('allows any client outside production when the variable is unset', () => {
    expect(allowedClientIdsFor(false)('demo-cli-client')).toBe(true);
  });
});
