import { describe, expect, it } from 'vitest';
import { microsoftGraphScopesFromScopeString, normalizeMicrosoftGraphScope, normalizeMicrosoftGraphScopes } from './oauth.scope';

describe('normalizeMicrosoftGraphScope()', () => {
  it('strips the graph resource prefix', () => {
    expect(normalizeMicrosoftGraphScope('https://graph.microsoft.com/Mail.Read')).toBe('Mail.Read');
  });

  it('maps a known scope to its canonical casing', () => {
    expect(normalizeMicrosoftGraphScope('mail.readwrite')).toBe('Mail.ReadWrite');
    expect(normalizeMicrosoftGraphScope('HTTPS://GRAPH.MICROSOFT.COM/files.read.all')).toBe('Files.Read.All');
  });

  it('keeps an unknown scope as given', () => {
    expect(normalizeMicrosoftGraphScope('Custom.Scope')).toBe('Custom.Scope');
  });
});

describe('normalizeMicrosoftGraphScopes()', () => {
  it('dedupes after normalising, keeping first-seen order', () => {
    expect(normalizeMicrosoftGraphScopes(['mail.read', 'User.Read', 'https://graph.microsoft.com/Mail.Read', ''])).toEqual(['Mail.Read', 'User.Read']);
  });
});

describe('microsoftGraphScopesFromScopeString()', () => {
  it('normalises, drops the OIDC scopes and dedupes', () => {
    expect(microsoftGraphScopesFromScopeString('https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Read openid profile email offline_access mail.read')).toEqual(['User.Read', 'Mail.Read']);
  });

  it('returns an empty list for no scope string', () => {
    expect(microsoftGraphScopesFromScopeString(undefined)).toEqual([]);
  });
});
