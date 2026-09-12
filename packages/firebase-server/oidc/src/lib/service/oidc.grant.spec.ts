import { describe, it, expect } from 'vitest';
import { type Grant } from 'oidc-provider';
import { reconsiderRejectedValues, requestedOIDCClaimNames, requestedResourceIndicators, unrejectOIDCClaims, unrejectOIDCScopes, unrejectResourceScopes } from './oidc.grant';

/**
 * A Grant's persisted `rejected` shape is plain data; the helpers only touch that, so a bare object
 * carrying it stands in for a Grant.
 */
function grantWithRejected(rejected: Grant['rejected']): Grant {
  return { rejected } as Grant;
}

describe('unrejectOIDCScopes()', () => {
  it('should remove the named scopes from the rejected set', () => {
    const grant = grantWithRejected({ openid: { scope: 'email session.firestore demo' } });
    unrejectOIDCScopes(grant, ['session.firestore']);
    expect(grant.rejected?.openid?.scope).toBe('email demo');
  });

  it('should clear the rejected scope string when nothing remains', () => {
    const grant = grantWithRejected({ openid: { scope: 'session.firestore' } });
    unrejectOIDCScopes(grant, ['session.firestore']);
    expect(grant.rejected?.openid?.scope).toBeUndefined();
  });

  it('should ignore scopes that are not rejected', () => {
    const grant = grantWithRejected({ openid: { scope: 'email' } });
    unrejectOIDCScopes(grant, ['profile']);
    expect(grant.rejected?.openid?.scope).toBe('email');
  });

  it('should be a no-op on a grant with no rejections', () => {
    const grant = grantWithRejected(undefined);
    unrejectOIDCScopes(grant, ['email']);
    expect(grant.rejected).toBeUndefined();
  });
});

describe('unrejectOIDCClaims()', () => {
  it('should remove the named claims from the rejected set', () => {
    const grant = grantWithRejected({ openid: { claims: ['email', 'name'] } });
    unrejectOIDCClaims(grant, ['name']);
    expect(grant.rejected?.openid?.claims).toEqual(['email']);
  });

  it('should clear the rejected claims when nothing remains', () => {
    const grant = grantWithRejected({ openid: { claims: ['name'] } });
    unrejectOIDCClaims(grant, ['name']);
    expect(grant.rejected?.openid?.claims).toBeUndefined();
  });
});

describe('unrejectResourceScopes()', () => {
  it('should remove the named scopes for the resource only', () => {
    const grant = grantWithRejected({ resources: { 'https://a': 'read write', 'https://b': 'read' } });
    unrejectResourceScopes(grant, 'https://a', ['write']);
    expect(grant.rejected?.resources).toEqual({ 'https://a': 'read', 'https://b': 'read' });
  });

  it('should drop the resource entry when nothing remains', () => {
    const grant = grantWithRejected({ resources: { 'https://a': 'read' } });
    unrejectResourceScopes(grant, 'https://a', ['read']);
    expect(grant.rejected?.resources).toEqual({});
  });
});

describe('reconsiderRejectedValues()', () => {
  it('should move a rejected value the request names again into missing', () => {
    const result = reconsiderRejectedValues({
      missing: ['demo'],
      encountered: ['openid', 'profile', 'session.firestore'],
      rejected: ['session.firestore'],
      requested: new Set(['openid', 'profile', 'demo', 'session.firestore'])
    });

    expect(result.missing).toEqual(['demo', 'session.firestore']);
    expect(result.encountered).toEqual(['openid', 'profile']);
    expect(result.reconsidered).toEqual(['session.firestore']);
  });

  it('should leave a rejected value the request does not name in encountered', () => {
    // a rejection from an earlier, wider request stays in force
    const result = reconsiderRejectedValues({
      missing: [],
      encountered: ['openid', 'lms'],
      rejected: ['lms'],
      requested: new Set(['openid', 'profile'])
    });

    expect(result.missing).toEqual([]);
    expect(result.encountered).toEqual(['openid', 'lms']);
    expect(result.reconsidered).toEqual([]);
  });

  it('should leave granted values in encountered', () => {
    const result = reconsiderRejectedValues({
      missing: [],
      encountered: ['openid', 'profile'],
      rejected: [],
      requested: new Set(['openid', 'profile'])
    });

    expect(result.missing).toEqual([]);
    expect(result.encountered).toEqual(['openid', 'profile']);
    expect(result.reconsidered).toEqual([]);
  });

  it('should not duplicate a value already in missing', () => {
    const result = reconsiderRejectedValues({
      missing: ['email'],
      encountered: ['email'],
      rejected: ['email'],
      requested: new Set(['email'])
    });

    expect(result.missing).toEqual(['email']);
    expect(result.reconsidered).toEqual([]);
  });
});

describe('requestedOIDCClaimNames()', () => {
  it('should name the claims across id_token and userinfo', () => {
    const names = requestedOIDCClaimNames(JSON.stringify({ id_token: { email: null, name: { essential: true } }, userinfo: { picture: null } }));
    expect(Array.from(names).sort()).toEqual(['email', 'name', 'picture']);
  });

  it('should return an empty set for a missing or malformed parameter', () => {
    expect(requestedOIDCClaimNames(undefined).size).toBe(0);
    expect(requestedOIDCClaimNames('').size).toBe(0);
    expect(requestedOIDCClaimNames('{not json').size).toBe(0);
    expect(requestedOIDCClaimNames('[]').size).toBe(0);
  });
});

describe('requestedResourceIndicators()', () => {
  it('should normalize a string, an array, and an absent parameter', () => {
    expect(requestedResourceIndicators('https://a')).toEqual(['https://a']);
    expect(requestedResourceIndicators(['https://a', 'https://b'])).toEqual(['https://a', 'https://b']);
    expect(requestedResourceIndicators(undefined)).toEqual([]);
  });

  it('should drop non-string array entries', () => {
    expect(requestedResourceIndicators(['https://a', 1, null])).toEqual(['https://a']);
  });
});
