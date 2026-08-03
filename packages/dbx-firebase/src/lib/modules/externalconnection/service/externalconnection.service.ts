import { Injectable, inject } from '@angular/core';
import { addToSet, type ArrayOrValue, filterMaybeArrayValues, mapIterable, type Maybe, removeFromSet } from '@dereekb/util';
import { type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { DEFAULT_EXTERNAL_CONNECTION_AUTHORIZE_PATH_FACTORY, type DbxFirebaseExternalConnectionProvider, type DbxFirebaseExternalConnectionProviderAssets, DbxFirebaseExternalConnectionsConfig } from './externalconnection';

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

  private readonly _providers = new Map<UserExternalConnectionProviderType, DbxFirebaseExternalConnectionProvider>();
  private readonly _assets = new Map<UserExternalConnectionProviderType, DbxFirebaseExternalConnectionProviderAssets>();

  private _enableAll = false;
  private _enabled = new Set<UserExternalConnectionProviderType>();

  constructor() {
    const { providers, enabledProviders } = this.config;

    providers.forEach((x) => this.register(x, false));

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
    return [...this._providers.keys()];
  }

  getEnabledTypes(): UserExternalConnectionProviderType[] {
    return this._enableAll ? this.getRegisteredTypes() : [...this._enabled];
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
   * Resolves the authorize url for a provider.
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
   * Uses the provider's own `connect` handler when it declares one, otherwise navigates to the
   * resolved authorize url.
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
    const authorizeUrl = this.authorizeUrlForProvider(providerType);

    if (provider.connect) {
      await provider.connect({ providerType, provider, authorizeUrl, navigate });
    } else if (authorizeUrl) {
      await navigate(authorizeUrl);
    } else {
      throw new Error(`DbxFirebaseExternalConnectionService: no authorize url could be resolved for "${providerType}".`);
    }
  }
}
