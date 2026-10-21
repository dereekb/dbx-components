import { type EnvironmentProviders, makeEnvironmentProviders, type Provider } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DBX_MCP_CONNECT_SERVER, type DbxMcpConnectClient, type DbxMcpConnectClientId, type DbxMcpConnectServer } from './mcp.connect';
import { DbxMcpConnectService, DbxMcpConnectServiceConfig } from './mcp.connect.service';

/**
 * Config for {@link provideDbxMcpConnectService}.
 */
export interface ProvideDbxMcpConnectServiceConfig {
  /**
   * The app's MCP server, provided as {@link DBX_MCP_CONNECT_SERVER}.
   *
   * Leave unset in apps that call `provideDbxFirebaseOidc()`, which provides the server from the app's OIDC config.
   */
  readonly server?: Maybe<DbxMcpConnectServer>;
  /**
   * The app's clients, in display order. See {@link DbxMcpConnectServiceConfig.clients}.
   */
  readonly clients?: Maybe<DbxMcpConnectClient[]>;
  /**
   * Id of the client selected at first. See {@link DbxMcpConnectServiceConfig.defaultClientId}.
   */
  readonly defaultClientId?: Maybe<DbxMcpConnectClientId>;
}

/**
 * Creates EnvironmentProviders for {@link DbxMcpConnectService}, which sets the AI assistants that `dbx-mcp-connect-view` and
 * `dbx-mcp-connect-button` show across the app.
 *
 * @param config - Optional app-level config.
 * @returns EnvironmentProviders.
 *
 * @example
 * ```ts
 * provideDbxMcpConnectService({ clients: [...DEFAULT_DBX_MCP_CONNECT_CLIENTS, GROK_DBX_MCP_CONNECT_CLIENT], defaultClientId: 'claude-code' })
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function provideDbxMcpConnectService(config?: ProvideDbxMcpConnectServiceConfig): EnvironmentProviders {
  const providers: Provider[] = [DbxMcpConnectService];

  if (config) {
    const serviceConfig: DbxMcpConnectServiceConfig = { clients: config.clients, defaultClientId: config.defaultClientId };
    providers.push({ provide: DbxMcpConnectServiceConfig, useValue: serviceConfig });

    if (config.server) {
      providers.push({ provide: DBX_MCP_CONNECT_SERVER, useValue: config.server });
    }
  }

  return makeEnvironmentProviders(providers);
}
