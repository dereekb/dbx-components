import { Injectable, inject } from '@angular/core';
import { addToSet, type ArrayOrValue, filterMaybeArrayValues, fixExtraQueryParameters, generatePkceMaterial, mapIterable, type Maybe, removeFromSet } from '@dereekb/util';
import { UserExternalConnectionFunctions, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { DbxFirebaseAuthService } from '../../../auth/service/firebase.auth.service';
import {
  DEFAULT_EXTERNAL_CONNECTION_AUTHORIZE_PATH_FACTORY,
  DEFAULT_EXTERNAL_CONNECTION_SIGN_IN_PATH_FACTORY,
  DEFAULT_EXTERNAL_CONNECTION_TOKEN_PATH_FACTORY,
  EXTERNAL_CONNECTION_SIGN_IN_TICKET_PARAM,
  EXTERNAL_CONNECTION_SIGN_IN_VERIFIER_STORAGE_KEY,
  type DbxFirebaseExternalConnectionAuthorizeState,
  type DbxFirebaseExternalConnectionProvider,
  type DbxFirebaseExternalConnectionProviderAssets,
  DbxFirebaseExternalConnectionsConfig
} from './externalconnection';
import { dbxFirebaseExternalConnectionProviderForEntry } from './externalconnection.default';

/**
 * How long {@link DEFAULT_EXTERNAL_CONNECTION_NAVIGATE_FUNCTION} waits for the browser to leave the
 * page before treating the redirect as having failed.
 *
 * Generous, because the wait spans the request to the app's own authorize endpoint plus the redirect
 * chain out to the provider, and a cold serverless function alone can take several seconds.
 */
export const DEFAULT_EXTERNAL_CONNECTION_NAVIGATE_TIMEOUT = 20 * 1000;

/**
 * Starts a top-level navigation and resolves only once the browser has committed to leaving the
 * current page, rejecting when it has not done so within the timeout.
 *
 * `pagehide` is the signal: it fires as the browser is about to unload this document for the new one,
 * which is the earliest point the navigation is known to have actually taken. Anything earlier — an
 * assignment to `location.href` returning, say — only says the navigation was *requested*.
 *
 * The navigation is invoked here rather than by the caller so the listener is always in place before
 * the page can go, and so a refused navigation settles immediately instead of waiting out the timeout.
 *
 * @param navigate - Starts the navigation.
 * @param timeout - How long to wait before rejecting. Defaults to {@link DEFAULT_EXTERNAL_CONNECTION_NAVIGATE_TIMEOUT}.
 * @returns Resolves when the page is being unloaded for the navigation.
 */
export function navigateAndWaitForPageToLeave(navigate: () => void, timeout: number = DEFAULT_EXTERNAL_CONNECTION_NAVIGATE_TIMEOUT): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // aborting drops the listener, so a page that stays put does not accumulate one per attempt
    const abortController = new AbortController();

    const timeoutRef = setTimeout(() => {
      abortController.abort();
      reject(new Error('The page did not open. The browser may have blocked the redirect.'));
    }, timeout);

    const cancel = () => {
      abortController.abort();
      clearTimeout(timeoutRef);
    };

    window.addEventListener(
      'pagehide',
      () => {
        clearTimeout(timeoutRef);
        resolve();
      },
      { once: true, signal: abortController.signal }
    );

    try {
      navigate();
    } catch (e) {
      cancel();
      reject(e);
    }
  });
}

/**
 * Default navigation: a top-level browser redirect that settles only once the new page is opening.
 *
 * Assigning `location.href` returns immediately — before the request for the new document has even
 * been answered — so a caller that treated the assignment as the end of the work reported success
 * while the old page was still sitting there. Waiting for the unload instead means the connect action
 * stays in its working state for as long as the user is still looking at the settings page, and a
 * redirect the browser refuses outright surfaces as an error rather than a silent success.
 *
 * @param url - The url to navigate to.
 * @returns Resolves once the browser is leaving the page for the new url.
 */
export const DEFAULT_EXTERNAL_CONNECTION_NAVIGATE_FUNCTION = (url: string) => {
  return navigateAndWaitForPageToLeave(() => {
    window.location.href = url;
  });
};

