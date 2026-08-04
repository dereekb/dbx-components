import { describe, expect, it } from 'vitest';
import { FetchResponseError, type ConfiguredFetch } from '@dereekb/util/fetch';
import { DISCORD_OAUTH_INVALID_GRANT_ERROR_CODE, DiscordOAuthFetchResponseError, handleDiscordOAuthErrorFetch, parseDiscordOAuthError } from './oauth.error.api';

function errorResponseError(body: unknown, status = 400): FetchResponseError {
  return new FetchResponseError(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

/**
 * A fetch that always fails the way the ok-response check does — the only path
 * handleDiscordOAuthErrorFetch reacts to.
 */
function throwingFetch(error: unknown): ConfiguredFetch {
  return async () => {
    throw error;
  };
}

describe('parseDiscordOAuthError()', () => {
  it('should parse the RFC 6749 error shape Discord returns', async () => {
    const error = await parseDiscordOAuthError(errorResponseError({ error: DISCORD_OAUTH_INVALID_GRANT_ERROR_CODE, error_description: 'Invalid "code" in request.' }));

    expect(error).toBeInstanceOf(DiscordOAuthFetchResponseError);
    expect(error?.code).toBe(DISCORD_OAUTH_INVALID_GRANT_ERROR_CODE);
    expect(error?.message).toContain('Invalid "code" in request.');
  });

  it('should leave a body carrying no oauth error unparsed', async () => {
    // Discord's REST errors use code/message, which is a different shape this must not claim
    expect(await parseDiscordOAuthError(errorResponseError({ code: 50035, message: 'Invalid Form Body' }))).toBeUndefined();
  });

  it('should leave a non-json body unparsed', async () => {
    expect(await parseDiscordOAuthError(new FetchResponseError(new Response('<html>502</html>', { status: 502 })))).toBeUndefined();
  });

  it('should not consume the response body', async () => {
    // the response is cloned before reading, so a caller can still inspect it after parsing
    const responseError = errorResponseError({ error: 'invalid_scope' });
    await parseDiscordOAuthError(responseError);

    expect(responseError.response.bodyUsed).toBe(false);
  });
});

describe('handleDiscordOAuthErrorFetch()', () => {
  it('should replace a parseable response error with the typed oauth error', async () => {
    const fetch = handleDiscordOAuthErrorFetch(throwingFetch(errorResponseError({ error: DISCORD_OAUTH_INVALID_GRANT_ERROR_CODE })), () => undefined);

    await expect(fetch('/oauth2/token')).rejects.toBeInstanceOf(DiscordOAuthFetchResponseError);
  });

  it('should rethrow a response error it could not parse', async () => {
    const responseError = errorResponseError({ code: 0, message: 'nope' });
    const fetch = handleDiscordOAuthErrorFetch(throwingFetch(responseError), () => undefined);

    await expect(fetch('/oauth2/token')).rejects.toBe(responseError);
  });

  it('should rethrow an error that is not a response error at all', async () => {
    const error = new Error('socket hang up');
    const fetch = handleDiscordOAuthErrorFetch(throwingFetch(error), () => undefined);

    await expect(fetch('/oauth2/token')).rejects.toBe(error);
  });

  it('should log the error before throwing it', async () => {
    const logged: unknown[] = [];
    const fetch = handleDiscordOAuthErrorFetch(throwingFetch(errorResponseError({ error: 'invalid_scope' })), (error) => logged.push(error));

    await expect(fetch('/oauth2/token')).rejects.toBeInstanceOf(DiscordOAuthFetchResponseError);
    expect(logged).toHaveLength(1);
  });
});
