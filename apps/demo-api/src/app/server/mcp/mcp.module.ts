import { Module } from '@nestjs/common';
import { McpModuleConfig, mcpModuleMetadata } from '@dereekb/firebase-server/mcp';
import { ModelApiCallModelDispatchService, MODEL_API_NEST_APPLICATION_CONTEXT } from '@dereekb/firebase-server';
import { DemoModelApiModule } from '../model/model.module';

/**
 * The Demo API serves MCP at `${appUrl}/mcp` with the OIDC issuer at `${appUrl}/oidc`.
 *
 * Real deployments should source these values from environment variables; the demo
 * uses fixed local URLs so the protected-resource discovery document is deterministic
 * across test runs.
 */
export const DEMO_MCP_MODULE_CONFIG: McpModuleConfig = {
  oidcIssuer: 'http://localhost:9904/oidc',
  mcpUrl: 'http://localhost:9904/mcp',
  serverName: 'demo-api-mcp',
  serverVersion: '0.0.0'
};

/**
 * Dependency module for the Demo MCP module.
 *
 * Re-exports the dispatch service + nest-application context tokens from the
 * already-wired {@link DemoModelApiModule}, plus the MCP module config provider.
 */
@Module({
  imports: [DemoModelApiModule],
  providers: [
    {
      provide: McpModuleConfig,
      useValue: DEMO_MCP_MODULE_CONFIG
    }
  ],
  exports: [McpModuleConfig, ModelApiCallModelDispatchService, MODEL_API_NEST_APPLICATION_CONTEXT]
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
