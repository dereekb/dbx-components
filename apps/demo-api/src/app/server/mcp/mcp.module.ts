import { Logger, Module } from '@nestjs/common';
import { DownloadApiService, FirebaseServerEnvService } from '@dereekb/firebase-server';
import { McpModuleConfig, mcpModuleMetadata, MCP_AUTH_ROLE_READER, MCP_CLI_TOKEN_MINTER, MCP_MODEL_ROLES_TARGET_UID_PREDICATE, type McpAuthRoleReader, type McpCliTokenMinter, type McpModelRolesTargetUidPredicate } from '@dereekb/firebase-server/mcp';
import { OidcCliTokenService, OidcModuleConfig } from '@dereekb/firebase-server/oidc';
import { CLI_TOKEN_OIDC_SCOPE, FIRESTORE_SESSION_OIDC_SCOPE, SERVICE_TOKEN_OIDC_SCOPE } from '@dereekb/firebase';
import { AUTH_ADMIN_ROLE, type AuthClaims } from '@dereekb/util';
import { DEMO_AUTH_CLAIMS_SERVICE } from 'demo-firebase';
import { DemoApiOidcModule } from '../../api/oidc/oidc.module';
import { DemoModelApiModule } from '../model/model.module';
import { DemoDownloadApiModule } from '../download/download.module';
import { resolveDistArtifactPath } from '../dist.path';
import packageJson from '../../../../package.json';

const serverVersion: string = packageJson.version;

const MCP_MANIFEST_PATH = resolveDistArtifactPath('mcp.manifest.json');
const ROUTE_MANIFEST_PATH = resolveDistArtifactPath('route.manifest.json');

/**
 * Builds the MCP module config for the Demo API.
 *
 * `mcpUrl` is taken from `envService.appMcpUrl` when set; otherwise it falls back to
 * `<api-origin>/mcp` derived from `appApiUrl`. `oidcIssuer` is sourced verbatim from
 * the resolved {@link OidcModuleConfig.issuer} so the protected-resource discovery
 * doc always advertises the same issuer the OIDC provider itself uses — even when
 * the OIDC issuer is overridden via `oidcModuleMetadata` config.
 *
 * @param envService - The Firebase server environment service used to read app/API/MCP URLs.
 * @param oidcModuleConfig - The resolved OIDC module config, used as the authoritative issuer source.
 * @returns The MCP module configuration with discovery URLs aligned to the live origins.
 */
export function demoMcpModuleConfigFactory(envService: FirebaseServerEnvService, oidcModuleConfig: OidcModuleConfig): McpModuleConfig {
  const apiBaseUrl = envService.appApiUrl ?? envService.appUrl;
  const apiOrigin = new URL(apiBaseUrl as string).origin;
  const mcpUrl = envService.appMcpUrl ?? `${apiOrigin}/mcp`;
  return {
    oidcIssuer: oidcModuleConfig.issuer,
    mcpUrl,
    // Admin-only scopes are not advertised to MCP clients, which request the advertised list
    // verbatim. Other OIDC clients can still request either one directly.
    //
    // - token.service makes the grant long-lived + non-rotating — not what an interactive MCP
    //   connection should be asking for.
    // - session.firestore unlocks a DIRECT Firestore connection, which the MCP tools have no use for
    //   (they reach data through callModel), and asking for it would put every admin MCP grant in the
    //   widened admin-only-scope TTL tier for no benefit.
    //
    // token.cli is added BACK: it is assignment-only, so `clientRequestableScopesSupported` drops it
    // from the base list, and a connector that never asks for it can never mint a CLI credential. It
    // is safe to advertise to every MCP client because the unlock gate is per-client — the consent
    // builder withholds it from any client without the `cli-handoff` profile, which lands it in the
    // submit's `rejected` set rather than failing the authorization. Assigning that profile is
    // therefore the switch that selects which clients can actually obtain it.
    scopesSupported: (allScopes) => {
      const base = allScopes.filter((scope) => scope !== SERVICE_TOKEN_OIDC_SCOPE && scope !== FIRESTORE_SESSION_OIDC_SCOPE);
      // Already present outside production, where `cli-handoff` is a default profile and `token.cli`
      // is therefore no longer assignment-only. Appended only when the base list omits it — i.e. in a
      // deployed environment, where an assigned client still needs it advertised to request it.
      return base.includes(CLI_TOKEN_OIDC_SCOPE) ? base : [...base, CLI_TOKEN_OIDC_SCOPE];
    },
    serverName: 'demo-api-mcp',
    serverVersion,
    serverInstructions: 'Demo API MCP tools for the dbx-components guestbook/profile sample models. Generated from the callModel _apiDetails tree.',
    mcpManifestPath: MCP_MANIFEST_PATH,
    mcpRouteManifestPath: ROUTE_MANIFEST_PATH
  };
}

/**
 * McpAuthRoleReader implementation for the demo app — maps a caller's Firebase
 * custom claims through the demo's `authRoleClaimsService` to the AuthRoleSet
 * the declarative {@link McpVisibilityRule.requiredRoles} check consumes.
 *
 * @param claims - The caller's Firebase custom claims object to translate into roles.
 * @returns The AuthRoleSet derived from the claims, used by the MCP visibility check.
 */
