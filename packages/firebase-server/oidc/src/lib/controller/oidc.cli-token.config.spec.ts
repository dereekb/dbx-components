import { describe, expect, it } from 'vitest';
import { CLI_TOKEN_OIDC_SCOPE, FIRESTORE_SESSION_OIDC_SCOPE, OFFLINE_ACCESS_OIDC_SCOPE, SERVICE_TOKEN_OIDC_SCOPE, type OidcScope } from '@dereekb/firebase';
import { DEFAULT_CLI_TOKEN_TTL_SECONDS, MAX_CLI_TOKEN_TTL_SECONDS, resolveCliTokenScopes, resolveCliTokenTtlSeconds } from './oidc.cli-token.config';

function scopeSet(...scopes: string[]): ReadonlySet<OidcScope> {
  return new Set(scopes);
}

function granted(result: string): Set<string> {
  return new Set(result.split(' ').filter((value) => value.length > 0));
}

describe('resolveCliTokenScopes()', () => {
  it('inherits the caller’s scopes and always adds offline_access', () => {
    const result = granted(resolveCliTokenScopes({ callerScopes: scopeSet('openid', 'demo', 'model.read') }));

    expect(result).toEqual(new Set(['openid', 'demo', 'model.read', OFFLINE_ACCESS_OIDC_SCOPE]));
  });

  it('inherits session.firestore like any other scope', () => {
    // decided deliberately: only the two scopes that would let a 1h credential manufacture a
    // longer-lived or further-minting one are denied
    const result = granted(resolveCliTokenScopes({ callerScopes: scopeSet('openid', FIRESTORE_SESSION_OIDC_SCOPE) }));

    expect(result.has(FIRESTORE_SESSION_OIDC_SCOPE)).toBe(true);
  });

  it('always strips token.cli and token.service, even when the caller holds them', () => {
    const result = granted(resolveCliTokenScopes({ callerScopes: scopeSet('openid', CLI_TOKEN_OIDC_SCOPE, SERVICE_TOKEN_OIDC_SCOPE) }));

    expect(result.has(CLI_TOKEN_OIDC_SCOPE)).toBe(false);
    expect(result.has(SERVICE_TOKEN_OIDC_SCOPE)).toBe(false);
    expect(result.has('openid')).toBe(true);
  });

  it('strips them even when they are explicitly REQUESTED', () => {
    const result = granted(
      resolveCliTokenScopes({
        callerScopes: scopeSet('openid', CLI_TOKEN_OIDC_SCOPE, SERVICE_TOKEN_OIDC_SCOPE),
        requestedScopes: [CLI_TOKEN_OIDC_SCOPE, SERVICE_TOKEN_OIDC_SCOPE, 'openid']
      })
    );

    expect(result).toEqual(new Set(['openid', OFFLINE_ACCESS_OIDC_SCOPE]));
  });

  it('narrows to the requested subset', () => {
    const result = granted(resolveCliTokenScopes({ callerScopes: scopeSet('openid', 'demo', 'model.read', 'model.create'), requestedScopes: ['model.read'] }));

    expect(result).toEqual(new Set(['model.read', OFFLINE_ACCESS_OIDC_SCOPE]));
  });

  it('never WIDENS — a requested scope the caller does not hold is dropped', () => {
    const result = granted(resolveCliTokenScopes({ callerScopes: scopeSet('model.read'), requestedScopes: ['model.read', 'model.delete', 'lms'] }));

    expect(result).toEqual(new Set(['model.read', OFFLINE_ACCESS_OIDC_SCOPE]));
  });

  it('yields only offline_access for a caller with no resolvable scopes', () => {
    // a non-OIDC caller carries no `scope` claim at all; the endpoint's admin predicate is what
    // actually gates them, and the minted grant is then as narrow as it can be
    expect(granted(resolveCliTokenScopes({ callerScopes: undefined }))).toEqual(new Set([OFFLINE_ACCESS_OIDC_SCOPE]));
  });
});

describe('resolveCliTokenTtlSeconds()', () => {
  it('defaults when nothing is requested', () => {
    expect(resolveCliTokenTtlSeconds({})).toBe(DEFAULT_CLI_TOKEN_TTL_SECONDS);
    expect(resolveCliTokenTtlSeconds({ defaultTtlSeconds: 900 })).toBe(900);
  });

  it('clamps a request above the one-hour ceiling', () => {
    expect(resolveCliTokenTtlSeconds({ requestedTtlSeconds: 60 * 60 * 24 })).toBe(MAX_CLI_TOKEN_TTL_SECONDS);
  });

  it('clamps to the parent grant’s remaining life — a child never outlives its parent', () => {
    expect(resolveCliTokenTtlSeconds({ requestedTtlSeconds: MAX_CLI_TOKEN_TTL_SECONDS, parentRemainingSeconds: 600 })).toBe(600);
  });

  it('honours a shorter request', () => {
    expect(resolveCliTokenTtlSeconds({ requestedTtlSeconds: 120 })).toBe(120);
  });

  it('ignores a non-positive request and an unknown parent lifetime', () => {
    expect(resolveCliTokenTtlSeconds({ requestedTtlSeconds: 0, defaultTtlSeconds: 300 })).toBe(300);
    expect(resolveCliTokenTtlSeconds({ requestedTtlSeconds: 300, parentRemainingSeconds: undefined })).toBe(300);
    // an already-expired parent would otherwise clamp to zero and mint an instantly-dead credential;
    // the caller's own token had to verify to get here at all
    expect(resolveCliTokenTtlSeconds({ requestedTtlSeconds: 300, parentRemainingSeconds: -10 })).toBe(300);
  });

  it('never returns less than one second', () => {
    expect(resolveCliTokenTtlSeconds({ requestedTtlSeconds: 300, parentRemainingSeconds: 0.2 })).toBe(1);
  });
});
