import { Module } from '@nestjs/common';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { McpModuleConfig, mcpModuleMetadata } from '@dereekb/firebase-server/mcp';
import { OidcModuleConfig } from '@dereekb/firebase-server/oidc';
import { DemoApiOidcModule } from '../../api/oidc/oidc.module';
import { DemoModelApiModule } from '../model/model.module';
import packageJson from '../../../../package.json';

const serverVersion: string = packageJson.version;

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
    serverVersion
  };
}

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
    }
  ],
  exports: [McpModuleConfig, DemoModelApiModule]
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
