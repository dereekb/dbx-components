import { inject, Injectable, signal } from '@angular/core';
import { type ArrayOrValue, asArray, type Maybe } from '@dereekb/util';
import { DEFAULT_DBX_MCP_CONNECT_CLIENTS, type DbxMcpConnectClient, type DbxMcpConnectClientId } from './mcp.connect';

/**
 * App-level config for {@link DbxMcpConnectService}. Provide it with `provideDbxMcpConnectService()`.
 */
export abstract class DbxMcpConnectServiceConfig {
  /**
   * Clients shown by `dbx-mcp-connect-view` and `dbx-mcp-connect-button` when they are not given their own, in display order.
   *
   * Defaults to {@link DEFAULT_DBX_MCP_CONNECT_CLIENTS}. Leave a client out to hide it, or add your own.
   */
  abstract readonly clients?: Maybe<DbxMcpConnectClient[]>;
  /**
   * Id of the client selected at first when a view is not given its own. Defaults to the first client.
   */
  abstract readonly defaultClientId?: Maybe<DbxMcpConnectClientId>;
}

/**
 * App-level source of the AI assistants that `dbx-mcp-connect-view` and `dbx-mcp-connect-button` show when they are not given their own.
 *
 * Starts from {@link DbxMcpConnectServiceConfig}, and can be changed at runtime, such as by a feature that registers its own client. The view
 * follows the changes. Provide it with `provideDbxMcpConnectService()`. Without it, the view shows {@link DEFAULT_DBX_MCP_CONNECT_CLIENTS}.
 */
@Injectable()
export class DbxMcpConnectService {
  private readonly _config = inject(DbxMcpConnectServiceConfig, { optional: true });

  private readonly _clients = signal<DbxMcpConnectClient[]>(this._config?.clients ?? DEFAULT_DBX_MCP_CONNECT_CLIENTS);
  private readonly _defaultClientId = signal<Maybe<DbxMcpConnectClientId>>(this._config?.defaultClientId);

  /**
   * The app's clients, in display order.
   */
  readonly clientsSignal = this._clients.asReadonly();

  /**
   * Id of the client selected at first, if set.
   */
  readonly defaultClientIdSignal = this._defaultClientId.asReadonly();

  /**
   * Replaces the app's clients.
   *
   * @param clients - The clients to show, in display order.
   */
  setClients(clients: DbxMcpConnectClient[]): void {
    this._clients.set(clients);
  }

  /**
   * Adds clients to the end of the list. A client whose id is already registered replaces the existing one in place.
   *
   * @param clients - The client or clients to add.
   */
  registerClients(clients: ArrayOrValue<DbxMcpConnectClient>): void {
    const added = asArray(clients);
    const addedById = new Map(added.map((x) => [x.id, x]));

    this._clients.update((current) => {
      const replaced = current.map((x) => addedById.get(x.id) ?? x);
      const currentIds = new Set(current.map((x) => x.id));
      return [...replaced, ...added.filter((x) => !currentIds.has(x.id))];
    });
  }

  /**
   * Removes clients from the list, hiding them.
   *
   * @param clientIds - Id or ids of the clients to remove.
   */
  unregisterClients(clientIds: ArrayOrValue<DbxMcpConnectClientId>): void {
    const removedIds = new Set(asArray(clientIds));
    this._clients.update((current) => current.filter((x) => !removedIds.has(x.id)));
  }

  /**
   * Sets the id of the client selected at first.
   *
   * @param clientId - The client id, or undefined to select the first client.
   */
  setDefaultClientId(clientId: Maybe<DbxMcpConnectClientId>): void {
    this._defaultClientId.set(clientId);
  }
}
