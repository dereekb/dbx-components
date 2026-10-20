import { InjectionToken } from '@angular/core';
import { type Maybe, type WebsiteUrl } from '@dereekb/util';

// MARK: Server
/**
 * An MCP server that users can connect an AI assistant to.
 */
export interface DbxMcpConnectServer {
  /**
   * The MCP server's Streamable HTTP endpoint url, e.g. `https://api.example.com/mcp`.
   */
  readonly url: WebsiteUrl;
  /**
   * Local key for the server, used in CLI commands and config files (e.g. `claude mcp add <name> ...`).
   *
   * Derived from the url's hostname when not set. See {@link dbxMcpConnectServerName}.
   */
  readonly name?: Maybe<string>;
  /**
   * Display name for the server, suggested as the connector name in the clients that ask for one.
   *
   * Defaults to the server's name.
   */
  readonly label?: Maybe<string>;
}

/**
 * Optional app-level source of the {@link DbxMcpConnectServer} used by `dbx-mcp-connect-view` and `dbx-mcp-connect-button`
 * when no server is passed to them directly.
 *
 * `provideDbxFirebaseOidc()` in `@dereekb/dbx-firebase/oidc` provides this from the app's OIDC config.
 */
export const DBX_MCP_CONNECT_SERVER = new InjectionToken<DbxMcpConnectServer>('DbxMcpConnectServer');

/**
 * Hostname prefixes removed before the server name is derived from a url's hostname.
 */
const DBX_MCP_CONNECT_SERVER_NAME_HOSTNAME_PREFIX_REGEX = /^(?:(?:api|www|mcp)\.)+/;

/**
 * Fallback server name used when the url cannot be parsed.
 */
export const DEFAULT_DBX_MCP_CONNECT_SERVER_NAME = 'mcp';

/**
 * Returns the local key to use for the server in CLI commands and config files.
 *
 * Uses {@link DbxMcpConnectServer.name} when set. Otherwise derives it from the url's hostname by removing a leading `api.`, `www.`, or `mcp.`
 * and taking the first label, so `https://api.example.com/mcp` becomes `example` and `http://localhost:9901/mcp` becomes `localhost`.
 *
 * @param server - The server to name.
 * @returns The server's local key.
 */
export function dbxMcpConnectServerName(server: DbxMcpConnectServer): string {
  let name = server.name;

  if (!name) {
    try {
      const hostname = new URL(server.url).hostname.replace(DBX_MCP_CONNECT_SERVER_NAME_HOSTNAME_PREFIX_REGEX, '');
      name = hostname.split('.')[0];
    } catch {
      name = undefined;
    }
  }

  return name || DEFAULT_DBX_MCP_CONNECT_SERVER_NAME;
}

/**
 * Returns the display name to use for the server.
 *
 * @param server - The server to label.
 * @returns {@link DbxMcpConnectServer.label} When set, otherwise the server's name from {@link dbxMcpConnectServerName}.
 */
export function dbxMcpConnectServerLabel(server: DbxMcpConnectServer): string {
  return server.label || dbxMcpConnectServerName(server);
}

// MARK: Client
/**
 * Unique identifier of a {@link DbxMcpConnectClient}.
 */
export type DbxMcpConnectClientId = string;

/**
 * A copyable command or config file shown with a client's instructions.
 */
export interface DbxMcpConnectClientInstructionsSnippet {
  /**
   * Describes what the snippet is and where it goes, e.g. "Run in your terminal".
   */
  readonly label: string;
  /**
   * The text to copy.
   */
  readonly text: string;
}

/**
 * A link shown with a client's instructions, such as a settings page or an install deeplink.
 */
export interface DbxMcpConnectClientInstructionsAction {
  /**
   * Button text.
   */
  readonly text: string;
  /**
   * Button icon.
   */
  readonly icon?: Maybe<string>;
  /**
   * Url opened in a new tab. May use an app's custom scheme, such as `cursor://` or `vscode:`.
   */
  readonly url: string;
}

/**
 * Instructions for connecting one client to an MCP server.
 */
export interface DbxMcpConnectClientInstructions {
  /**
   * Short steps shown in order.
   */
  readonly steps: string[];
  /**
   * Copyable command or config file.
   */
  readonly snippet?: Maybe<DbxMcpConnectClientInstructionsSnippet>;
  /**
   * Link to the client's settings, or an install deeplink.
   */
  readonly action?: Maybe<DbxMcpConnectClientInstructionsAction>;
}

/**
 * An AI assistant that can connect to an MCP server, along with how to connect it.
 *
 * Vendors move menus, so keep the steps short and override a client per instance when its steps go stale.
 */
export interface DbxMcpConnectClient {
  readonly id: DbxMcpConnectClientId;
  /**
   * Display name, e.g. "Claude Code".
   */
  readonly label: string;
  /**
   * Optional icon shown next to the label.
   */
  readonly icon?: Maybe<string>;
  /**
   * Link to the vendor's documentation for connecting MCP servers.
   */
  readonly docsUrl?: Maybe<WebsiteUrl>;
  /**
   * Builds the connect instructions for the input server.
   */
  readonly instructions: (server: DbxMcpConnectServer) => DbxMcpConnectClientInstructions;
}

/**
 * Claude on the web, Desktop, and mobile, connected through a custom connector.
 */
export const CLAUDE_DBX_MCP_CONNECT_CLIENT: DbxMcpConnectClient = {
  id: 'claude',
  label: 'Claude',
  docsUrl: 'https://claude.com/docs/connectors/custom/add-unlisted',
  instructions: (server) => ({
    steps: ['In Claude, open Customize > Connectors.', `Click Add custom connector, enter a name such as "${dbxMcpConnectServerLabel(server)}", and paste the MCP server URL.`, 'Click Add, then Connect and sign in.'],
    action: { text: 'Open Claude connectors', icon: 'open_in_new', url: 'https://claude.ai/customize/connectors' }
  })
};

