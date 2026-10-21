import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT, CLAUDE_DBX_MCP_CONNECT_CLIENT, DBX_MCP_CONNECT_SERVER, DEFAULT_DBX_MCP_CONNECT_CLIENTS, type DbxMcpConnectClient, GROK_DBX_MCP_CONNECT_CLIENT } from './mcp.connect';
import { DbxMcpConnectService } from './mcp.connect.service';
import { provideDbxMcpConnectService, type ProvideDbxMcpConnectServiceConfig } from './mcp.connect.providers';

describe('DbxMcpConnectService', () => {
  function mcpConnectService(config?: ProvideDbxMcpConnectServiceConfig): DbxMcpConnectService {
    TestBed.configureTestingModule({
      providers: [provideDbxMcpConnectService(config)]
    });

    return TestBed.inject(DbxMcpConnectService);
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should default to the default clients', () => {
    const service = mcpConnectService();
    expect(service.clientsSignal()).toBe(DEFAULT_DBX_MCP_CONNECT_CLIENTS);
    expect(service.defaultClientIdSignal()).toBeUndefined();
  });

  it('should start from the configured clients and default client id', () => {
    const service = mcpConnectService({ clients: [CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT, GROK_DBX_MCP_CONNECT_CLIENT], defaultClientId: 'grok' });
    expect(service.clientsSignal()).toEqual([CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT, GROK_DBX_MCP_CONNECT_CLIENT]);
    expect(service.defaultClientIdSignal()).toBe('grok');
  });

  it('should provide the configured server', () => {
    const server = { url: 'https://api.example.com/mcp' };
    mcpConnectService({ server });
    expect(TestBed.inject(DBX_MCP_CONNECT_SERVER)).toBe(server);
  });

  describe('registerClients()', () => {
    it('should add a new client to the end', () => {
      const service = mcpConnectService({ clients: [CLAUDE_DBX_MCP_CONNECT_CLIENT] });
      service.registerClients(GROK_DBX_MCP_CONNECT_CLIENT);
      expect(service.clientsSignal()).toEqual([CLAUDE_DBX_MCP_CONNECT_CLIENT, GROK_DBX_MCP_CONNECT_CLIENT]);
    });

    it('should replace a client with the same id in place', () => {
      const service = mcpConnectService({ clients: [CLAUDE_DBX_MCP_CONNECT_CLIENT, GROK_DBX_MCP_CONNECT_CLIENT] });
      const customClaude: DbxMcpConnectClient = { ...CLAUDE_DBX_MCP_CONNECT_CLIENT, label: 'Claude (custom)' };
      service.registerClients([customClaude]);
      expect(service.clientsSignal()).toEqual([customClaude, GROK_DBX_MCP_CONNECT_CLIENT]);
    });
  });

  it('should remove clients with unregisterClients()', () => {
    const service = mcpConnectService({ clients: [CLAUDE_DBX_MCP_CONNECT_CLIENT, CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT, GROK_DBX_MCP_CONNECT_CLIENT] });
    service.unregisterClients(['claude', 'grok']);
    expect(service.clientsSignal()).toEqual([CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT]);
  });

  it('should replace the clients with setClients()', () => {
    const service = mcpConnectService();
    service.setClients([GROK_DBX_MCP_CONNECT_CLIENT]);
    expect(service.clientsSignal()).toEqual([GROK_DBX_MCP_CONNECT_CLIENT]);
  });

  it('should change the default client id with setDefaultClientId()', () => {
    const service = mcpConnectService();
    service.setDefaultClientId('cursor');
    expect(service.defaultClientIdSignal()).toBe('cursor');
  });
});
