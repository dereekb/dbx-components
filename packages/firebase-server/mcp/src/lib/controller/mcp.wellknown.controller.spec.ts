import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { type OidcAccountService, type OidcModuleConfig, type OidcProviderConfig, OidcProviderConfigService } from '@dereekb/firebase-server/oidc';
import { CLI_TOKEN_OIDC_SCOPE, EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE, type OidcProviderProfile, type OidcScope, SERVICE_TOKEN_OIDC_SCOPE } from '@dereekb/firebase';
import { McpWellKnownController } from './mcp.wellknown.controller';
import { type McpModuleConfig } from '../mcp.config';

const TEST_OIDC_ISSUER = 'https://api.example.test/oidc';
const TEST_MCP_URL = 'https://api.example.test/mcp';
const TEST_LMS_SCOPE = 'lms';

/**
 * Provider profiles shaped like a real app's: `lms` is never unlocked by default, while the
 * `cli-handoff` and `external-token` profiles are default profiles only outside production — the
 * same shape demo-api and hellosubs-api use.
 *
 * @param production - Whether to build the deployed-environment shape.
 * @returns The provider profiles.
 */
function testProviderProfiles(production: boolean): OidcProviderProfile[] {
  return [
    { key: 'lms', label: 'LMS', scopes: [{ scope: TEST_LMS_SCOPE }] },
    { key: 'cli-handoff', label: 'CLI Handoff', adminOnly: true, isDefault: !production, scopes: [{ scope: CLI_TOKEN_OIDC_SCOPE }] },
    { key: 'external-token', label: 'External Token', adminOnly: true, isDefault: !production, scopes: [{ scope: EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE }] }
  ];
}

/**
 * Builds a REAL {@link OidcProviderConfigService}, so the controller sees the same assignment-only-stripped base
 * list it sees at runtime. Feeding the controller the full claims list instead is the spec shape that hides a
 * keep-only filter dropping a gated scope in production.
 *
 * @param production - Whether to build the deployed-environment shape.
 * @returns The provider config service.
 */
function makeProviderConfigService(production: boolean): OidcProviderConfigService {
  const providerConfig: OidcProviderConfig = {
    claims: {
      openid: ['sub'],
      profile: [],
      'model.read': [],
      [SERVICE_TOKEN_OIDC_SCOPE]: [],
      [TEST_LMS_SCOPE]: [],
      [CLI_TOKEN_OIDC_SCOPE]: [],
      [EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE]: []
    },
    providerProfiles: testProviderProfiles(production)
  };

  const moduleConfig = { issuer: TEST_OIDC_ISSUER, appOAuthInteractionPath: 'oauth', appOAuthLoginUrlPart: 'login', appOAuthConsentUrlPart: 'consent' } as unknown as OidcModuleConfig;
  return new OidcProviderConfigService(moduleConfig, { providerConfig } as unknown as OidcAccountService, { appUrl: 'https://example.test' } as unknown as FirebaseServerEnvService);
}

function makeController(providerConfigService: OidcProviderConfigService, overrides: Partial<McpModuleConfig> = {}): McpWellKnownController {
  return new McpWellKnownController({ oidcIssuer: TEST_OIDC_ISSUER, mcpUrl: TEST_MCP_URL, ...overrides } as McpModuleConfig, providerConfigService);
}

function countOf(scopes: readonly OidcScope[] | undefined, scope: OidcScope): number {
  return (scopes ?? []).filter((x) => x === scope).length;
}

