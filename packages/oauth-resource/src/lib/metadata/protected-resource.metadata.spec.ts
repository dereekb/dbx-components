import { describe, expect, it } from 'vitest';
import { buildProtectedResourceMetadata, OAUTH_PROTECTED_RESOURCE_PATH, oauthProtectedResourcePathForResource } from './protected-resource.metadata';

const RESOURCE = 'https://db.dereekb.test/mcp';
const ISSUER = 'https://api.dereekb.test/oidc';

describe('buildProtectedResourceMetadata()', () => {
  it('should build the RFC 9728 document', () => {
    const document = buildProtectedResourceMetadata({ resource: RESOURCE, authorizationServers: [ISSUER], scopesSupported: ['openid', 'profile'] });

    expect(document).toEqual({
      resource: RESOURCE,
      authorization_servers: [ISSUER],
      scopes_supported: ['openid', 'profile'],
      bearer_methods_supported: ['header']
    });
  });

  it('should omit the optional descriptive fields when not configured', () => {
    const document = buildProtectedResourceMetadata({ resource: RESOURCE, authorizationServers: [ISSUER] });

    expect(document.scopes_supported).toEqual([]);
    expect(document).not.toHaveProperty('resource_name');
    expect(document).not.toHaveProperty('resource_documentation');
  });

  it('should carry the descriptive fields when configured', () => {
    const document = buildProtectedResourceMetadata({ resource: RESOURCE, authorizationServers: [ISSUER], resourceName: 'db', resourceDocumentation: 'https://docs.dereekb.test' });

    expect(document.resource_name).toBe('db');
    expect(document.resource_documentation).toBe('https://docs.dereekb.test');
  });
});

describe('oauthProtectedResourcePathForResource()', () => {
  it('should build the RFC 9728 path-suffixed well-known path', () => {
    expect(oauthProtectedResourcePathForResource('/mcp')).toBe(`${OAUTH_PROTECTED_RESOURCE_PATH}/mcp`);
    expect(oauthProtectedResourcePathForResource('mcp/')).toBe(`${OAUTH_PROTECTED_RESOURCE_PATH}/mcp`);
  });

  it('should return the bare path for a root resource', () => {
    expect(oauthProtectedResourcePathForResource('/')).toBe(OAUTH_PROTECTED_RESOURCE_PATH);
  });
});
