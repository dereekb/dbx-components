import { describe, expect, it } from 'vitest';
import {
  CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT,
  CLAUDE_DBX_MCP_CONNECT_CLIENT,
  CURSOR_DBX_MCP_CONNECT_CLIENT,
  cursorDbxMcpConnectInstallUrl,
  DBX_MCP_CONNECT_CLIENT_SECRET_PLACEHOLDER,
  isConfidentialDbxMcpConnectOAuthClient,
  DEFAULT_DBX_MCP_CONNECT_CLIENTS,
  DEFAULT_DBX_MCP_CONNECT_SERVER_NAME,
  type DbxMcpConnectOAuthClient,
  type DbxMcpConnectServer,
  dbxMcpConnectServerLabel,
  dbxMcpConnectServerName,
  GROK_DBX_MCP_CONNECT_CLIENT,
  makeClaudeCodeDbxMcpConnectClient,
  VSCODE_DBX_MCP_CONNECT_CLIENT,
  vscodeDbxMcpConnectInstallUrl
} from './mcp.connect';

const TEST_SERVER: DbxMcpConnectServer = { url: 'https://api.example.com/mcp' };
const TEST_OAUTH_CLIENT: DbxMcpConnectOAuthClient = { clientId: 'test-client-id', clientSecret: 'test-client-secret' };
const TEST_PUBLIC_OAUTH_CLIENT: DbxMcpConnectOAuthClient = { clientId: 'test-client-id' };
const TEST_UNKNOWN_SECRET_OAUTH_CLIENT: DbxMcpConnectOAuthClient = { clientId: 'test-client-id', confidential: true };

describe('dbxMcpConnectServerName()', () => {
  it('should return the configured name', () => {
    expect(dbxMcpConnectServerName({ url: 'https://api.example.com/mcp', name: 'custom' })).toBe('custom');
  });

  it('should strip a leading api. prefix and take the first label', () => {
    expect(dbxMcpConnectServerName(TEST_SERVER)).toBe('example');
  });

  it('should strip leading www. and mcp. prefixes', () => {
    expect(dbxMcpConnectServerName({ url: 'https://www.example.com/mcp' })).toBe('example');
    expect(dbxMcpConnectServerName({ url: 'https://mcp.example.com/mcp' })).toBe('example');
  });

  it('should use the hostname of a url without a prefix', () => {
    expect(dbxMcpConnectServerName({ url: 'https://example.com/mcp' })).toBe('example');
  });

  it('should return localhost for a localhost url', () => {
    expect(dbxMcpConnectServerName({ url: 'http://localhost:9901/mcp' })).toBe('localhost');
  });

  it('should return the default name for an invalid url', () => {
    expect(dbxMcpConnectServerName({ url: 'not a url' })).toBe(DEFAULT_DBX_MCP_CONNECT_SERVER_NAME);
  });
});

describe('dbxMcpConnectServerLabel()', () => {
  it('should return the configured label', () => {
    expect(dbxMcpConnectServerLabel({ ...TEST_SERVER, label: 'Example App' })).toBe('Example App');
  });

  it('should fall back to the server name', () => {
    expect(dbxMcpConnectServerLabel(TEST_SERVER)).toBe('example');
  });
});

describe('isConfidentialDbxMcpConnectOAuthClient()', () => {
  it('should be true when the client secret is set', () => {
    expect(isConfidentialDbxMcpConnectOAuthClient(TEST_OAUTH_CLIENT)).toBe(true);
  });

  it('should be false for a client without a secret', () => {
    expect(isConfidentialDbxMcpConnectOAuthClient(TEST_PUBLIC_OAUTH_CLIENT)).toBe(false);
  });

  it('should use confidential over the client secret', () => {
    expect(isConfidentialDbxMcpConnectOAuthClient(TEST_UNKNOWN_SECRET_OAUTH_CLIENT)).toBe(true);
    expect(isConfidentialDbxMcpConnectOAuthClient({ ...TEST_OAUTH_CLIENT, confidential: false })).toBe(false);
  });
});

