import { describe, it, expect } from 'vitest';
import { CLAUDE_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTION, KNOWN_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTIONS } from '@dereekb/firebase';
import { oidcClientRedirectUrisForgeField } from './oidcentry.forge.form';

describe('oidcClientRedirectUrisForgeField()', () => {
  it('should not set suggestions when no redirect URI suggestions are configured', () => {
    const field = oidcClientRedirectUrisForgeField() as any;
    expect(field.props?.suggestions).toBeUndefined();
  });

  it('should map each redirect URI suggestion to a suggestion chip that adds all of its redirect URIs', () => {
    const field = oidcClientRedirectUrisForgeField({ redirectUriSuggestions: [...KNOWN_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTIONS] }) as any;
    const suggestions = field.props?.suggestions;

    expect(suggestions.map((x: { label: string }) => x.label)).toEqual(['Claude', 'ChatGPT', 'Grok']);
    expect(suggestions[0].value).toEqual(CLAUDE_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTION.redirectUris);
    expect(suggestions[0].tooltip).toContain(CLAUDE_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTION.redirectUris[0]);
  });
});