/**
 * Registry of the third-party services a user can connect their account to.
 *
 * Modeled on `DbxFirebaseAuthLoginService`, but WITHOUT any per-user state: it is root-scoped, so a
 * Firestore listener held here would live for the app's lifetime and lock the UI to one user. The
 * connection state is resolved by the container component instead, from a single document read that
 * is fanned out to every row.
 */
@Injectable()
export class DbxFirebaseExternalConnectionService {
  readonly config = inject(DbxFirebaseExternalConnectionsConfig);

  /**
   * Optional so the registry is usable — and testable — in an app that has not wired the
   * userExternalConnection callables. Only state minting needs them, and it says so when they are
   * missing rather than failing every injection of this service.
   */
  private readonly _userExternalConnectionFunctions = inject(UserExternalConnectionFunctions, { optional: true });

  /**
   * Optional for the same reason: the connect half of this registry never signs anyone in, and a
   * spec exercising it should not have to stand up Firebase Auth.
   */
  private readonly _dbxFirebaseAuthService = inject(DbxFirebaseAuthService, { optional: true });

  private readonly _providers = new Map<UserExternalConnectionProviderType, DbxFirebaseExternalConnectionProvider>();
  private readonly _assets = new Map<UserExternalConnectionProviderType, DbxFirebaseExternalConnectionProviderAssets>();

  private _enableAll = false;
  private _enabled = new Set<UserExternalConnectionProviderType>();

  constructor() {
    const { providers, enabledProviders } = this.config;

    providers.forEach((x) => this.register(dbxFirebaseExternalConnectionProviderForEntry(x), false));

    if (enabledProviders == null || enabledProviders === true) {
      this._enableAll = true;
    } else {
      this.enable(enabledProviders);
    }
  }

  /**
   * Registers a provider.
   *
   * @param provider - The provider to register.
   * @param override - Whether to override an existing provider of the same type. Defaults to true.
   * @returns True if the provider was registered.
   */
  register(provider: DbxFirebaseExternalConnectionProvider, override: boolean = true): boolean {
    let result: boolean;

    if (override || !this._providers.has(provider.providerType)) {
      this._providers.set(provider.providerType, provider);
      this.updateAssetsForProvider(provider.providerType, provider.assets);
      result = true;
    } else {
      result = false;
    }

    return result;
  }

  /**
   * Patches the assets for a provider type.
   *
   * @param providerType - The provider to update.
   * @param assets - The asset values to merge in.
   */
  updateAssetsForProvider(providerType: UserExternalConnectionProviderType, assets: Partial<DbxFirebaseExternalConnectionProviderAssets>): void {
    const current = this._assets.get(providerType);
    this._assets.set(providerType, { ...current, ...assets } as DbxFirebaseExternalConnectionProviderAssets);
  }

  // MARK: Enable/Disable
  /**
   * Enables all providers, including any registered later.
   *
   * @param enableAll - Whether to enable all providers. Defaults to true.
   */
  setEnableAll(enableAll = true): void {
    this._enableAll = enableAll;
  }

  clearEnabled(): void {
    this._enabled = new Set();
  }

  enable(types: ArrayOrValue<UserExternalConnectionProviderType>): void {
    addToSet(this._enabled, types);
  }

  disable(types: ArrayOrValue<UserExternalConnectionProviderType>): void {
    removeFromSet(this._enabled, types);
  }

  // MARK: Get
  getRegisteredTypes(): UserExternalConnectionProviderType[] {
    return Array.from(this._providers.keys());
  }

  getEnabledTypes(): UserExternalConnectionProviderType[] {
    return this._enableAll ? this.getRegisteredTypes() : Array.from(this._enabled);
  }

  getProvider(providerType: UserExternalConnectionProviderType): Maybe<DbxFirebaseExternalConnectionProvider> {
    return this._providers.get(providerType);
  }

  getProviders(types?: Maybe<Iterable<UserExternalConnectionProviderType>>): DbxFirebaseExternalConnectionProvider[] {
    return filterMaybeArrayValues(mapIterable(types ?? this.getRegisteredTypes(), (x) => this._providers.get(x)));
  }

  getAssetsForProvider(providerType: UserExternalConnectionProviderType): Maybe<DbxFirebaseExternalConnectionProviderAssets> {
    return this._assets.get(providerType);
  }

  // MARK: Connect
  /**
   * Whether the connect flow mints a signed `state` and carries it on the authorize request.
   *
   * @returns True when state minting is enabled, which is the default.
   */
  get mintsAuthorizeState(): boolean {
    return this.config.mintAuthorizeState ?? true;
  }

