import { describe, expect, it } from 'vitest';
import { bearerChallengeErrorForCode, buildBearerChallenge, readBearerToken } from './bearer.challenge';

const RESOURCE_METADATA_URL = 'https://db.dereekb.test/.well-known/oauth-protected-resource/mcp';

describe('buildBearerChallenge()', () => {
  it('should emit the error token alone when nothing else is configured', () => {
    expect(buildBearerChallenge({ error: 'invalid_token' })).toBe('Bearer error="invalid_token"');
  });

  it('should emit resource_metadata ahead of the error token', () => {
    expect(buildBearerChallenge({ error: 'invalid_request', resourceMetadataUrl: RESOURCE_METADATA_URL })).toBe(`Bearer resource_metadata="${RESOURCE_METADATA_URL}", error="invalid_request"`);
  });

  it('should emit the realm first when configured', () => {
    expect(buildBearerChallenge({ error: 'invalid_token', realm: 'dereekb-db' })).toBe('Bearer realm="dereekb-db", error="invalid_token"');
  });

  it('should emit the scope and description params when configured', () => {
    expect(buildBearerChallenge({ error: 'insufficient_scope', scope: 'openid profile', errorDescription: 'nope' })).toBe('Bearer error="insufficient_scope", error_description="nope", scope="openid profile"');
  });
});

describe('bearerChallengeErrorForCode()', () => {
  it('should select invalid_request when no token was presented', () => {
    expect(bearerChallengeErrorForCode({ code: 'unauthorized', hadToken: false })).toBe('invalid_request');
  });

  it('should select invalid_token when a token was presented but failed', () => {
    expect(bearerChallengeErrorForCode({ code: 'unauthorized', hadToken: true })).toBe('invalid_token');
  });

  it('should select insufficient_scope for a policy failure', () => {
    expect(bearerChallengeErrorForCode({ code: 'forbidden', hadToken: true })).toBe('insufficient_scope');
  });
});

describe('readBearerToken()', () => {
  it('should read the token out of a Bearer header', () => {
    expect(readBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('should return undefined for a missing, empty, or non-Bearer header', () => {
    expect(readBearerToken(undefined)).toBeUndefined();
    expect(readBearerToken(null)).toBeUndefined();
    expect(readBearerToken('Bearer   ')).toBeUndefined();
    expect(readBearerToken('Basic abc')).toBeUndefined();
  });
});