describe('CLAUDE_DBX_MCP_CONNECT_CLIENT', () => {
  it('should ask for the client secret of a confidential client whose secret is not known', () => {
    const instructions = CLAUDE_DBX_MCP_CONNECT_CLIENT.instructions({ server: TEST_SERVER, oauthClient: TEST_UNKNOWN_SECRET_OAUTH_CLIENT });
    expect((instructions.steps ?? []).some((x) => x.includes('client ID and client secret'))).toBe(true);
    expect((instructions.steps ?? []).some((x) => x.includes('blank'))).toBe(false);
  });

  it('should not mention a client id without an OAuth client', () => {
    const instructions = CLAUDE_DBX_MCP_CONNECT_CLIENT.instructions({ server: TEST_SERVER });
    expect((instructions.steps ?? []).some((x) => x.includes('client ID'))).toBe(false);
  });

  it('should add a step for the client id and secret', () => {
    const instructions = CLAUDE_DBX_MCP_CONNECT_CLIENT.instructions({ server: TEST_SERVER, oauthClient: TEST_OAUTH_CLIENT });
    expect((instructions.steps ?? []).some((x) => x.includes('client ID and client secret'))).toBe(true);
  });
});

describe('CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT', () => {
  it('should build the claude mcp add command', () => {
    const instructions = CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT.instructions({ server: TEST_SERVER });
    expect(instructions.snippet?.text).toBe('claude mcp add --transport http example https://api.example.com/mcp');
  });

  it('should pass the client id and ask for the secret without putting it in the command', () => {
    const instructions = CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT.instructions({ server: TEST_SERVER, oauthClient: TEST_OAUTH_CLIENT });
    expect(instructions.snippet?.text).toBe('claude mcp add --transport http --client-id test-client-id --client-secret --callback-port 8080 example https://api.example.com/mcp');
    expect(instructions.snippet?.text).not.toContain('test-client-secret');
  });

  it('should ask for the secret of a confidential client whose secret is not known', () => {
    const instructions = CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT.instructions({ server: TEST_SERVER, oauthClient: TEST_UNKNOWN_SECRET_OAUTH_CLIENT });
    expect(instructions.snippet?.text).toContain('--client-secret');
  });

  it('should leave out --client-secret for a public client', () => {
    const instructions = CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT.instructions({ server: TEST_SERVER, oauthClient: TEST_PUBLIC_OAUTH_CLIENT });
    expect(instructions.snippet?.text).toBe('claude mcp add --transport http --client-id test-client-id --callback-port 8080 example https://api.example.com/mcp');
  });
});

describe('makeClaudeCodeDbxMcpConnectClient()', () => {
  it('should use the configured callback port', () => {
    const client = makeClaudeCodeDbxMcpConnectClient({ callbackPort: 3118 });
    const instructions = client.instructions({ server: TEST_SERVER, oauthClient: TEST_PUBLIC_OAUTH_CLIENT });
    expect(instructions.snippet?.text).toContain('--callback-port 3118');
  });
});

describe('CURSOR_DBX_MCP_CONNECT_CLIENT', () => {
  it('should offer the install deeplink without an OAuth client', () => {
    const instructions = CURSOR_DBX_MCP_CONNECT_CLIENT.instructions({ server: TEST_SERVER });
    expect(instructions.action?.url).toBe(cursorDbxMcpConnectInstallUrl(TEST_SERVER));
    expect(JSON.parse(instructions.snippet?.text as string)).toEqual({ mcpServers: { example: { url: TEST_SERVER.url } } });
  });

  it('should put the OAuth client in the auth object and leave out the deeplink', () => {
    const instructions = CURSOR_DBX_MCP_CONNECT_CLIENT.instructions({ server: TEST_SERVER, oauthClient: TEST_OAUTH_CLIENT });
    expect(instructions.action).toBeUndefined();
    expect(JSON.parse(instructions.snippet?.text as string)).toEqual({ mcpServers: { example: { url: TEST_SERVER.url, auth: { CLIENT_ID: 'test-client-id', CLIENT_SECRET: 'test-client-secret' } } } });
  });

  it('should put a placeholder for the secret of a confidential client whose secret is not known', () => {
    const instructions = CURSOR_DBX_MCP_CONNECT_CLIENT.instructions({ server: TEST_SERVER, oauthClient: TEST_UNKNOWN_SECRET_OAUTH_CLIENT });
    expect(JSON.parse(instructions.snippet?.text as string)).toEqual({ mcpServers: { example: { url: TEST_SERVER.url, auth: { CLIENT_ID: 'test-client-id', CLIENT_SECRET: DBX_MCP_CONNECT_CLIENT_SECRET_PLACEHOLDER } } } });
    expect(instructions.steps?.[0]).toContain(DBX_MCP_CONNECT_CLIENT_SECRET_PLACEHOLDER);
  });

  it('should leave out CLIENT_SECRET for a public client', () => {
    const instructions = CURSOR_DBX_MCP_CONNECT_CLIENT.instructions({ server: TEST_SERVER, oauthClient: TEST_PUBLIC_OAUTH_CLIENT });
    expect(JSON.parse(instructions.snippet?.text as string)).toEqual({ mcpServers: { example: { url: TEST_SERVER.url, auth: { CLIENT_ID: 'test-client-id' } } } });
  });
});

