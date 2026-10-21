import { InjectionToken } from '@angular/core';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type Maybe, type PortNumber, type WebsiteUrl } from '@dereekb/util';

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
  /**
   * The pre-registered OAuth client the app's users sign in to the server with, used when a view is not given its own.
   *
   * Anything set here ships with the app, so a client secret here is visible to every user. Pass a per-user client to the view instead when the
   * secret must stay private.
   */
  readonly oauthClient?: Maybe<DbxMcpConnectOAuthClient>;
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

// MARK: OAuth Client
/**
 * Id of a pre-registered OAuth client.
 */
export type DbxMcpConnectOAuthClientId = string;

/**
 * Secret of a pre-registered confidential OAuth client.
 */
export type DbxMcpConnectOAuthClientSecret = string;

/**
 * A pre-registered OAuth client that an AI assistant signs in to the MCP server with.
 *
 * Needed when the server's authorization server does not offer dynamic client registration, which `@dereekb/firebase-server/oidc` turns off by
 * default. The client must allow the assistant's OAuth redirect URIs.
 */
export interface DbxMcpConnectOAuthClient {
  /**
   * The client id.
   */
  readonly clientId: DbxMcpConnectOAuthClientId;
  /**
   * The client secret, when it is known here. Omit for a public client that signs in with PKCE alone, or for a confidential client whose secret
   * the user already has (set {@link confidential} then).
   */
  readonly clientSecret?: Maybe<DbxMcpConnectOAuthClientSecret>;
  /**
   * Whether the client signs in with a client secret. Defaults to whether {@link clientSecret} is set.
   *
   * Set it to true for a client whose secret is not known here, such as one shown only once when the client was created, so the instructions
   * still ask the user for it instead of telling them to leave it blank.
   */
  readonly confidential?: Maybe<boolean>;
}

/**
 * Text shown in a snippet in place of a confidential client's secret when the secret is not known.
 */
export const DBX_MCP_CONNECT_CLIENT_SECRET_PLACEHOLDER = '<your client secret>';

/**
 * Returns whether the OAuth client signs in with a client secret.
 *
 * @param oauthClient - The OAuth client.
 * @returns {@link DbxMcpConnectOAuthClient.confidential} when set, otherwise whether the client secret is set.
 */
export function isConfidentialDbxMcpConnectOAuthClient(oauthClient: DbxMcpConnectOAuthClient): boolean {
  return oauthClient.confidential ?? Boolean(oauthClient.clientSecret);
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
 *
 * Shown in order: the steps, the snippet, the injected component, then the action link.
 */
export interface DbxMcpConnectClientInstructions {
  /**
   * Short steps shown in order.
   */
  readonly steps?: Maybe<string[]>;
  /**
   * Copyable command or config file.
   */
  readonly snippet?: Maybe<DbxMcpConnectClientInstructionsSnippet>;
  /**
   * Link to the client's settings, or an install deeplink.
   */
  readonly action?: Maybe<DbxMcpConnectClientInstructionsAction>;
  /**
   * Custom content shown after the steps and snippet, such as a client that needs more than text to set up.
   *
   * Pass anything the component needs, such as the server or OAuth client from {@link DbxMcpConnectClientInstructionsParams}, as the config's
   * `data`, which the component reads with `inject(DBX_INJECTION_COMPONENT_DATA)`.
   */
  readonly injection?: Maybe<DbxInjectionComponentConfig>;
}

/**
 * Params for {@link DbxMcpConnectClient.instructions}.
 */
export interface DbxMcpConnectClientInstructionsParams {
  /**
   * The server to connect to.
   */
  readonly server: DbxMcpConnectServer;
  /**
   * The pre-registered OAuth client to sign in with. When unset, the instructions assume the assistant registers itself.
   */
  readonly oauthClient?: Maybe<DbxMcpConnectOAuthClient>;
}

/**
 * An AI assistant that can connect to an MCP server, along with how to connect it./**
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
   * Builds the connect instructions for the input server and OAuth client.
   */
  readonly instructions: (params: DbxMcpConnectClientInstructionsParams) => DbxMcpConnectClientInstructions;
}

/**
 * Claude on the web, Desktop, and mobile, connected through a custom connector.
 */
export const CLAUDE_DBX_MCP_CONNECT_CLIENT: DbxMcpConnectClient = {
  id: 'claude',
  label: 'Claude',
  docsUrl: 'https://claude.com/docs/connectors/custom/add-unlisted',
  instructions: ({ server, oauthClient }) => {
    const steps = ['In Claude, open Customize > Connectors.', `Click Add custom connector, enter a name such as "${dbxMcpConnectServerLabel(server)}", and paste the MCP server URL.`];

    if (oauthClient) {
      steps.push(isConfidentialDbxMcpConnectOAuthClient(oauthClient) ? 'Open Advanced settings, or choose Use your own OAuth client, and paste the client ID and client secret.' : 'Open Advanced settings, or choose Use your own OAuth client, and paste the client ID. Leave the client secret blank.');
    }

    steps.push('Click Add, then Connect and sign in.');

    return {
      steps,
      action: { text: 'Open Claude connectors', icon: 'open_in_new', url: 'https://claude.ai/customize/connectors' }
    };
  }
};