  /**
   * Mints the short-lived signed `state` that begins a provider's OAuth handoff.
   *
   * An AUTHENTICATED call, which is the entire point of it: the top-level navigation that follows
   * carries no Firebase ID token, so this is the only place the server learns who is connecting.
   *
   * Requires the user to already have a connection document — the server asserts a role against it,
   * and a role map is only consulted for a document that exists. `DbxFirebaseExternalConnectionsComponent`
   * creates it on load; a custom UI that reaches this call by another route has to create it too.
   *
   * @param providerType - The provider the state is for.
   * @returns The state to send on the authorize request.
   */
  async mintAuthorizeStateForProvider(providerType: UserExternalConnectionProviderType): Promise<DbxFirebaseExternalConnectionAuthorizeState> {
    const userExternalConnectionFunctions = this._userExternalConnectionFunctions;

    if (!userExternalConnectionFunctions) {
      throw new Error(`DbxFirebaseExternalConnectionService: cannot mint an authorize state for "${providerType}" because UserExternalConnectionFunctions was not provided. Add the userExternalConnection functions to the app's functions config map, or configure mintAuthorizeState: false.`);
    }

    const { state } = await userExternalConnectionFunctions.userExternalConnection.readUserExternalConnection.authorizeState({ providerType });
    return state;
  }

  /**
   * Resolves the authorize url for a provider, carrying a freshly minted `state` when state minting
   * is enabled.
   *
   * @param providerType - The provider to resolve.
   * @returns The authorize url, or null when the provider is not registered.
   */
  async authorizeUrlWithStateForProvider(providerType: UserExternalConnectionProviderType): Promise<Maybe<string>> {
    const authorizeUrl = this.authorizeUrlForProvider(providerType);
    let result = authorizeUrl;

    if (authorizeUrl && this.mintsAuthorizeState) {
      const state = await this.mintAuthorizeStateForProvider(providerType);
      // appended as text rather than through URL, since an app that shares an origin with its API
      // configures no authorizeOrigin and the path stays relative
      result = fixExtraQueryParameters(`${authorizeUrl}?state=${encodeURIComponent(state)}`);
    }

    return result;
  }

  /**
   * Resolves the authorize url for a provider, WITHOUT a `state`.
   *
   * @param providerType - The provider to resolve.
   * @returns The authorize url, or null when the provider is not registered.
   */
  authorizeUrlForProvider(providerType: UserExternalConnectionProviderType): Maybe<string> {
    const provider = this.getProvider(providerType);
    let result: Maybe<string> = null;

    if (provider) {
      const pathFactory = this.config.authorizePathFactory ?? DEFAULT_EXTERNAL_CONNECTION_AUTHORIZE_PATH_FACTORY;
      const path = provider.authorizePath ?? pathFactory(providerType);
      result = this.config.authorizeOrigin ? `${this.config.authorizeOrigin}${path}` : path;
    }

    return result;
  }

  /**
   * Starts the connect flow for a provider.
   *
   * Uses the provider's own `connect` handler when it declares one, otherwise mints the `state` and
   * navigates to the authorize url carrying it. The mint is deliberately part of the default rather
   * than something each app re-implements: the app's authorize endpoint bounces a stateless request
   * straight to its failure url, so a "connect" that skipped it would look like it worked and land
   * the user back on the settings page unconnected.
   *
   * @param providerType - The provider to connect.
   * @returns Resolves once the authorize page is actually opening, and rejects when it never opened.
   */
  async connectToProvider(providerType: UserExternalConnectionProviderType): Promise<void> {
    const provider = this.getProvider(providerType);

    if (!provider) {
      throw new Error(`DbxFirebaseExternalConnectionService: no provider registered for "${providerType}".`);
    }

    const navigate = this.config.navigate ?? DEFAULT_EXTERNAL_CONNECTION_NAVIGATE_FUNCTION;

    if (provider.connect) {
      await provider.connect({
        providerType,
        provider,
        authorizeUrl: this.authorizeUrlForProvider(providerType),
        mintAuthorizeState: () => this.mintAuthorizeStateForProvider(providerType),
        navigate
      });
    } else {
      const authorizeUrl = await this.authorizeUrlWithStateForProvider(providerType);

      if (!authorizeUrl) {
        throw new Error(`DbxFirebaseExternalConnectionService: no authorize url could be resolved for "${providerType}".`);
      }

      await navigate(authorizeUrl);
    }
  }