describe('VSCODE_DBX_MCP_CONNECT_CLIENT', () => {
  it('should put the client id in the oauth object and the secret in a step', () => {
    const instructions = VSCODE_DBX_MCP_CONNECT_CLIENT.instructions({ server: TEST_SERVER, oauthClient: TEST_OAUTH_CLIENT });
    expect(instructions.action).toBeUndefined();
    expect(instructions.snippet?.text).not.toContain('test-client-secret');
    expect(JSON.parse(instructions.snippet?.text as string)).toEqual({ servers: { example: { type: 'http', url: TEST_SERVER.url, oauth: { clientId: 'test-client-id' } } } });
    expect((instructions.steps ?? []).some((x) => x.includes('Set Client Secret'))).toBe(true);
  });

  it('should keep the secret step for a confidential client whose secret is not known', () => {
    const instructions = VSCODE_DBX_MCP_CONNECT_CLIENT.instructions({ server: TEST_SERVER, oauthClient: TEST_UNKNOWN_SECRET_OAUTH_CLIENT });
    expect((instructions.steps ?? []).some((x) => x.includes('Set Client Secret'))).toBe(true);
  });

  it('should skip the secret step for a public client', () => {
    const instructions = VSCODE_DBX_MCP_CONNECT_CLIENT.instructions({ server: TEST_SERVER, oauthClient: TEST_PUBLIC_OAUTH_CLIENT });
    expect((instructions.steps ?? []).some((x) => x.includes('Set Client Secret'))).toBe(false);
  });
});

describe('cursorDbxMcpConnectInstallUrl()', () => {
  it('should build a deeplink whose config decodes to the server url', () => {
    const url = new URL(cursorDbxMcpConnectInstallUrl(TEST_SERVER));

    expect(url.protocol).toBe('cursor:');
    expect(url.host).toBe('anysphere.cursor-deeplink');
    expect(url.pathname).toBe('/mcp/install');
    expect(url.searchParams.get('name')).toBe('example');

    const config = JSON.parse(atob(url.searchParams.get('config') as string));
    expect(config).toEqual({ url: TEST_SERVER.url });
  });
});

describe('vscodeDbxMcpConnectInstallUrl()', () => {
  it('should build an install url whose config decodes to the server config', () => {
    const prefix = 'vscode:mcp/install?';
    const url = vscodeDbxMcpConnectInstallUrl(TEST_SERVER);

    expect(url.startsWith(prefix)).toBe(true);

    const config = JSON.parse(decodeURIComponent(url.slice(prefix.length)));
    expect(config).toEqual({ name: 'example', type: 'http', url: TEST_SERVER.url });
  });
});

describe('DEFAULT_DBX_MCP_CONNECT_CLIENTS', () => {
  it('should have unique ids', () => {
    const ids = DEFAULT_DBX_MCP_CONNECT_CLIENTS.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should not include Grok', () => {
    expect(DEFAULT_DBX_MCP_CONNECT_CLIENTS).not.toContain(GROK_DBX_MCP_CONNECT_CLIENT);
  });

  it('should produce at least one step for every client', () => {
    [...DEFAULT_DBX_MCP_CONNECT_CLIENTS, GROK_DBX_MCP_CONNECT_CLIENT].forEach((client) => {
      expect(client.instructions({ server: TEST_SERVER }).steps?.length).toBeGreaterThan(0);
      expect(client.instructions({ server: TEST_SERVER, oauthClient: TEST_OAUTH_CLIENT }).steps?.length).toBeGreaterThan(0);
    });
  });
});