describe('McpWellKnownController', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getProtectedResourceMetadata()', () => {
    it('should return the resource and authorization server', () => {
      const result = makeController(makeProviderConfigService(true)).getProtectedResourceMetadata();
      expect(result.resource).toBe(TEST_MCP_URL);
      expect(result.authorization_servers).toEqual([TEST_OIDC_ISSUER]);
    });

    describe('production-shaped profiles', () => {
      const providerConfigService = makeProviderConfigService(true);

      it('should strip the assignment-only scopes from the requestable base list', () => {
        // non-vacuity: every case below depends on the base list lacking these scopes
        const requestable = providerConfigService.clientRequestableScopesSupported;
        expect(requestable).not.toContain(CLI_TOKEN_OIDC_SCOPE);
        expect(requestable).not.toContain(EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE);
        expect(requestable).not.toContain(TEST_LMS_SCOPE);
      });

      it('should advertise a listed advertisedAssignmentOnlyScopes scope exactly once', () => {
        const result = makeController(providerConfigService, { advertisedAssignmentOnlyScopes: [CLI_TOKEN_OIDC_SCOPE] }).getProtectedResourceMetadata();
        expect(countOf(result.scopes_supported, CLI_TOKEN_OIDC_SCOPE)).toBe(1);
      });

      it('should not advertise the unlisted assignment-only scopes', () => {
        const result = makeController(providerConfigService, { advertisedAssignmentOnlyScopes: [CLI_TOKEN_OIDC_SCOPE] }).getProtectedResourceMetadata();
        expect(result.scopes_supported).not.toContain(EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE);
        expect(result.scopes_supported).not.toContain(TEST_LMS_SCOPE);
      });

      it('should append the listed scopes after the scopesSupported filter runs', () => {
        const result = makeController(providerConfigService, {
          scopesSupported: (requestableScopes) => requestableScopes.filter((scope) => scope !== SERVICE_TOKEN_OIDC_SCOPE && scope !== CLI_TOKEN_OIDC_SCOPE),
          advertisedAssignmentOnlyScopes: [CLI_TOKEN_OIDC_SCOPE]
        }).getProtectedResourceMetadata();

        expect(countOf(result.scopes_supported, CLI_TOKEN_OIDC_SCOPE)).toBe(1);
        expect(result.scopes_supported).not.toContain(SERVICE_TOKEN_OIDC_SCOPE);
      });

      it('should keep nothing for a gated scope named by a keep-only scopesSupported filter', () => {
        // the pitfall advertisedAssignmentOnlyScopes replaces: the filter's input has the gated scopes already removed
        const result = makeController(providerConfigService, {
          scopesSupported: (requestableScopes) => requestableScopes.filter((scope) => scope === 'openid' || scope === CLI_TOKEN_OIDC_SCOPE)
        }).getProtectedResourceMetadata();

        expect(result.scopes_supported).toEqual(['openid']);
      });
    });

    describe('non-production-shaped profiles', () => {
      const providerConfigService = makeProviderConfigService(false);

      it('should advertise a listed scope that a default profile already unlocks exactly once', () => {
        expect(providerConfigService.clientRequestableScopesSupported).toContain(CLI_TOKEN_OIDC_SCOPE);

        const result = makeController(providerConfigService, { advertisedAssignmentOnlyScopes: [CLI_TOKEN_OIDC_SCOPE, CLI_TOKEN_OIDC_SCOPE] }).getProtectedResourceMetadata();
        expect(countOf(result.scopes_supported, CLI_TOKEN_OIDC_SCOPE)).toBe(1);
      });
    });

    describe('scope the OIDC provider does not register', () => {
      it('should not advertise it and should warn once at construction', () => {
        const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        const controller = makeController(makeProviderConfigService(true), { advertisedAssignmentOnlyScopes: ['token.unregistered', CLI_TOKEN_OIDC_SCOPE] });
        expect(warn).toHaveBeenCalledTimes(1);

        const result = controller.getProtectedResourceMetadata();
        expect(result.scopes_supported).not.toContain('token.unregistered');
        expect(countOf(result.scopes_supported, CLI_TOKEN_OIDC_SCOPE)).toBe(1);
        expect(warn).toHaveBeenCalledTimes(1);
      });
    });

    describe('advertisedAssignmentOnlyScopes unset', () => {
      const providerConfigService = makeProviderConfigService(true);

      it('should advertise the requestable base list unchanged', () => {
        const result = makeController(providerConfigService).getProtectedResourceMetadata();
        expect(result.scopes_supported).toEqual(providerConfigService.clientRequestableScopesSupported);
      });

      it('should advertise the scopesSupported filter output unchanged', () => {
        const scopesSupported = (requestableScopes: readonly OidcScope[]) => requestableScopes.filter((scope) => scope !== SERVICE_TOKEN_OIDC_SCOPE);
        const result = makeController(providerConfigService, { scopesSupported }).getProtectedResourceMetadata();
        expect(result.scopes_supported).toEqual(scopesSupported(providerConfigService.clientRequestableScopesSupported));
      });

      it('should omit scopes_supported when the resolved list is empty', () => {
        const result = makeController(providerConfigService, { scopesSupported: () => [] }).getProtectedResourceMetadata();
        expect(result.scopes_supported).toBeUndefined();
      });
    });
  });
});