  // MARK: Sign In
  /**
   * Resolves the sign-in url for a provider.
   *
   * @param providerType - The provider to resolve.
   * @returns The sign-in url, or null when the provider is not registered for sign-in.
   */
  signInUrlForProvider(providerType: UserExternalConnectionProviderType): Maybe<string> {
    const provider = this.getProvider(providerType);
    let result: Maybe<string> = null;

    if (provider?.signIn) {
      const path = provider.signIn.signInPath ?? DEFAULT_EXTERNAL_CONNECTION_SIGN_IN_PATH_FACTORY(providerType);
      result = this.config.authorizeOrigin ? `${this.config.authorizeOrigin}${path}` : path;
    }

    return result;
  }

  /**
   * Resolves the ticket-exchange url for a provider.
   *
   * @param providerType - The provider to resolve.
   * @returns The token url, or null when the provider is not registered for sign-in.
   */
  signInTokenUrlForProvider(providerType: UserExternalConnectionProviderType): Maybe<string> {
    const provider = this.getProvider(providerType);
    let result: Maybe<string> = null;

    if (provider?.signIn) {
      const path = DEFAULT_EXTERNAL_CONNECTION_TOKEN_PATH_FACTORY(providerType);
      result = this.config.authorizeOrigin ? `${this.config.authorizeOrigin}${path}` : path;
    }

    return result;
  }

  /**
   * Begins the sign-in flow for a provider.
   *
   * Unlike {@link connectToProvider} there is no `state` to mint: the caller is not signed in, so
   * there is no authenticated call to make. A PKCE verifier is generated instead and kept in
   * `sessionStorage`; only its challenge travels, and the ticket the server hands back at the end is
   * redeemable only by whoever still holds the verifier. That is what makes a redirect-borne ticket
   * safe where a redirect-borne token would not be.
   *
   * REQUIRES a secure context: the challenge is derived with `crypto.subtle`, which browsers expose
   * only over https or on `localhost`. An app served over plain http on a LAN address cannot start a
   * sign-in — the same constraint every PKCE client in this workspace already carries.
   *
   * @param providerType - The provider to sign in with.
   * @returns Resolves once the provider's consent page is actually opening.
   */
  async signInWithProvider(providerType: UserExternalConnectionProviderType): Promise<void> {
    const provider = this.getProvider(providerType);

    if (!provider?.signIn) {
      throw new Error(`DbxFirebaseExternalConnectionService: "${providerType}" is not registered for sign-in.`);
    }

    const signInUrl = this.signInUrlForProvider(providerType);

    if (!signInUrl) {
      throw new Error(`DbxFirebaseExternalConnectionService: no sign-in url could be resolved for "${providerType}".`);
    }

    const { codeVerifier, codeChallenge } = await generatePkceMaterial();

    // written BEFORE navigating: once the page is unloading there is no chance to store anything, and
    // a flow whose verifier never landed is unredeemable at the other end
    this.storeSignInVerifier(providerType, codeVerifier);

    const returnPath = provider.signIn.returnPath;
    const returnPathParam = returnPath ? `&returnPath=${encodeURIComponent(returnPath)}` : '';
    const url = fixExtraQueryParameters(`${signInUrl}?challenge=${encodeURIComponent(codeChallenge)}${returnPathParam}`);

    const navigate = this.config.navigate ?? DEFAULT_EXTERNAL_CONNECTION_NAVIGATE_FUNCTION;
    await navigate(url);
  }

