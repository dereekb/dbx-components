import request from 'supertest';
import {
  EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE,
  MICROSOFT_GRAPH_READ_SCOPES,
  MICROSOFT_GRAPH_READ_WRITE_SCOPES,
  MICROSOFT_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as MICROSOFT,
  USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_NARROWING_UNSUPPORTED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_SCOPES_INVALID_ERROR_CODE,
  type UserExternalConnectionAccessToken,
  userExternalConnectionTokenApiPath,
  TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as TRELLO,
  ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as ZOHO
} from '@dereekb/firebase';
import { type FirebaseServerEnvService, MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE } from '@dereekb/firebase-server';
import { oAuthAuthorizedSuperTestContextFactory } from '@dereekb/firebase-server/test';
import { type MicrosoftOAuthAccessToken, type MicrosoftOAuthRefreshTokenInput } from '@dereekb/microsoft';
import { MicrosoftOAuthApi } from '@dereekb/microsoft/nestjs';
import { MS_IN_MINUTE } from '@dereekb/util';
import { DEMO_TRELLO_BOT_EXTERNAL_CONNECTION_PROVIDER_TYPE as TRELLO_BOT, DEMO_ZOHO_ADMIN_EXTERNAL_CONNECTION_PROVIDER_TYPE as ZOHO_ADMIN, EXTERNAL_TOKEN_OIDC_PROVIDER_PROFILE_KEY, MICROSOFT_ADMIN_EXTERNAL_TOKEN_OIDC_SCOPE, MICROSOFT_READ_EXTERNAL_TOKEN_OIDC_SCOPE } from 'demo-firebase';
import { DEMO_EXTERNAL_CONNECTION_TOKEN_OIDC_CLIENT_IDS_ENV_KEY, demoExternalConnectionTokenApiModuleConfigFactory } from './externaltoken.module';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoOAuthAuthorizedSuperTestContext, demoUserExternalConnectionContext, demoUserExternalConnectionTestCredentials } from '../../../test/fixture';

vi.setConfig({ hookTimeout: 40000, testTimeout: 40000 });

const ZOHO_ADMIN_TOKEN_PATH = `/api${userExternalConnectionTokenApiPath(ZOHO_ADMIN)}`;
const ZOHO_TOKEN_PATH = `/api${userExternalConnectionTokenApiPath(ZOHO)}`;
const TRELLO_BOT_TOKEN_PATH = `/api${userExternalConnectionTokenApiPath(TRELLO_BOT)}`;
const TRELLO_TOKEN_PATH = `/api${userExternalConnectionTokenApiPath(TRELLO)}`;
const MICROSOFT_TOKEN_PATH = `/api${userExternalConnectionTokenApiPath(MICROSOFT)}`;

/**
 * OAuth fixture shaped like demo-cli's dedicated `external-token` env: a client assigned the admin-only
 * `external-token` provider profile, requesting `openid offline_access token.external` and nothing else.
 *
 * The profile is assigned explicitly even though a test run is non-production, where it is also a
 * default profile: that keeps the fixture shaped like the production gate. The scopes are spelled out
 * because the test flow's default "all registered scopes" resolution excludes admin-only scopes.
 */
const demoOAuthSuperTestContextWithExternalTokenScope = oAuthAuthorizedSuperTestContextFactory({
  clientName: 'demo-external-token-oauth-context',
  providerProfiles: [EXTERNAL_TOKEN_OIDC_PROVIDER_PROFILE_KEY],
  scopes: `openid offline_access ${EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE}`
});

/**
 * The `external-token` fixture plus the `token.external.microsoft_read` ceiling scope: a `microsoft`
 * mint is capped at the Read preset's Graph scopes.
 */
const demoOAuthSuperTestContextWithMicrosoftReadScope = oAuthAuthorizedSuperTestContextFactory({
  clientName: 'demo-external-token-microsoft-read-oauth-context',
  providerProfiles: [EXTERNAL_TOKEN_OIDC_PROVIDER_PROFILE_KEY],
  scopes: `openid offline_access ${EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE} ${MICROSOFT_READ_EXTERNAL_TOKEN_OIDC_SCOPE}`
});

