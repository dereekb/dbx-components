import { Injectable, inject } from '@angular/core';
import { addToSet, type ArrayOrValue, filterMaybeArrayValues, mapIterable, type Maybe, removeFromSet } from '@dereekb/util';
import { type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { DEFAULT_EXTERNAL_CONNECTION_AUTHORIZE_PATH_FACTORY, type DbxFirebaseExternalConnectionProvider, type DbxFirebaseExternalConnectionProviderAssets, DbxFirebaseExternalConnectionsConfig } from './externalconnection';

/**
 * Default navigation: a top-level browser redirect.
 *
 * @param url - The url to navigate to.
 */
export const DEFAULT_EXTERNAL_CONNECTION_NAVIGATE_FUNCTION = (url: string) => {
  window.location.href = url;
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
   * @returns A promise that resolves once the flow has been started.
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
      navigate(authorizeUrl);
    } else {
      throw new Error(`DbxFirebaseExternalConnectionService: no authorize url could be resolved for "${providerType}".`);
    }
  }
}