/**
 * Port Claude Code listens on for the OAuth callback when it signs in with a pre-registered OAuth client.
 */
export const DEFAULT_CLAUDE_CODE_DBX_MCP_CONNECT_CALLBACK_PORT: PortNumber = 8080;

/**
 * Config for {@link makeClaudeCodeDbxMcpConnectClient}.
 */
export interface ClaudeCodeDbxMcpConnectClientConfig {
  /**
   * Port Claude Code listens on for the OAuth callback when it signs in with a pre-registered OAuth client. Claude Code otherwise picks a
   * random port, which a client registered with an exact `http://localhost:<port>/callback` redirect URI rejects.
   *
   * Defaults to {@link DEFAULT_CLAUDE_CODE_DBX_MCP_CONNECT_CALLBACK_PORT}.
   */
  readonly callbackPort?: Maybe<PortNumber>;
}

/**
 * Creates a Claude Code client, connected with the `claude mcp add` command.
 *
 * With a pre-registered OAuth client, the command passes `--client-id`, `--client-secret` (Claude Code then asks for the secret, so it never
 * appears in the command), and `--callback-port`. The OAuth client must allow `http://localhost:<callbackPort>/callback`.
 *
 * @param config - Optional config, such as the OAuth callback port.
 * @returns The Claude Code client.
 */
export function makeClaudeCodeDbxMcpConnectClient(config?: Maybe<ClaudeCodeDbxMcpConnectClientConfig>): DbxMcpConnectClient {
  const callbackPort = config?.callbackPort ?? DEFAULT_CLAUDE_CODE_DBX_MCP_CONNECT_CALLBACK_PORT;

  return {
    id: 'claude-code',
    label: 'Claude Code',
    docsUrl: 'https://code.claude.com/docs/en/mcp',
    instructions: ({ server, oauthClient }) => {
      const name = dbxMcpConnectServerName(server);
      const commandParts = ['claude mcp add --transport http'];

      if (oauthClient) {
        commandParts.push(`--client-id ${oauthClient.clientId}`);

        if (isConfidentialDbxMcpConnectOAuthClient(oauthClient)) {
          commandParts.push('--client-secret');
        }

        commandParts.push(`--callback-port ${callbackPort}`);
      }

      commandParts.push(name, server.url);

      return {
        steps: [
          oauthClient && isConfidentialDbxMcpConnectOAuthClient(oauthClient) ? 'Run the command below in your terminal, and paste the client secret when it asks.' : 'Run the command below in your terminal.',
          `In Claude Code, run /mcp, select "${name}", and choose Authenticate.`,
          'Sign in when your browser opens.'
        ],
        snippet: { label: 'Run in your terminal', text: commandParts.join(' ') }
      };
    }
  };
}

/**
 * Claude Code, connected with the `claude mcp add` command. Uses {@link DEFAULT_CLAUDE_CODE_DBX_MCP_CONNECT_CALLBACK_PORT}.
 */
export const CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT: DbxMcpConnectClient = makeClaudeCodeDbxMcpConnectClient();

/**
 * ChatGPT on the web, connected as a custom MCP server.
 */