/**
 * The `external-token` fixture plus the `token.external.microsoft_admin` ceiling scope: a `microsoft`
 * mint is capped at the Read + Write preset's Graph scopes.
 */
const demoOAuthSuperTestContextWithMicrosoftAdminScope = oAuthAuthorizedSuperTestContextFactory({
  clientName: 'demo-external-token-microsoft-admin-oauth-context',
  providerProfiles: [EXTERNAL_TOKEN_OIDC_PROVIDER_PROFILE_KEY],
  scopes: `openid offline_access ${EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE} ${MICROSOFT_ADMIN_EXTERNAL_TOKEN_OIDC_SCOPE}`
});

const MICROSOFT_TENANT_ID = '11111111-2222-3333-4444-555555555555';

/**
 * The provider values a real Zoho connection stores beside its tokens. `apiDomain` + `location` are on
 * the Zoho adapter's export allowlist; `accountsServer` is not, so it must never leave the server.
 */
const ZOHO_ADMIN_EXTRA = { apiDomain: 'https://www.zohoapis.com', location: 'us', accountsServer: 'https://accounts.zoho.com' };

/**
 * The values a real Trello connection stores beside its tokens. `memberId` + `username` are on the
 * Trello adapter's export allowlist; `refreshExpiresAt` feeds the server-side expiry notice only.
 */
