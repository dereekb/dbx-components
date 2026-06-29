import { BehaviorSubject, type Observable } from 'rxjs';
import { type AsyncValueCache, type Getter, type Maybe, OidcRelyingPartyError, type OidcDiscoveryMetadata, buildAuthorizationUrl, generateOAuthState, generatePkceMaterial, parseAuthorizationRedirect } from '@dereekb/util';
import { type OidcRelyingPartyFetch, type OidcTokenManager, type OidcTokenState, discoverOidcMetadata, exchangeAuthorizationCode, oidcTokenManager, oidcTokenStateFromResponse, refreshAccessToken } from '@dereekb/util/oidc';
import { type ConfiguredFetchWithTimeout, configureFetch } from '@dereekb/util/fetch';
import { DEFAULT_OIDC_TRANSACTION_STORAGE_KEY, localStorageOidcTokenStorage, webStorageValueCache } from './oidc.storage';

// MARK: State
/**
 * Authentication state surfaced to the UI via {@link OidcBrowserClient.authState$}.
 */
export interface OidcAuthState {
  /**
   * Whether the relying party currently holds a session (an access token, possibly expired but
   * refreshable). Goes false on logout or after a refresh fails with `invalid_grant`.
   */
  readonly loggedIn: boolean;
  /**
   * Decoded identity claims from the most recent token, when available.
   */
  readonly claims?: Maybe<Record<string, unknown>>;
}

/**
 * The persisted, in-progress login attempt. Written to (session) storage before navigating to the
 * authorization endpoint and read back when the redirect returns.
 */
export interface OidcLoginTransaction {
  readonly state: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
  /**
   * Optional app-relative location to return to after the callback completes.
   */
  readonly returnTo?: string;
}

/**
 * The result of consuming an authorization-code redirect.
 */
export interface OidcRedirectResult {
  readonly returnTo?: string;
  readonly claims?: Maybe<Record<string, unknown>>;
}

// MARK: Config
export interface OidcBrowserClientConfig {
  /**
   * The OIDC issuer URL (e.g. `https://api.example.com/oidc`).
   */
  readonly issuer: string;
  readonly clientId: string;
  readonly redirectUri: string;
  /**
   * Space-separated scopes. Request `offline_access` to receive a refresh token.
   */
  readonly scopes?: string;
  /**
   * Optional client secret. Omit for a public PKCE client (the default for browser apps).
   */
  readonly clientSecret?: Maybe<string>;
  /**
   * Optional sibling base URL for discovery fallback (see {@link discoverOidcMetadata}).
   */
  readonly fallbackBaseUrl?: string;
  /**
   * Optional client origin to rebase the authorization URL onto (split-host dev servers).
   */
  readonly appClientUrl?: Maybe<string>;
  /**
   * Token store. Defaults to a `localStorage`-backed cache.
   */
  readonly tokenStorage?: AsyncValueCache<OidcTokenState>;
  /**
   * Login-transaction store. Defaults to a `sessionStorage`-backed cache.
   */
  readonly transactionStorage?: AsyncValueCache<OidcLoginTransaction>;
  /**
   * Plain fetch transport for protocol calls (discovery/token/refresh). Defaults to global `fetch`.
   * MUST NOT inject an `Authorization` header — public clients authenticate via the `code_verifier`.
   */
  readonly fetch?: OidcRelyingPartyFetch;
  /**
   * Current-time getter (epoch ms). Defaults to `Date.now`.
   */
  readonly now?: Getter<number>;
  /**
   * Pre-emptive refresh buffer in milliseconds (forwarded to the token manager).
   */
  readonly refreshBufferMs?: number;
  /**
   * Navigates the browser to the authorization URL. Defaults to `window.location.assign`.
   */
  readonly navigate?: (url: string) => void;
  /**
   * Returns the current full URL for the redirect callback. Defaults to `window.location.href`.
   */
  readonly getCurrentUrl?: Getter<string>;
}

// MARK: Client
/**
 * A lean, framework-agnostic OIDC relying-party client for backend-less browser apps.
 */
export interface OidcBrowserClient {
  /**
   * Emits the current {@link OidcAuthState}; replays the latest value to new subscribers.
   */
  readonly authState$: Observable<OidcAuthState>;
  /**
   * The underlying lazy token manager (refresh + single-flight + rotation).
   */
  readonly manager: OidcTokenManager;
  /**
   * A Bearer-injecting `fetch` for calling the resource server (API). Resolves a valid access token
   * per request and attaches it as `Authorization: Bearer`. Distinct from the plain protocol fetch.
   */
  readonly apiFetch: ConfiguredFetchWithTimeout;
  /**
   * Hydrates {@link authState$} from any persisted token. Call once on app startup.
   */
  initialize(): Promise<OidcAuthState>;
  /**
   * Resolves (memoized) OIDC discovery metadata for the configured issuer.
   */
  discoverMetadata(): Promise<OidcDiscoveryMetadata>;
  /**
   * Begins login: generates PKCE + state, persists the transaction, and navigates to the
   * authorization endpoint.
   *
   * @param options.returnTo - Optional app-relative location to resume at after the callback.
   */
  startLogin(options?: { readonly returnTo?: string }): Promise<void>;
  /**
   * Consumes an authorization-code redirect: validates `state`, exchanges the code for tokens, and
   * stores them. Defaults to reading the current URL.
   *
   * @param url - Optional redirect URL override (defaults to the current location).
   */
  handleRedirectCallback(url?: string): Promise<OidcRedirectResult>;
  /**
   * Resolves a currently-valid access token (refreshing lazily). `undefined` when logged out.
   */
  getValidAccessToken(): Promise<Maybe<string>>;
  /**
   * Clears the stored tokens and sets {@link authState$} to logged-out.
   */
  logout(): Promise<void>;
}

