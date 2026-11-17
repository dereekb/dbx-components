import { describe, expect, it } from 'vitest';
import { CLI_TOKEN_OIDC_SCOPE, EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE, FIRESTORE_SESSION_OIDC_SCOPE, type OidcScope, SERVICE_TOKEN_OIDC_SCOPE } from '@dereekb/firebase';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { McpWellKnownController } from '@dereekb/firebase-server/mcp';
import { type OidcAccountService, type OidcModuleConfig, OidcProviderConfigService } from '@dereekb/firebase-server/oidc';
import { demoOidcProviderConfigForEnv } from '../../api/oidc/oidc.module';
import { demoMcpModuleConfigFactory } from './mcp.module';

/**
 * The scopes the demo's MCP protected-resource document resolves to, plus the base list it starts from.
 */
interface DemoProtectedResourceScopes {
  /**
   * The provider's `clientRequestableScopesSupported`: its claims minus the assignment-only scopes.
   */
  readonly requestableScopes: readonly OidcScope[];
  /**
   * The document's `scopes_supported`.
   */
  readonly advertisedScopes: readonly OidcScope[];
}

/**
 * Resolves the demo's advertised scopes through a REAL {@link OidcProviderConfigService} and
 * {@link McpWellKnownController}, built from the demo's own provider config and MCP config factory.
 *
 * Feeding the config's `scopesSupported` filter the full claims list instead would hide the production
 * shape: there the base list has already dropped the assignment-only scopes, so the advertised `token.cli`
 * only survives if `advertisedAssignmentOnlyScopes` is actually wired. The e2e suite only ever runs the
 * non-production shape, so this is the spec that covers the deployed one. No emulator: everything here
 * reads plain config.
 *
 * @param isProduction - Whether to resolve for a deployed environment.
 * @returns The requestable base list and the advertised scopes.
 */
function demoProtectedResourceScopes(isProduction: boolean): DemoProtectedResourceScopes {
  const envService = { appApiUrl: 'https://api.demo.test', appUrl: 'https://demo.test', appMcpUrl: undefined, isProduction } as unknown as FirebaseServerEnvService;
  const oidcModuleConfig = { issuer: 'https://api.demo.test/oidc', appOAuthInteractionPath: 'oauth', appOAuthLoginUrlPart: 'login', appOAuthConsentUrlPart: 'consent' } as unknown as OidcModuleConfig;
  const providerConfigService = new OidcProviderConfigService(oidcModuleConfig, { providerConfig: demoOidcProviderConfigForEnv(envService) } as unknown as OidcAccountService, envService);
  const controller = new McpWellKnownController(demoMcpModuleConfigFactory(envService, oidcModuleConfig), providerConfigService);

  return {
    requestableScopes: providerConfigService.clientRequestableScopesSupported,
    advertisedScopes: controller.getProtectedResourceMetadata().scopes_supported ?? []
  };
}

function countOf(scopes: readonly OidcScope[], scope: OidcScope): number {
  return scopes.filter((x) => x === scope).length;
}

describe('demoMcpModuleConfigFactory() protected-resource scopes', () => {
  describe('production', () => {
    const { requestableScopes, advertisedScopes } = demoProtectedResourceScopes(true);

    it('should strip token.cli from the requestable base list', () => {
      // non-vacuity: the advertised token.cli below can only come from advertisedAssignmentOnlyScopes
      expect(requestableScopes).not.toContain(CLI_TOKEN_OIDC_SCOPE);
    });

    it('should advertise token.cli exactly once', () => {
      expect(countOf(advertisedScopes, CLI_TOKEN_OIDC_SCOPE)).toBe(1);
    });

    it('should not advertise the scopes the filter drops or the unlisted gated scopes', () => {
      for (const scope of [SERVICE_TOKEN_OIDC_SCOPE, FIRESTORE_SESSION_OIDC_SCOPE, 'lms', 'reports', EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE]) {
        expect(advertisedScopes).not.toContain(scope);
      }
    });

    it('should advertise the model scopes', () => {
      expect(advertisedScopes).toContain('model.read');
      expect(advertisedScopes).toContain('demo');
    });
  });

  describe('non-production', () => {
    const { requestableScopes, advertisedScopes } = demoProtectedResourceScopes(false);

    it('should already include token.cli in the requestable base list', () => {
      expect(requestableScopes).toContain(CLI_TOKEN_OIDC_SCOPE);
    });

    it('should advertise token.cli exactly once', () => {
      expect(countOf(advertisedScopes, CLI_TOKEN_OIDC_SCOPE)).toBe(1);
    });

    it('should advertise token.external, which the default external-token profile unlocks', () => {
      expect(advertisedScopes).toContain(EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE);
    });

    it('should still not advertise the scopes the filter drops', () => {
      expect(advertisedScopes).not.toContain(SERVICE_TOKEN_OIDC_SCOPE);
      expect(advertisedScopes).not.toContain(FIRESTORE_SESSION_OIDC_SCOPE);
    });
  });
});
