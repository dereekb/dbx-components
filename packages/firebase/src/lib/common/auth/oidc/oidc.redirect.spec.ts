import { describe, it, expect } from 'vitest';
import { CLAUDE_MCP_CLIENT_OIDC_REDIRECT_URIS, oidcClientApplicationTypeForRedirectUris } from './oidc.redirect';

describe('oidcClientApplicationTypeForRedirectUris()', () => {
  it('should return web when every redirect URI is http or https', () => {
    expect(oidcClientApplicationTypeForRedirectUris([...CLAUDE_MCP_CLIENT_OIDC_REDIRECT_URIS, 'http://localhost:8080/callback'])).toBe('web');
  });

  it('should return native when any redirect URI uses a custom scheme', () => {
    expect(oidcClientApplicationTypeForRedirectUris([...CLAUDE_MCP_CLIENT_OIDC_REDIRECT_URIS, 'cursor://anysphere.cursor-mcp/oauth/callback'])).toBe('native');
  });
});