export const CHATGPT_DBX_MCP_CONNECT_CLIENT: DbxMcpConnectClient = {
  id: 'chatgpt',
  label: 'ChatGPT',
  docsUrl: 'https://developers.openai.com/api/docs/guides/custom-mcp-server',
  instructions: ({ server, oauthClient }) => {
    let authStep = 'Choose OAuth authentication and accept the warning.';

    if (oauthClient) {
      authStep = isConfidentialDbxMcpConnectOAuthClient(oauthClient)
        ? 'Choose OAuth, open the advanced OAuth settings, choose User-Defined OAuth Client, and paste the client ID and client secret.'
        : 'Choose OAuth, open the advanced OAuth settings, choose User-Defined OAuth Client, paste the client ID, and set the token endpoint auth method to none.';
    }

    return {
      steps: ['In ChatGPT on the web, open Plugins.', `Click +, choose Add custom MCP server, enter a name such as "${dbxMcpConnectServerLabel(server)}", and paste the MCP server URL.`, authStep, 'Select Create, and sign in.'],
      action: { text: 'Open ChatGPT plugins', icon: 'open_in_new', url: 'https://chatgpt.com/plugins' }
    };
  }
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
 *
 * A pre-registered OAuth client goes in the `mcp.json` file's `auth` object. The deeplink is left out then, since Cursor only documents it for a
 * server url and a link should not carry a client secret.
 */
export const CURSOR_DBX_MCP_CONNECT_CLIENT: DbxMcpConnectClient = {
  id: 'cursor',
  label: 'Cursor',
  docsUrl: 'https://cursor.com/docs/mcp',
  instructions: ({ server, oauthClient }) => {
    const name = dbxMcpConnectServerName(server);
    const confidential = oauthClient != null && isConfidentialDbxMcpConnectOAuthClient(oauthClient);
    const clientSecretUnknown = confidential && !oauthClient?.clientSecret;
    // JSON.stringify() drops the undefined values
    const auth = oauthClient ? { CLIENT_ID: oauthClient.clientId, CLIENT_SECRET: confidential ? (oauthClient.clientSecret ?? DBX_MCP_CONNECT_CLIENT_SECRET_PLACEHOLDER) : undefined } : undefined;
    const config = { mcpServers: { [name]: { url: server.url, auth } } };
    let firstStep = 'Click Add to Cursor, or add the config below to ~/.cursor/mcp.json.';

    if (clientSecretUnknown) {
      firstStep = `Add the config below to ~/.cursor/mcp.json, replacing ${DBX_MCP_CONNECT_CLIENT_SECRET_PLACEHOLDER} with your client secret.`;
    } else if (oauthClient) {
      firstStep = 'Add the config below to ~/.cursor/mcp.json.';
    }

    return {
      steps: [firstStep, `In Cursor Settings > MCP, find "${name}" and click Connect.`, 'Sign in when your browser opens.'],
      snippet: { label: '~/.cursor/mcp.json', text: JSON.stringify(config, null, 2) },
      action: oauthClient ? undefined : { text: 'Add to Cursor', icon: 'download', url: cursorDbxMcpConnectInstallUrl(server) }
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
 *
 * A pre-registered OAuth client's id goes in the `mcp.json` file's `oauth` object, and VS Code stores its secret through the Set Client Secret
 * action above the server entry. The install link is left out then.
 */
export const VSCODE_DBX_MCP_CONNECT_CLIENT: DbxMcpConnectClient = {
  id: 'vscode',
  label: 'VS Code',
  docsUrl: 'https://code.visualstudio.com/docs/agent-customization/mcp-servers',
  instructions: ({ server, oauthClient }) => {
    const name = dbxMcpConnectServerName(server);
    // JSON.stringify() drops the undefined oauth value
    const config = { servers: { [name]: { type: 'http', url: server.url, oauth: oauthClient ? { clientId: oauthClient.clientId } : undefined } } };
    const steps = [oauthClient ? 'Add the config below to .vscode/mcp.json in your workspace.' : 'Click Install in VS Code, or add the config below to .vscode/mcp.json in your workspace.'];

    if (oauthClient && isConfidentialDbxMcpConnectOAuthClient(oauthClient)) {
      steps.push('Click Set Client Secret above the server entry and paste the client secret.');
    }

    steps.push(`Start the "${name}" server and sign in when VS Code asks.`, 'Use its tools from Copilot Chat in agent mode.');

    return {
      steps,
      snippet: { label: '.vscode/mcp.json', text: JSON.stringify(config, null, 2) },
      action: oauthClient ? undefined : { text: 'Install in VS Code', icon: 'download', url: vscodeDbxMcpConnectInstallUrl(server) }
    };
  }
};

/**
 * Grok, connected through a custom connector. Not part of {@link DEFAULT_DBX_MCP_CONNECT_CLIENTS}.
 *
 * Grok's connectors do not take a pre-registered OAuth client, so with one configured the steps say that Grok must register itself.
 */
export const GROK_DBX_MCP_CONNECT_CLIENT: DbxMcpConnectClient = {
  id: 'grok',
  label: 'Grok',
  docsUrl: 'https://docs.x.ai/grok/connectors',
  instructions: ({ oauthClient }) => {
    const steps = ['In Grok, open Connectors.', 'Click New Connector, choose Custom, and paste the MCP server URL.', 'Sign in when asked.'];

    if (oauthClient) {
      steps.push('Grok cannot use a client ID, so it can only sign in if this server lets it register itself.');
    }

    return {
      steps,
      action: { text: 'Open Grok connectors', icon: 'open_in_new', url: 'https://grok.com/connectors' }
    };
  }
};

/**
 * Clients shown by `dbx-mcp-connect-view` when none are configured.
 */
export const DEFAULT_DBX_MCP_CONNECT_CLIENTS: DbxMcpConnectClient[] = [CLAUDE_DBX_MCP_CONNECT_CLIENT, CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT, CHATGPT_DBX_MCP_CONNECT_CLIENT, CURSOR_DBX_MCP_CONNECT_CLIENT, VSCODE_DBX_MCP_CONNECT_CLIENT];
