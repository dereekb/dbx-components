import { describe, expect, it } from 'vitest';
import { CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT, cursorDbxMcpConnectInstallUrl, DEFAULT_DBX_MCP_CONNECT_CLIENTS, DEFAULT_DBX_MCP_CONNECT_SERVER_NAME, type DbxMcpConnectServer, dbxMcpConnectServerLabel, dbxMcpConnectServerName, GROK_DBX_MCP_CONNECT_CLIENT, vscodeDbxMcpConnectInstallUrl } from './mcp.connect';

const TEST_SERVER: DbxMcpConnectServer = { url: 'https://api.example.com/mcp' };

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

describe('CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT', () => {
  it('should build the claude mcp add command', () => {
    const instructions = CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT.instructions(TEST_SERVER);
    expect(instructions.snippet?.text).toBe('claude mcp add --transport http example https://api.example.com/mcp');
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
      expect(client.instructions(TEST_SERVER).steps.length).toBeGreaterThan(0);
    });
  });
});
