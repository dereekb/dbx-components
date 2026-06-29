import { describe, it, expect, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { type Maybe, inMemoryAsyncValueCache } from '@dereekb/util';
import { type OidcRelyingPartyFetch, type OidcTokenState } from '@dereekb/util/oidc';
import { type OidcLoginTransaction, oidcBrowserClient } from './oidc.client';
import { webStorageValueCache } from './oidc.storage';

const ISSUER = 'https://api.example.com/oidc';
const DISCOVERY = { issuer: ISSUER, authorization_endpoint: `${ISSUER}/auth`, token_endpoint: `${ISSUER}/token`, userinfo_endpoint: `${ISSUER}/me` };

function makeJwt(payload: Record<string, unknown>): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function urlOf(input: RequestInfo | URL): string {
  let result: string;

  if (typeof input === 'string') {
    result = input;
  } else if (input instanceof URL) {
    result = input.toString();
  } else {
    result = input.url;
  }

  return result;
}

/**
 * Mock fetch transport that answers discovery + token-endpoint calls and records API requests.
 */
function makeTransport(): { transport: OidcRelyingPartyFetch; apiRequests: Request[] } {
  const apiRequests: Request[] = [];
  const transport = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = urlOf(input);
    let response: Response;

    if (url.includes('.well-known/openid-configuration')) {
      response = jsonResponse(DISCOVERY);
    } else if (url === DISCOVERY.token_endpoint) {
      response = jsonResponse({ access_token: 'at-1', refresh_token: 'rt-1', id_token: makeJwt({ sub: 'user-1', email: 'a@b.co' }), token_type: 'Bearer', expires_in: 3600 });
    } else if (url.startsWith('https://api.example.com/api/')) {
      apiRequests.push(input as Request);
      response = jsonResponse({ ok: true });
    } else {
      response = new Response('', { status: 404 });
    }

    return response;
  });

  return { transport: transport as unknown as OidcRelyingPartyFetch, apiRequests };
}

describe('webStorageValueCache()', () => {
  function mockStorage(): Storage {
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      removeItem: (key: string) => void map.delete(key),
      clear: () => map.clear(),
      key: () => null,
      get length() {
        return map.size;
      }
    } as Storage;
  }

  it('round-trips a JSON value', async () => {
    const cache = webStorageValueCache<{ a: number }>({ storage: mockStorage(), key: 'k' });
    expect(await cache.load()).toBeUndefined();
    await cache.update({ a: 1 });
    expect(await cache.load()).toEqual({ a: 1 });
    await cache.clear();
    expect(await cache.load()).toBeUndefined();
  });

  it('treats a corrupt stored value as absent', async () => {
    const storage = mockStorage();
    storage.setItem('k', '{not json');
    const cache = webStorageValueCache<{ a: number }>({ storage, key: 'k' });
    expect(await cache.load()).toBeUndefined();
  });
});

describe('oidcBrowserClient()', () => {
  function setup() {
    const { transport, apiRequests } = makeTransport();
    let navigatedTo: Maybe<string>;
    const tokenStorage = inMemoryAsyncValueCache<OidcTokenState>();
    const transactionStorage = inMemoryAsyncValueCache<OidcLoginTransaction>();

    const client = oidcBrowserClient({
      issuer: ISSUER,
      clientId: 'cid',
      redirectUri: 'https://app.example.com/callback',
      scopes: 'openid email offline_access',
      tokenStorage,
      transactionStorage,
      fetch: transport,
      now: () => 1_000_000,
      navigate: (url) => {
        navigatedTo = url;
      },
      getCurrentUrl: () => 'unused'
    });

    return { client, transport, apiRequests, tokenStorage, transactionStorage, getNavigatedTo: () => navigatedTo };
  }

  it('starts login by persisting a transaction and navigating to the authorization URL', async () => {
    const { client, transactionStorage, getNavigatedTo } = setup();

    await client.startLogin({ returnTo: '/dashboard' });

    const navigatedTo = getNavigatedTo();
    expect(navigatedTo).toBeDefined();
    const parsed = new URL(navigatedTo as string);
    expect(parsed.origin + parsed.pathname).toBe(`${ISSUER}/auth`);
    expect(parsed.searchParams.get('client_id')).toBe('cid');
    expect(parsed.searchParams.get('code_challenge')).toBeTruthy();
    expect(parsed.searchParams.get('prompt')).toBe('consent'); // offline_access ⇒ consent

    const transaction = await transactionStorage.load();
    expect(transaction?.state).toBe(parsed.searchParams.get('state'));
    expect(transaction?.returnTo).toBe('/dashboard');
    expect(transaction?.codeVerifier).toBeTruthy();
  });

  it('handles the redirect callback: validates state, exchanges the code, and logs in', async () => {
    const { client, tokenStorage, getNavigatedTo } = setup();
    const authStates: boolean[] = [];
    client.authState$.subscribe((s) => authStates.push(s.loggedIn));

    await client.startLogin();
    const state = new URL(getNavigatedTo() as string).searchParams.get('state');

    const result = await client.handleRedirectCallback(`https://app.example.com/callback?code=the-code&state=${state}`);

    expect(result.claims).toEqual({ sub: 'user-1', email: 'a@b.co' });
    expect((await tokenStorage.load())?.accessToken).toBe('at-1');
    expect(authStates.at(-1)).toBe(true);

    const authState = await firstValueFrom(client.authState$);
    expect(authState.loggedIn).toBe(true);
    expect(authState.claims).toMatchObject({ sub: 'user-1' });
  });

  it('rejects a redirect with a mismatched state', async () => {
    const { client, getNavigatedTo } = setup();
    await client.startLogin();
    void getNavigatedTo();

    await expect(client.handleRedirectCallback('https://app.example.com/callback?code=x&state=tampered')).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it('attaches a Bearer token to apiFetch requests', async () => {
    const { client, apiRequests, getNavigatedTo } = setup();
    await client.startLogin();
    const state = new URL(getNavigatedTo() as string).searchParams.get('state');
    await client.handleRedirectCallback(`https://app.example.com/callback?code=c&state=${state}`);

    await client.apiFetch('https://api.example.com/api/model/guestbook/get');

    expect(apiRequests).toHaveLength(1);
    expect(apiRequests[0].headers.get('Authorization')).toBe('Bearer at-1');
  });

  it('logout clears tokens and flips authState to logged out', async () => {
    const { client, tokenStorage, getNavigatedTo } = setup();
    await client.startLogin();
    const state = new URL(getNavigatedTo() as string).searchParams.get('state');
    await client.handleRedirectCallback(`https://app.example.com/callback?code=c&state=${state}`);

    await client.logout();

    expect(await tokenStorage.load()).toBeUndefined();
    expect((await firstValueFrom(client.authState$)).loggedIn).toBe(false);
  });

  it('initialize hydrates authState from a persisted token', async () => {
    const { client, tokenStorage } = setup();
    await tokenStorage.update({ accessToken: 'at-persisted', expiresAt: 2_000_000, claims: { sub: 'returning' } });

    const state = await client.initialize();

    expect(state.loggedIn).toBe(true);
    expect(state.claims).toEqual({ sub: 'returning' });
  });
});
