import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { Module } from '@nestjs/common';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { McpModuleConfig, mcpModuleMetadata, MCP_AUTH_ROLE_READER, MCP_MODEL_ROLES_TARGET_UID_PREDICATE, type McpAuthRoleReader, type McpModelRolesTargetUidPredicate } from '@dereekb/firebase-server/mcp';
import { OidcModuleConfig } from '@dereekb/firebase-server/oidc';
import { FIRESTORE_SESSION_OIDC_SCOPE, SERVICE_TOKEN_OIDC_SCOPE } from '@dereekb/firebase';
import { AUTH_ADMIN_ROLE, type AuthClaims } from '@dereekb/util';
import { DEMO_AUTH_CLAIMS_SERVICE } from 'demo-firebase';
import { DemoApiOidcModule } from '../../api/oidc/oidc.module';
import { DemoModelApiModule } from '../model/model.module';
import packageJson from '../../../../package.json';

const serverVersion: string = packageJson.version;

/**
 * Resolves the on-disk path to a build-time manifest emitted into `dist/apps/demo-api`.
 *
 * The lookup has to cope with three different `process.cwd()` values:
 * - The Firebase Functions emulator + production runtime set `cwd` to the deployed
 *   function directory (the same one `main.js` was bundled into), so the manifest
 *   lives at `<cwd>/<fileName>` — sibling to the running bundle.
 * - dbx-cli boots from the workspace root, so the manifest lives at
 *   `<cwd>/dist/apps/demo-api/<fileName>`.
 * - Vitest runs with `cwd` set to the project root (`apps/demo-api`, see the
 *   `run-tests` target), which is neither of the above — so the workspace-root form
 *   is also probed against each ancestor directory.
 *
 * Prior to this resolver the path was hardcoded to the workspace-root form, which
 * silently failed under the functions runtime and made the manifest-gated tools
 * (`model-info`, `model-decode`) invisible to MCP clients.
 *
 * @param fileName - Manifest file name, e.g. `mcp.manifest.json`.
 * @returns The absolute path to the first candidate that exists, else the workspace-root form relative to `cwd` (so the loader logs a "missing file" warning naming that path).
 */
function resolveDistManifestPath(fileName: string): string {
  const cwd = process.cwd();
  const colocatedWithBundle = path.join(cwd, fileName);
  let result: string | undefined = existsSync(colocatedWithBundle) ? colocatedWithBundle : undefined;

  if (result == null) {
    // Walk up from cwd so a run rooted anywhere inside the workspace (vitest's projectRoot cwd,
    // for instance) still finds the dist output at the workspace root.
    let directory = cwd;

    for (;;) {
      const candidate = path.join(directory, 'dist/apps/demo-api', fileName);

      if (existsSync(candidate)) {
        result = candidate;
        break;
      }

      const parent = path.dirname(directory);

      if (parent === directory) {
        break;
      }

      directory = parent;
    }
  }

  return result ?? path.join(cwd, 'dist/apps/demo-api', fileName);
}

const MCP_MANIFEST_PATH = resolveDistManifestPath('mcp.manifest.json');
const ROUTE_MANIFEST_PATH = resolveDistManifestPath('route.manifest.json');

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
    scopesSupported: (allScopes) => allScopes.filter((scope) => scope !== SERVICE_TOKEN_OIDC_SCOPE && scope !== FIRESTORE_SESSION_OIDC_SCOPE),
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
 * Dependency module for the Demo MCP module.
 *
 * Re-exports {@link DemoModelApiModule} so its `ModelApiCallModelDispatchService`
 * export propagates to `McpServerFactoryService`, plus the MCP module config provider.
 * Imports + re-exports {@link DemoApiOidcModule} so {@link OidcModuleConfig} is available
 * to the MCP config factory and its `OidcProviderConfigService` export propagates to the
 * `McpWellKnownController` (which reads the provider's `clientRequestableScopesSupported`).
 */
@Module({
  imports: [DemoApiOidcModule, DemoModelApiModule],
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
    }
  ],
  exports: [McpModuleConfig, MCP_AUTH_ROLE_READER, MCP_MODEL_ROLES_TARGET_UID_PREDICATE, DemoModelApiModule, DemoApiOidcModule]
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