/**
 * Claude Code, connected with the `claude mcp add` command.
 */
export const CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT: DbxMcpConnectClient = {
  id: 'claude-code',
  label: 'Claude Code',
  docsUrl: 'https://code.claude.com/docs/en/mcp',
  instructions: (server) => {
    const name = dbxMcpConnectServerName(server);

    return {
      steps: ['Run the command below in your terminal.', `In Claude Code, run /mcp, select "${name}", and choose Authenticate.`, 'Sign in when your browser opens.'],
      snippet: { label: 'Run in your terminal', text: `claude mcp add --transport http ${name} ${server.url}` }
    };
  }
};

/**
 * ChatGPT on the web, connected as a custom MCP server.
 */
export const CHATGPT_DBX_MCP_CONNECT_CLIENT: DbxMcpConnectClient = {
  id: 'chatgpt',
  label: 'ChatGPT',
  docsUrl: 'https://developers.openai.com/api/docs/guides/custom-mcp-server',
  instructions: (server) => ({
    steps: [
      'In ChatGPT on the web, open Plugins. If you do not see the + button, turn on Developer mode in Settings.',
      `Click +, choose Add custom MCP server, enter a name such as "${dbxMcpConnectServerLabel(server)}", and paste the MCP server URL.`,
      'Choose OAuth authentication, accept the warning, select Create, and sign in.'
    ],
    action: { text: 'Open ChatGPT plugins', icon: 'open_in_new', url: 'https://chatgpt.com/plugins' }
  })
};

/**
 * Returns the Cursor deeplink that installs the server.
 *
 * @param server - The server to install.
 * @returns A `cursor://anysphere.cursor-deeplink/mcp/install` url with the server's name and base64-encoded config.
 */
export function cursorDbxMcpConnectInstallUrl(server: DbxMcpConnectServer): string {
  const config = btoa(JSON.stringify({ url: server.url }));
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(dbxMcpConnectServerName(server))}&config=${encodeURIComponent(config)}`;
}

/**
 * Cursor, connected with an install deeplink or its `mcp.json` file.
 */
export const CURSOR_DBX_MCP_CONNECT_CLIENT: DbxMcpConnectClient = {
  id: 'cursor',
  label: 'Cursor',
  docsUrl: 'https://cursor.com/docs/mcp',
  instructions: (server) => {
    const name = dbxMcpConnectServerName(server);
    const config = { mcpServers: { [name]: { url: server.url } } };

    return {
      steps: ['Click Add to Cursor, or add the config below to ~/.cursor/mcp.json.', `In Cursor Settings > MCP, find "${name}" and click Connect.`, 'Sign in when your browser opens.'],
      snippet: { label: '~/.cursor/mcp.json', text: JSON.stringify(config, null, 2) },
      action: { text: 'Add to Cursor', icon: 'download', url: cursorDbxMcpConnectInstallUrl(server) }
    };
  }
};

/**
 * Returns the VS Code url that installs the server.
 *
 * @param server - The server to install.
 * @returns A `vscode:mcp/install` url with the server's url-encoded JSON config.
 */
export function vscodeDbxMcpConnectInstallUrl(server: DbxMcpConnectServer): string {
  const config = { name: dbxMcpConnectServerName(server), type: 'http', url: server.url };
  return `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
}

/**
 * VS Code (GitHub Copilot agent mode), connected with an install link or a `.vscode/mcp.json` file.
 */
export const VSCODE_DBX_MCP_CONNECT_CLIENT: DbxMcpConnectClient = {
  id: 'vscode',
  label: 'VS Code',
  docsUrl: 'https://code.visualstudio.com/docs/agent-customization/mcp-servers',
  instructions: (server) => {
    const name = dbxMcpConnectServerName(server);
    const config = { servers: { [name]: { type: 'http', url: server.url } } };

    return {
      steps: ['Click Install in VS Code, or add the config below to .vscode/mcp.json in your workspace.', `Start the "${name}" server and sign in when VS Code asks.`, 'Use its tools from Copilot Chat in agent mode.'],
      snippet: { label: '.vscode/mcp.json', text: JSON.stringify(config, null, 2) },
      action: { text: 'Install in VS Code', icon: 'download', url: vscodeDbxMcpConnectInstallUrl(server) }
    };
  }
};

/**
 * Grok, connected through a custom connector. Not part of {@link DEFAULT_DBX_MCP_CONNECT_CLIENTS}.
 */
export const GROK_DBX_MCP_CONNECT_CLIENT: DbxMcpConnectClient = {
  id: 'grok',
  label: 'Grok',
  docsUrl: 'https://docs.x.ai/grok/connectors',
  instructions: () => ({
    steps: ['In Grok, open Connectors.', 'Click New Connector, choose Custom, and paste the MCP server URL.', 'Sign in when asked.'],
    action: { text: 'Open Grok connectors', icon: 'open_in_new', url: 'https://grok.com/connectors' }
  })
};

/**
 * Clients shown by `dbx-mcp-connect-view` when none are configured.
 */
export const DEFAULT_DBX_MCP_CONNECT_CLIENTS: DbxMcpConnectClient[] = [CLAUDE_DBX_MCP_CONNECT_CLIENT, CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT, CHATGPT_DBX_MCP_CONNECT_CLIENT, CURSOR_DBX_MCP_CONNECT_CLIENT, VSCODE_DBX_MCP_CONNECT_CLIENT];
