import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_OIDC_MCP_PATH, DbxFirebaseOidcConfig, DbxFirebaseOidcConfigService } from './oidc.configuration.service';

describe('DbxFirebaseOidcConfigService', () => {
  function configService(config: Partial<DbxFirebaseOidcConfig>): DbxFirebaseOidcConfigService {
    TestBed.configureTestingModule({
      providers: [{ provide: DbxFirebaseOidcConfig, useValue: { availableScopes: [], ...config } }, DbxFirebaseOidcConfigService]
    });

    return TestBed.inject(DbxFirebaseOidcConfigService);
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('mcpUrl', () => {
    it('should return the configured mcpUrl', () => {
      const mcpUrl = 'http://localhost:9901/mcp';
      expect(configService({ mcpUrl, oidcApiOrigin: 'https://api.example.com' }).mcpUrl).toBe(mcpUrl);
    });

    it('should append the default MCP path to the oidcApiOrigin', () => {
      expect(configService({ oidcApiOrigin: 'https://api.example.com' }).mcpUrl).toBe(`https://api.example.com${DEFAULT_OIDC_MCP_PATH}`);
    });

    it('should append the default MCP path to the page origin when no oidcApiOrigin is configured', () => {
      const service = configService({});
      const pageOrigin = TestBed.inject(DOCUMENT).location.origin;
      expect(service.mcpUrl).toBe(`${pageOrigin}${DEFAULT_OIDC_MCP_PATH}`);
    });
  });

  describe('mcpOAuthClient', () => {
    it('should return the configured mcpOAuthClient', () => {
      const mcpOAuthClient = { clientId: 'test-client-id' };
      expect(configService({ mcpOAuthClient }).mcpOAuthClient).toEqual(mcpOAuthClient);
    });

    it('should return undefined when no mcpOAuthClient is configured', () => {
      expect(configService({}).mcpOAuthClient).toBeUndefined();
    });
  });
});
