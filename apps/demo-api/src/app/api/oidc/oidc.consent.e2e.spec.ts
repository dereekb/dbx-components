import { OidcClientService } from '@dereekb/firebase-server/oidc';
import { type OAuthTestFlowConfig, performFullOAuthFlow, setupAndPerformFullOAuthFlow } from '@dereekb/firebase-server/test';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';

const REQUESTED_SCOPES = 'openid profile email';

/**
 * Splits a token response's scope string into a sorted list for order-insensitive comparison.
 *
 * @param scope - The space-separated scope string.
 * @returns The sorted scope entries.
 */
function scopeList(scope: string): string[] {
  return scope.split(' ').filter(Boolean).sort();
}

/**
 * Re-consent against a Grant that already rejected a scope.
 *
 * oidc-provider counts a rejected scope as encountered, so it never comes back in the consent prompt's
 * `missingOIDCScope` — and it is subtracted from the Grant's scope on every read. Without the controller
 * reconsidering it, a scope the user declined once could never be granted on that client again, even when
 * they explicitly ticked it on a later `prompt=consent` screen. These flows run on ONE provider session (the
 * second reuses the first's client and cookies) so the second consent lands on the first's Grant.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  demoAuthorizedUserContext({ f }, (u) => {
    beforeAll(() => {
      vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });
    });

    describe('consent on a grant with a rejected scope', () => {
      async function flowOnSameSession(session: OAuthTestFlowConfig['session'], config: Omit<OAuthTestFlowConfig, 'session'>) {
        const nestApp = await f.loadInitializedNestApplication();
        return performFullOAuthFlow({ server: nestApp.getHttpServer(), oidcClientService: nestApp.get(OidcClientService), nestApp, uid: u.uid, config: { ...config, session } });
      }

      it('should withhold a scope the user deselected at consent', async () => {
        const nestApp = await f.loadInitializedNestApplication();
        const first = await setupAndPerformFullOAuthFlow(nestApp, u.uid, { scopes: REQUESTED_SCOPES, grantedOIDCScopes: ['openid', 'profile'] });

        expect(scopeList(first.scope)).toEqual(['openid', 'profile']);
      });

      it('should grant a previously-rejected scope the user explicitly ticks on a later consent', async () => {
        const nestApp = await f.loadInitializedNestApplication();
        const first = await setupAndPerformFullOAuthFlow(nestApp, u.uid, { scopes: REQUESTED_SCOPES, grantedOIDCScopes: ['openid', 'profile'] });
        expect(scopeList(first.scope)).toEqual(['openid', 'profile']);

        const second = await flowOnSameSession(first.session, { scopes: REQUESTED_SCOPES, prompt: 'consent', grantedOIDCScopes: ['openid', 'profile', 'email'] });

        expect(scopeList(second.scope)).toEqual(['email', 'openid', 'profile']);
      });

      it('should grant a previously-rejected scope on a later approve-all consent that requests it', async () => {
        // no `grantedOIDCScopes` is the back-compat "grant everything requested" submit
        const nestApp = await f.loadInitializedNestApplication();
        const first = await setupAndPerformFullOAuthFlow(nestApp, u.uid, { scopes: REQUESTED_SCOPES, grantedOIDCScopes: ['openid', 'profile'] });
        expect(scopeList(first.scope)).toEqual(['openid', 'profile']);

        const second = await flowOnSameSession(first.session, { scopes: REQUESTED_SCOPES, prompt: 'consent' });

        expect(scopeList(second.scope)).toEqual(['email', 'openid', 'profile']);
      });

      it('should keep a previously-rejected scope rejected when a later consent deselects it again', async () => {
        const nestApp = await f.loadInitializedNestApplication();
        const first = await setupAndPerformFullOAuthFlow(nestApp, u.uid, { scopes: REQUESTED_SCOPES, grantedOIDCScopes: ['openid', 'profile'] });
        expect(scopeList(first.scope)).toEqual(['openid', 'profile']);

        const second = await flowOnSameSession(first.session, { scopes: REQUESTED_SCOPES, prompt: 'consent', grantedOIDCScopes: ['openid', 'profile'] });

        expect(scopeList(second.scope)).toEqual(['openid', 'profile']);
      });

      it('should leave a rejected scope alone when a later request does not ask for it', async () => {
        const nestApp = await f.loadInitializedNestApplication();
        const first = await setupAndPerformFullOAuthFlow(nestApp, u.uid, { scopes: REQUESTED_SCOPES, grantedOIDCScopes: ['openid', 'profile'] });
        expect(scopeList(first.scope)).toEqual(['openid', 'profile']);

        // the rejection came from a wider request; a narrower one must not resurrect it
        const second = await flowOnSameSession(first.session, { scopes: 'openid profile', prompt: 'consent' });

        expect(scopeList(second.scope)).toEqual(['openid', 'profile']);
      });
    });
  });
});