const TRELLO_BOT_EXTRA = { memberId: '5a1b2c3d4e5f60718293a4b5', username: 'boardbot', refreshExpiresAt: new Date(Date.now() + MS_IN_MINUTE * 60 * 24 * 90).toISOString() };

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
 * 4. The provider's `tokenExport` policy: `zoho_admin` and `trello_bot` are opted in, plain `zoho` and
 *    `trello` are not.
 *
 * `trello_bot` is the second worked example: exportable WITHOUT being admin-only to connect, so the
 * admin predicate here is the token API's own gate rather than the provider policy's.
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

            describe('with a trello_bot connection', () => {
              beforeEach(async () => {
                await uec.connect({
                  providerType: TRELLO_BOT,
                  credentials: demoUserExternalConnectionTestCredentials({
                    accessToken: 'trello-bot-access-token',
                    refreshToken: 'trello-bot-refresh-token',
                    tokenType: 'Bearer',
                    scopes: ['read:board:trello', 'write:board:trello', 'read:member:trello', 'offline_access'],
                    externalAccountId: TRELLO_BOT_EXTRA.memberId,
                    label: 'Board Bot',
                    extra: TRELLO_BOT_EXTRA
                  })
                });
              });

              it('mints the caller’s own trello_bot access token', async () => {
                const res = await oauth.authRequest('get', TRELLO_BOT_TOKEN_PATH).expect(200);
                const result = res.body as UserExternalConnectionAccessToken;

                expect(result.uid).toBe(au.uid);
                expect(result.providerType).toBe(TRELLO_BOT);
                expect(result.accessToken).toBe('trello-bot-access-token');
                expect(result.tokenType).toBe('Bearer');
                expect(res.headers['cache-control']).toBe('no-store');
              });

              it('exports exactly the member id and username, never the refresh token or its expiry', async () => {
                const res = await oauth.authRequest('get', TRELLO_BOT_TOKEN_PATH).expect(200);
                const result = res.body as UserExternalConnectionAccessToken;

                expect(JSON.stringify(result)).not.toContain('trello-bot-refresh-token');
                expect(result).not.toHaveProperty('refreshToken');
                expect(result.extra).toEqual({ memberId: TRELLO_BOT_EXTRA.memberId, username: TRELLO_BOT_EXTRA.username });
                expect(JSON.stringify(result)).not.toContain('refreshExpiresAt');
              });

              it('refuses the plain trello connection, which is not opted in to token export', async () => {
                await uec.connect({ providerType: TRELLO, credentials: demoUserExternalConnectionTestCredentials({ accessToken: 'trello-access-token', externalAccountId: `trello-${au.uid}` }) });

                const res = await oauth.authRequest('get', TRELLO_TOKEN_PATH).expect(403);
                expect(res.body.code).toBe(USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR_CODE);
                expect(JSON.stringify(res.body)).not.toContain('trello-access-token');
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

    describe('with a microsoft connection', () => {
      let oauthApi: MicrosoftOAuthApi;
      let refreshInputs: MicrosoftOAuthRefreshTokenInput[];

      beforeEach(() => {
        oauthApi = f.instance.apiNestContext.nestApplication.get(MicrosoftOAuthApi);
        refreshInputs = [];

        // a mint of a fresh stored token makes no Microsoft call. Shadow the refresh with an OWN property
        // that records any call and answers the way Entra does: with EVERY consented scope, whatever
        // subset was asked for — which is why Microsoft cannot narrow
        Object.defineProperty(oauthApi, 'refreshToAccessToken', {
          configurable: true,
          writable: true,
          value: async (input: MicrosoftOAuthRefreshTokenInput): Promise<MicrosoftOAuthAccessToken> => {
            refreshInputs.push(input);
            return { accessToken: 'microsoft-refreshed-access-token', refreshToken: 'rotated-refresh-token', scopes: [...MICROSOFT_GRAPH_READ_WRITE_SCOPES], expiresIn: 3600, expiresAt: new Date(Date.now() + 3600 * 1000) };
          }
        });
      });

      afterEach(() => {
        Reflect.deleteProperty(oauthApi, 'refreshToAccessToken');
      });

      function microsoftCredentials(scopes: readonly string[]) {
        return demoUserExternalConnectionTestCredentials({
          accessToken: 'microsoft-stored-access-token',
          refreshToken: 'microsoft-refresh-token',
          tokenType: 'Bearer',
          scopes: [...scopes],
          expiresAt: new Date(Date.now() + MS_IN_MINUTE * 30).toISOString(),
          extra: { tenantId: MICROSOFT_TENANT_ID }
        });
      }

      describe('admin caller holding the microsoft_read ceiling', () => {
        demoAuthorizedUserAdminContext({ f }, (au) => {
          demoUserExternalConnectionContext({ f, u: au }, (uec) => {
            demoOAuthSuperTestContextWithMicrosoftReadScope({ f, u: au }, (oauth) => {
              describe('and a read connection', () => {
                beforeEach(async () => {
                  await uec.connect({ providerType: MICROSOFT, credentials: microsoftCredentials(MICROSOFT_GRAPH_READ_SCOPES) });
                });

                it('mints the stored token, without a Microsoft round trip', async () => {
                  const res = await oauth.authRequest('get', MICROSOFT_TOKEN_PATH).expect(200);
                  const result = res.body as UserExternalConnectionAccessToken;

                  expect(refreshInputs.length).toBe(0);
                  expect(result.scopes).toEqual([...MICROSOFT_GRAPH_READ_SCOPES]);
                  expect(result.accessToken).toBe('microsoft-stored-access-token');
                  expect(result.extra).toEqual({ tenantId: MICROSOFT_TENANT_ID });
                  expect(JSON.stringify(result)).not.toContain('refresh-token');
                });

                it('refuses ?scopes=, since Microsoft cannot narrow', async () => {
                  const res = await oauth.authRequest('get', `${MICROSOFT_TOKEN_PATH}?scopes=${encodeURIComponent('mail.read https://graph.microsoft.com/User.Read')}`).expect(400);

                  expect(res.body.code).toBe(USER_EXTERNAL_CONNECTION_TOKEN_NARROWING_UNSUPPORTED_ERROR_CODE);
                  expect(refreshInputs.length).toBe(0);
                });

                it('refuses a ?scopes= request above the ceiling', async () => {
                  const res = await oauth.authRequest('get', `${MICROSOFT_TOKEN_PATH}?scopes=Mail.ReadWrite`).expect(403);

                  expect(res.body.code).toBe(USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE);
                  expect(refreshInputs.length).toBe(0);
                });

                it('refuses an empty ?scopes=', async () => {
                  const res = await oauth.authRequest('get', `${MICROSOFT_TOKEN_PATH}?scopes=`).expect(400);
                  expect(res.body.code).toBe(USER_EXTERNAL_CONNECTION_TOKEN_SCOPES_INVALID_ERROR_CODE);
                });
              });

              describe('and a read + write connection', () => {
                beforeEach(async () => {
                  await uec.connect({ providerType: MICROSOFT, credentials: microsoftCredentials(MICROSOFT_GRAPH_READ_WRITE_SCOPES) });
                });

                it('refuses the grant, which exceeds the read ceiling, without returning its token', async () => {
                  const res = await oauth.authRequest('get', MICROSOFT_TOKEN_PATH).expect(403);

                  expect(res.body.code).toBe(USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE);
                  expect(JSON.stringify(res.body)).not.toContain('access-token');
                  expect(refreshInputs.length).toBe(0);
                });
              });
            });
          });
        });
      });

      describe('admin caller holding the microsoft_admin ceiling', () => {
        demoAuthorizedUserAdminContext({ f }, (au) => {
          demoUserExternalConnectionContext({ f, u: au }, (uec) => {
            demoOAuthSuperTestContextWithMicrosoftAdminScope({ f, u: au }, (oauth) => {
              it('mints a read connection, whose grant fits inside the ceiling', async () => {
                await uec.connect({ providerType: MICROSOFT, credentials: microsoftCredentials(MICROSOFT_GRAPH_READ_SCOPES) });

                const res = await oauth.authRequest('get', MICROSOFT_TOKEN_PATH).expect(200);
                expect((res.body as UserExternalConnectionAccessToken).scopes).toEqual([...MICROSOFT_GRAPH_READ_SCOPES]);
              });

              it('mints a read + write token from a read + write connection', async () => {
                await uec.connect({ providerType: MICROSOFT, credentials: microsoftCredentials(MICROSOFT_GRAPH_READ_WRITE_SCOPES) });

                const res = await oauth.authRequest('get', MICROSOFT_TOKEN_PATH).expect(200);
                expect((res.body as UserExternalConnectionAccessToken).scopes).toEqual([...MICROSOFT_GRAPH_READ_WRITE_SCOPES]);
              });

              it('refuses ?scopes= on a provider that cannot narrow (zoho_admin)', async () => {
                await uec.connect({ providerType: ZOHO_ADMIN, credentials: demoUserExternalConnectionTestCredentials({ accessToken: 'zoho-admin-access-token', scopes: ['ZohoCRM.modules.ALL'] }) });

                const res = await oauth.authRequest('get', `${ZOHO_ADMIN_TOKEN_PATH}?scopes=ZohoCRM.modules.ALL`).expect(400);
                expect(res.body.code).toBe(USER_EXTERNAL_CONNECTION_TOKEN_NARROWING_UNSUPPORTED_ERROR_CODE);
              });
            });
          });
        });
      });

      describe('admin caller holding token.external but no microsoft ceiling', () => {
        demoAuthorizedUserAdminContext({ f }, (au) => {
          demoUserExternalConnectionContext({ f, u: au }, (uec) => {
            demoOAuthSuperTestContextWithExternalTokenScope({ f, u: au }, (oauth) => {
              it('is refused a microsoft token outright', async () => {
                await uec.connect({ providerType: MICROSOFT, credentials: microsoftCredentials(MICROSOFT_GRAPH_READ_WRITE_SCOPES) });

                const res = await oauth.authRequest('get', MICROSOFT_TOKEN_PATH).expect(403);
                expect(res.body.code).toBe(USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE);
                expect(JSON.stringify(res.body)).not.toContain('microsoft-stored-access-token');
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
                // staged directly: microsoft is adminOnly to connect, but the token API must not rely on that
                await uec.connect({ providerType: MICROSOFT, credentials: microsoftCredentials(MICROSOFT_GRAPH_READ_SCOPES) });

                const res = await oauth.authRequest('get', MICROSOFT_TOKEN_PATH).expect(403);
                expect(res.body.code).toBe(USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE);
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

            it('is refused by the admin predicate for trello_bot too, which a non-admin may connect', async () => {
              // trello_bot is not adminOnly, so this connection is reachable through the real connect flow:
              // the mint's own admin predicate is the only thing keeping its token on the server
              await uec.connect({ providerType: TRELLO_BOT, credentials: demoUserExternalConnectionTestCredentials({ accessToken: 'trello-bot-access-token' }) });

              const res = await oauth.authRequest('get', TRELLO_BOT_TOKEN_PATH).expect(403);
              expect(res.body.code).toBe(USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE);
              expect(JSON.stringify(res.body)).not.toContain('trello-bot-access-token');
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
