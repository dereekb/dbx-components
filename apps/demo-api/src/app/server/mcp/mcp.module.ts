import * as path from 'node:path';
import { Module } from '@nestjs/common';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { McpModuleConfig, mcpModuleMetadata, MCP_AUTH_ROLE_READER, type McpAuthRoleReader } from '@dereekb/firebase-server/mcp';
import { OidcModuleConfig } from '@dereekb/firebase-server/oidc';
import { DEMO_AUTH_CLAIMS_SERVICE } from 'demo-firebase';
import { DemoApiOidcModule } from '../../api/oidc/oidc.module';
import { DemoModelApiModule } from '../model/model.module';
import packageJson from '../../../../package.json';

const serverVersion: string = packageJson.version;

const MCP_MANIFEST_PATH = path.join(process.cwd(), 'dist/apps/demo-api/mcp.manifest.json');

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
    serverName: 'demo-api-mcp',
    serverVersion,
    mcpManifestPath: MCP_MANIFEST_PATH
  };
}

/**
 * McpAuthRoleReader implementation for the demo app — maps a caller's Firebase
 * custom claims through the demo's `authRoleClaimsService` to the AuthRoleSet
 * the declarative {@link McpVisibilityRule.requiredRoles} check consumes.
 */
const demoMcpAuthRoleReader: McpAuthRoleReader = (claims) => DEMO_AUTH_CLAIMS_SERVICE.toRoles(claims);

/**
 * Dependency module for the Demo MCP module.
 *
 * Re-exports {@link DemoModelApiModule} so its `ModelApiCallModelDispatchService`
 * export propagates to `McpServerFactoryService`, plus the MCP module config provider.
 * Imports {@link DemoApiOidcModule} so {@link OidcModuleConfig} is available to the
 * MCP config factory.
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
    }
  ],
  exports: [McpModuleConfig, MCP_AUTH_ROLE_READER, DemoModelApiModule]
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