/**
 * Creates an {@link OidcBrowserClient} that binds the shared relying-party core (pure helpers +
 * `@dereekb/util/oidc` protocol + token manager) to browser concerns: Web Storage persistence,
 * `window` redirect/navigation, an `authState$` observable, and a Bearer API `fetch`.
 *
 * Lazy refresh only (no proactive timer) and single-page single-flight only (no cross-tab
 * coordination) — see the package README for the multi-tab rotation limitation.
 *
 * @param config - The client configuration.
 * @returns The configured {@link OidcBrowserClient}.
 */
export function oidcBrowserClient(config: OidcBrowserClientConfig): OidcBrowserClient {
  const { issuer, clientId, redirectUri, scopes, clientSecret, fallbackBaseUrl, appClientUrl, refreshBufferMs } = config;
  const fetchTransport: OidcRelyingPartyFetch = config.fetch ?? ((input, init) => fetch(input, init));
  const now: Getter<number> = config.now ?? (() => Date.now());
  const navigate = config.navigate ?? ((url: string) => window.location.assign(url));
  const getCurrentUrl: Getter<string> = config.getCurrentUrl ?? (() => window.location.href);
  const tokenStorage = config.tokenStorage ?? localStorageOidcTokenStorage();
  const transactionStorage = config.transactionStorage ?? webStorageValueCache<OidcLoginTransaction>({ storage: sessionStorage, key: DEFAULT_OIDC_TRANSACTION_STORAGE_KEY });

  const authStateSubject = new BehaviorSubject<OidcAuthState>({ loggedIn: false });
  let discoveryPromise: Maybe<Promise<OidcDiscoveryMetadata>>;

  function discoverMetadata(): Promise<OidcDiscoveryMetadata> {
    if (discoveryPromise == null) {
      // Memoize discovery for the client's lifetime; clear on failure so a transient error can retry.
      discoveryPromise = discoverOidcMetadata({ issuer, fallbackBaseUrl, fetch: fetchTransport }).catch((e) => {
        discoveryPromise = undefined;
        throw e;
      });
    }

    return discoveryPromise;
  }

  const manager = oidcTokenManager({
    storage: tokenStorage,
    now,
    refreshBufferMs,
    refresh: async ({ refreshToken }) => {
      const meta = await discoverMetadata();
      return refreshAccessToken({ tokenEndpoint: meta.token_endpoint, clientId, clientSecret, refreshToken, fetch: fetchTransport });
    }
  });

  function pushAuthState(state: Maybe<OidcTokenState>): void {
    authStateSubject.next({ loggedIn: state != null, claims: state?.claims });
  }

  async function getValidAccessToken(): Promise<Maybe<string>> {
    const token = await manager.getValidAccessToken();

    // A null token where we previously believed we were logged in means the session ended
    // (e.g. refresh hit invalid_grant and the manager cleared the store) — reflect the logout.
    if (token == null && authStateSubject.value.loggedIn) {
      authStateSubject.next({ loggedIn: false });
    }

    return token;
  }

  const apiFetch = configureFetch({
    makeFetch: fetchTransport,
    baseRequest: async () => {
      const token = await getValidAccessToken();
      return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }
  });

  async function startLogin(options?: { readonly returnTo?: string }): Promise<void> {
    const meta = await discoverMetadata();
    const { codeVerifier, codeChallenge } = await generatePkceMaterial();
    const state = generateOAuthState();

    await transactionStorage.update({ state, codeVerifier, redirectUri, ...(options?.returnTo ? { returnTo: options.returnTo } : {}) });

    const url = buildAuthorizationUrl({
      authorizationEndpoint: meta.authorization_endpoint,
      oidcIssuer: issuer,
      appClientUrl,
      clientId,
      redirectUri,
      scopes,
      state,
      codeChallenge
    });

    navigate(url);
  }

  async function handleRedirectCallback(url: string = getCurrentUrl()): Promise<OidcRedirectResult> {
    const transaction = await transactionStorage.load();

    if (transaction == null) {
      throw new OidcRelyingPartyError({ message: 'No in-progress login transaction was found for this redirect.', code: 'INVALID_STATE' });
    }

    const parsed = parseAuthorizationRedirect({ url, expectedState: transaction.state });
    const meta = await discoverMetadata();
    const response = await exchangeAuthorizationCode({
      tokenEndpoint: meta.token_endpoint,
      clientId,
      clientSecret,
      redirectUri: transaction.redirectUri,
      code: parsed.code,
      codeVerifier: transaction.codeVerifier,
      fetch: fetchTransport
    });

    const tokenState = oidcTokenStateFromResponse(response, { now: now() });
    await manager.setState(tokenState);
    await transactionStorage.clear();
    pushAuthState(tokenState);

    return { ...(transaction.returnTo ? { returnTo: transaction.returnTo } : {}), claims: tokenState.claims };
  }

  async function initialize(): Promise<OidcAuthState> {
    const state = await manager.getState();
    pushAuthState(state);
    return authStateSubject.value;
  }

  async function logout(): Promise<void> {
    await manager.clear();
    authStateSubject.next({ loggedIn: false });
  }

  return {
    authState$: authStateSubject.asObservable(),
    manager,
    apiFetch,
    initialize,
    discoverMetadata,
    startLogin,
    handleRedirectCallback,
    getValidAccessToken,
    logout
  };
}
