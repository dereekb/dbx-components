import request from 'supertest';
import { type INestApplication } from '@nestjs/common';
import { AbstractTestContextFixture, useTestContextFixture } from '@dereekb/util/test';
import { FirebaseAdminNestTestContextFixture } from '../firebase/firebase.admin.nest';
import { type OAuthTestFlowConfig, setupAndPerformFullOAuthFlow } from './oidc.test.flow';
import { AuthorizedUserTestContextFixture } from '../firebase';

// MARK: Config
/**
 * Configuration for {@link oAuthAuthorizedSuperTestContextFactory}.
 */
export interface OAuthAuthorizedSuperTestContextFactoryConfig {
  /**
   * OAuth scopes (space-separated). If omitted, all registered scopes are
   * resolved from `OidcAccountService.providerConfig.claims`.
   */
  readonly scopes?: string;
  /**
   * OAuth redirect URI. Defaults to `'https://example.com/callback'`.
   */
  readonly redirectUri?: string;
  /**
   * Client name. Defaults to `'test-oauth-context'`.
   */
  readonly clientName?: string;
  /**
   * Vitest hook/test timeout in milliseconds. Defaults to `30_000`.
   */
  readonly timeout?: number;
  /**
   * Optional custom fixture creator.
   */
  readonly makeFixture?: () => OAuthAuthorizedSuperTestFixture;
  /**
   * Optional custom instance creator.
   */
  readonly makeInstance?: (server: ReturnType<INestApplication['getHttpServer']>, accessToken: string) => OAuthAuthorizedSuperTestInstance;
}

// MARK: Params
/**
 * Parameters passed when invoking the factory returned by {@link oAuthAuthorizedSuperTestContextFactory}.
 */
export interface OAuthAuthorizedSuperTestContextParams {
  /**
   * A fixture that provides NestJS app access (DI container, HTTP server).
   */
  readonly f: FirebaseAdminNestTestContextFixture;
  /**
   * A fixture or object that provides the test user's UID.
   */
  readonly u: AuthorizedUserTestContextFixture;
}

// MARK: Instance
/**
 * Instance holding authenticated OAuth state for a single test.
 */
export class OAuthAuthorizedSuperTestInstance {
  constructor(
    readonly server: ReturnType<INestApplication['getHttpServer']>,
    readonly accessToken: string
  ) {}

  /**
   * Apply Bearer auth to a supertest request.
   *
   * @example
   * ```typescript
   * await oauth.withAuth(request(oauth.server).get('/oidc/me')).expect(200);
   * await oauth.withAuth(request(oauth.server).post('/api/model/call')).send(body).expect(200);
   * ```
   */
  withAuth(test: request.Test): request.Test {
    return test.set('Authorization', `Bearer ${this.accessToken}`);
  }

  /**
   * Shorthand: create a supertest request with auth already applied.
   *
   * @example
   * ```typescript
   * await oauth.authRequest('get', '/oidc/me').expect(200);
   * await oauth.authRequest('post', '/api/model/call').send(body).expect(200);
   * ```
   */
  authRequest(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string): request.Test {
    return request(this.server)[method](path).set('Authorization', `Bearer ${this.accessToken}`);
  }
}

// MARK: Fixture
/**
 * Fixture that wraps {@link OAuthAuthorizedSuperTestInstance} and delegates to it.
 */
export class OAuthAuthorizedSuperTestFixture extends AbstractTestContextFixture<OAuthAuthorizedSuperTestInstance> {
  get server() {
    return this.instance.server;
  }

  get accessToken() {
    return this.instance.accessToken;
  }

  /**
   * Apply Bearer auth to a supertest request.
   *
   * @example
   * ```typescript
   * await oauth.withAuth(request(oauth.server).get('/oidc/me')).expect(200);
   * ```
   */
  withAuth(test: request.Test): request.Test {
    return this.instance.withAuth(test);
  }

  /**
   * Shorthand: create a supertest request with auth already applied.
   *
   * @example
   * ```typescript
   * await oauth.authRequest('get', '/oidc/me').expect(200);
   * await oauth.authRequest('post', '/api/model/call').send(body).expect(200);
   * ```
   */
  authRequest(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string): request.Test {
    return this.instance.authRequest(method, path);
  }
}

// MARK: Factory
/**
 * Default hook/test timeout for OAuth-authenticated test contexts.
 *
 * The full OAuth authorization code flow involves multiple HTTP round trips
 * (auth → login → consent → code exchange), so the default 10s timeout is too short.
 */
const DEFAULT_OAUTH_TEST_TIMEOUT = 30_000;

/**
 * Creates a factory that sets up an OAuth-authenticated supertest context.
 *
 * The returned factory function performs a full OAuth authorization code flow
 * and provides an authenticated supertest agent and helper methods.
 *
 * @example
 * ```typescript
 * // In shared test setup (e.g. fixture.oidc.ts)
 * export const myOAuthContext = oAuthAuthorizedSuperTestContextFactory();
 *
 * // In test file
 * myAppFunctionContextFactory((f) => {
 *   authorizedUserContext({ f }, (u) => {
 *     myOAuthContext({ f, u }, (oauth) => {
 *       it('should fetch userinfo', async () => {
 *         await oauth.authRequest('get', '/oidc/me').expect(200);
 *       });
 *     });
 *   });
 * });
 * ```
 */
export function oAuthAuthorizedSuperTestContextFactory(config?: OAuthAuthorizedSuperTestContextFactoryConfig): (params: OAuthAuthorizedSuperTestContextParams, buildTests: (oauth: OAuthAuthorizedSuperTestFixture) => void) => void {
  const { timeout = DEFAULT_OAUTH_TEST_TIMEOUT, makeFixture = () => new OAuthAuthorizedSuperTestFixture(), makeInstance = (server: ReturnType<INestApplication['getHttpServer']>, accessToken: string) => new OAuthAuthorizedSuperTestInstance(server, accessToken), ...flowConfigOverrides } = config ?? {};

  const flowConfig: OAuthTestFlowConfig | undefined = flowConfigOverrides.scopes || flowConfigOverrides.redirectUri || flowConfigOverrides.clientName ? flowConfigOverrides : undefined;

  return (params: OAuthAuthorizedSuperTestContextParams, buildTests: (oauth: OAuthAuthorizedSuperTestFixture) => void) => {
    const { f, u } = params;

    describe('(oauth)', () => {
      // Increase timeouts for the OAuth flow
      beforeAll(() => {
        vi.setConfig({ hookTimeout: timeout, testTimeout: timeout });
      });

      useTestContextFixture<OAuthAuthorizedSuperTestFixture, OAuthAuthorizedSuperTestInstance>({
        fixture: makeFixture(),
        buildTests,
        initInstance: async () => {
          // Load the cached NestApplication for HTTP testing
          const app = await f.loadInitializedNestApplication();

          // Rotate JWKS keys, resolve services, and perform the full OAuth flow
          const { accessToken } = await setupAndPerformFullOAuthFlow(app, u.uid, flowConfig);

          return makeInstance(app.getHttpServer(), accessToken);
        }
      });
    });
  };
}