  /**
   * Completes a sign-in that has just redirected back, when the current URL carries a ticket.
   *
   * Safe to call unconditionally on app start: a page with no ticket, or no stored verifier, resolves
   * to false without touching the network.
   *
   * @param url - The url to read the ticket from. Defaults to the current location.
   * @returns True when a ticket was redeemed and the user is now signed in.
   */
  async handleSignInRedirectResult(url: string = window.location.href): Promise<boolean> {
    const ticket = readExternalConnectionSignInTicketFromUrl(url);
    let result = false;

    if (ticket != null) {
      const stored = this.readStoredSignInVerifier();

      // ALWAYS cleared, success or not: a verifier is single-use, and one left behind would be
      // offered against whatever ticket arrived next
      this.clearStoredSignInVerifier();

      if (stored == null) {
        throw new Error('DbxFirebaseExternalConnectionService: a sign-in ticket arrived with no stored verifier. The sign-in must be completed in the tab that started it.');
      }

      const customToken = await this.exchangeSignInTicket({ providerType: stored.providerType, ticket, verifier: stored.codeVerifier });
      const dbxFirebaseAuthService = this._dbxFirebaseAuthService;

      if (!dbxFirebaseAuthService) {
        throw new Error('DbxFirebaseExternalConnectionService: cannot complete a sign-in because DbxFirebaseAuthService was not provided.');
      }

      await dbxFirebaseAuthService.logInWithCustomToken(customToken);
      result = true;
    }

    return result;
  }

  /**
   * Posts a ticket and its verifier to the provider's token endpoint.
   *
   * @param input - The provider, the ticket from the redirect, and the stored verifier.
   * @param input.providerType - The provider the ticket belongs to.
   * @param input.ticket - The ticket the redirect carried.
   * @param input.verifier - The PKCE verifier the browser retained.
   * @returns The Firebase custom token.
   */
  async exchangeSignInTicket(input: { readonly providerType: UserExternalConnectionProviderType; readonly ticket: string; readonly verifier: string }): Promise<string> {
    const tokenUrl = this.signInTokenUrlForProvider(input.providerType);

    if (!tokenUrl) {
      throw new Error(`DbxFirebaseExternalConnectionService: no token url could be resolved for "${input.providerType}".`);
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ticket: input.ticket, verifier: input.verifier })
    });

    if (!response.ok) {
      throw new Error(`DbxFirebaseExternalConnectionService: the "${input.providerType}" sign-in ticket was rejected (${response.status}).`);
    }

    const { customToken } = (await response.json()) as { customToken?: Maybe<string> };

    if (!customToken) {
      throw new Error(`DbxFirebaseExternalConnectionService: the "${input.providerType}" ticket exchange returned no custom token.`);
    }

    return customToken;
  }

  /**
   * Stores the in-flight sign-in's verifier and the provider it belongs to.
   *
   * @param providerType - The provider the flow was started for.
   * @param codeVerifier - The PKCE verifier to retain.
   */
  protected storeSignInVerifier(providerType: UserExternalConnectionProviderType, codeVerifier: string): void {
    sessionStorage.setItem(EXTERNAL_CONNECTION_SIGN_IN_VERIFIER_STORAGE_KEY, JSON.stringify({ providerType, codeVerifier }));
  }

  /**
   * Reads the stored verifier, treating a corrupt entry as absent — the same contract
   * `webStorageValueCache` keeps, so a malformed entry never wedges the sign-in.
   *
   * @returns The stored provider and verifier, or null when there is none.
   */
  protected readStoredSignInVerifier(): Maybe<{ readonly providerType: UserExternalConnectionProviderType; readonly codeVerifier: string }> {
    const raw = sessionStorage.getItem(EXTERNAL_CONNECTION_SIGN_IN_VERIFIER_STORAGE_KEY);
    let result: Maybe<{ readonly providerType: UserExternalConnectionProviderType; readonly codeVerifier: string }>;

    if (raw != null) {
      try {
        const parsed = JSON.parse(raw) as { providerType?: Maybe<string>; codeVerifier?: Maybe<string> };
        result = parsed?.providerType && parsed.codeVerifier ? { providerType: parsed.providerType, codeVerifier: parsed.codeVerifier } : undefined;
      } catch {
        result = undefined;
      }
    }

    return result;
  }

  protected clearStoredSignInVerifier(): void {
    sessionStorage.removeItem(EXTERNAL_CONNECTION_SIGN_IN_VERIFIER_STORAGE_KEY);
  }
}

/**
 * Reads the sign-in ticket a completed handoff redirected back with.
 *
 * @param url - The url to read.
 * @returns The ticket, or null when the url carries none.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function readExternalConnectionSignInTicketFromUrl(url: string): Maybe<string> {
  let result: Maybe<string>;

  try {
    result = new URL(url).searchParams.get(EXTERNAL_CONNECTION_SIGN_IN_TICKET_PARAM) ?? undefined;
  } catch {
    // a url that does not parse carries no ticket
  }

  return result;
}