const demoMcpAuthRoleReader: McpAuthRoleReader = (claims) => DEMO_AUTH_CLAIMS_SERVICE.toRoles(claims);

/**
 * McpModelRolesTargetUidPredicate implementation for the demo app — gates the `model-roles` `uid`
 * parameter on the admin role.
 *
 * Resolving roles for another user's uid answers "what is *that* user allowed to do here?", which
 * discloses the target's effective access, so it is admin-only. Every caller can still resolve
 * roles for themselves; without this provider the `uid` parameter would fail closed for everyone.
 *
 * @param auth - The calling request's auth data, or undefined for an unauthenticated request.
 * @returns True when the caller holds the admin role.
 */
const demoMcpModelRolesTargetUidPredicate: McpModelRolesTargetUidPredicate = (auth) => DEMO_AUTH_CLAIMS_SERVICE.toRoles((auth?.token ?? {}) as unknown as AuthClaims).has(AUTH_ADMIN_ROLE);

/**
 * Binary name of the demo CLI, used to render the exact `demo-cli auth handoff <code>` command.
 */
export const DEMO_CLI_NAME = 'demo-cli';

/**
 * Path of the CLI artifact RELATIVE to the secure assets root (`dist/apps/demo-api/assets/secure`),
 * written there by demo-api's `copy-cli-artifact` target.
 */
export const DEMO_CLI_SECURE_ASSET_PATH = DEMO_CLI_NAME;

/**
 * Builds the `cli-token` MCP tool's minter for the demo app: the mint itself, plus (best-effort) a
 * signed download URL for the CLI artifact so an agent can go from nothing to a logged-in CLI in two
 * copy-pasteable commands.
 *
 * The download URL is genuinely optional — a dist without the artifact (a `build-base`-only run, or
 * a checkout that never ran `copy-cli-artifact`) still mints a usable claim code. Failing the whole
 * mint because the binary is missing would break the more important half of the feature.
 *
 * @param cliTokenService - The OIDC CLI-token mint service.
 * @param downloadService - The signed asset-download service.
 * @returns The minter to register under `MCP_CLI_TOKEN_MINTER`.
 */
export function demoMcpCliTokenMinterFactory(cliTokenService: OidcCliTokenService, downloadService: DownloadApiService): McpCliTokenMinter {
  const logger = new Logger('demoMcpCliTokenMinter');

  return async (input) => {
    // `requestIp` is forwarded so an MCP mint records the same address an HTTP mint does — otherwise
    // `bindClaimToMintIp` would bind codes minted over HTTP and silently skip those minted here.
    const minted = await cliTokenService.mintCliToken(input.auth, { scopes: input.scopes, ttlSeconds: input.ttlSeconds }, { requestIp: input.requestIp });
    let download: { readonly downloadUrl: string; readonly downloadSha256: string } | undefined;

    if (input.includeDownloadUrl !== false && downloadService.enabled) {
      try {
        const url = await downloadService.downloadUrlForAsset({ path: DEMO_CLI_SECURE_ASSET_PATH, forUid: input.auth?.uid });
        download = { downloadUrl: url.url, downloadSha256: url.sha256 };
      } catch (e) {
        logger.warn(`No CLI artifact available to mint a download URL for (${(e as Error).message}). Returning the claim code alone.`);
      }
    }

    return { ...minted, cliName: DEMO_CLI_NAME, ...download };
  };
}

/**
 * Dependency module for the Demo MCP module.
 *
 * Re-exports {@link DemoModelApiModule} so its `ModelApiCallModelDispatchService`
 * export propagates to `McpServerFactoryService`, plus the MCP module config provider.
 * Imports + re-exports {@link DemoApiOidcModule} so {@link OidcModuleConfig} is available
 * to the MCP config factory and its `OidcProviderConfigService` export propagates to the
 * `McpWellKnownController` (which reads the provider's `clientRequestableScopesSupported`).
 */
@Module({
  imports: [DemoApiOidcModule, DemoModelApiModule, DemoDownloadApiModule],
  providers: [
    {
      provide: McpModuleConfig,
      useFactory: demoMcpModuleConfigFactory,
      inject: [FirebaseServerEnvService, OidcModuleConfig]
    },
    {
      provide: MCP_AUTH_ROLE_READER,
      useValue: demoMcpAuthRoleReader
    },
    {
      provide: MCP_MODEL_ROLES_TARGET_UID_PREDICATE,
      useValue: demoMcpModelRolesTargetUidPredicate
    },
    {
      provide: MCP_CLI_TOKEN_MINTER,
      useFactory: demoMcpCliTokenMinterFactory,
      inject: [OidcCliTokenService, DownloadApiService]
    }
  ],
  exports: [McpModuleConfig, MCP_AUTH_ROLE_READER, MCP_MODEL_ROLES_TARGET_UID_PREDICATE, MCP_CLI_TOKEN_MINTER, DemoModelApiModule, DemoApiOidcModule]
})
export class DemoMcpDependencyModule {}

/**
 * Registers the MCP transport + protected-resource discovery controllers for the demo app.
 *
 * Routes: `POST /mcp`, `GET /.well-known/oauth-protected-resource` (both excluded
 * from the global `/api` route prefix by the host config).
 */
@Module(
  mcpModuleMetadata({
    dependencyModule: DemoMcpDependencyModule
  })
)
export class DemoMcpModule {}
