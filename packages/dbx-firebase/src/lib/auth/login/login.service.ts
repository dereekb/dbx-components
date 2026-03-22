import { mapIterable, addToSet, removeFromSet, type Maybe, type ArrayOrValue, filterMaybeArrayValues } from '@dereekb/util';
import { Injectable, InjectionToken, type Type, inject } from '@angular/core';
import { type FirebaseLoginMethodCategory, type FirebaseLoginMethodType, type KnownFirebaseLoginMethodType } from './login';
import { DbxFirebaseLoginTermsSimpleComponent } from './login.terms.simple.component';
import { type DbxFirebaseAuthLoginPasswordConfig, DEFAULT_FIREBASE_AUTH_LOGIN_PASSWORD_CONFIG } from './login.password';

/**
 * Default providers to inject.
 */
export const DEFAULT_FIREBASE_AUTH_LOGIN_PROVIDERS_TOKEN = new InjectionToken<DbxFirebaseAuthLoginProvider[]>('DefaultDbxFirebaseAuthLoginProviders');
export const DEFAULT_FIREBASE_AUTH_LOGIN_TERMS_COMPONENT_CLASS_TOKEN = new InjectionToken<Type<unknown>>('DefaultDbxFirebaseAuthLoginTermsComponentClass');
export const DEFAULT_FIREBASE_AUTH_LOGIN_PASSWORD_CONFIG_TOKEN = new InjectionToken<DbxFirebaseAuthLoginPasswordConfig>('DefaultDbxFirebaseAuthLoginPasswordConfig');

export interface DbxFirebaseAuthLoginProvider<D = unknown> {
  /**
   * Category for this login method.
   */
  readonly category?: FirebaseLoginMethodCategory;
  /**
   * Login method key for this type.
   */
  readonly loginMethodType: KnownFirebaseLoginMethodType | FirebaseLoginMethodType;
  /**
   * Login/Registration class to use.
   */
  readonly componentClass: Type<unknown>;
  /**
   * Custom registration type to use instead. If false, registration is not allowed for this type.
   */
  readonly registrationComponentClass?: Type<unknown> | false;
  /**
   * Whether this provider supports linking to an existing account. Defaults to true.
   * Set to false to exclude this provider in link mode (e.g., email, anonymous).
   */
  readonly allowLinking?: Maybe<boolean>;
  /**
   * Custom data available to the components.
   *
   * Components are responsible for knowing the typing information of this data.
   */
  readonly componentData?: D;
  /**
   * Asset configuration for this type.
   */
  readonly assets: DbxFirebaseAuthLoginProviderAssets;
}

/**
 * Asset configurations for a provider.
 */
export interface DbxFirebaseAuthLoginProviderAssets {
  /**
   * URL of the logo to use.
   */
  readonly logoUrl?: string;
  /**
   * Icon to use in place of the logo.
   */
  readonly loginIcon?: string;
  /**
   * Log in text to display next to the logo.
   */
  readonly loginText?: string;
  /**
   * Display name of the provider (e.g., "Google", "Facebook").
   */
  readonly providerName?: string;
  /**
   * Text to display for the link action. Defaults to "Connect " + providerName.
   */
  readonly linkText?: string;
  /**
   * Text to display for the unlink action. Defaults to "Disconnect " + providerName.
   */
  readonly unlinkText?: string;
  /**
   * Optional CSS filter to apply to the logo image (e.g., 'brightness(0) invert(1)' to make a black SVG white).
   */
  readonly logoFilter?: string;
  /**
   * Optional background color to apply.
   */
  readonly backgroundColor?: string;
  /**
   * Optional text color to apply.
   */
  readonly textColor?: string;
}

/**
 * Service used for registering components used for logging in.
 *
 * Default providers can be configured by the DEFAULT_FIREBASE_AUTH_LOGIN_PROVIDERS_TOKEN injectable value.
 */
@Injectable()
export class DbxFirebaseAuthLoginService {
  readonly loginTermsComponentClass = inject(DEFAULT_FIREBASE_AUTH_LOGIN_TERMS_COMPONENT_CLASS_TOKEN, { optional: true }) ?? DbxFirebaseLoginTermsSimpleComponent;

  private readonly _providers = new Map<FirebaseLoginMethodType, DbxFirebaseAuthLoginProvider>();
  private readonly _assets = new Map<FirebaseLoginMethodType, DbxFirebaseAuthLoginProviderAssets>();

  private _enableAll = false;
  private _passwordConfig: DbxFirebaseAuthLoginPasswordConfig;
  private _enabled = new Set<FirebaseLoginMethodType>();

  constructor() {
    const defaultProviders = inject(DEFAULT_FIREBASE_AUTH_LOGIN_PROVIDERS_TOKEN, { optional: true });
    const passwordConfig = inject(DEFAULT_FIREBASE_AUTH_LOGIN_PASSWORD_CONFIG_TOKEN, { optional: true });

    if (defaultProviders) {
      defaultProviders.forEach((x) => this.register(x, false));
    }

    this._passwordConfig = passwordConfig ?? DEFAULT_FIREBASE_AUTH_LOGIN_PASSWORD_CONFIG;
  }

  /**
   * Used to register a provider. If a provider is already registered, this will override it by default.
   *
   * @param provider - The login provider to register.
   * @param override - Whether to override an existing provider of the same type. Defaults to true.
   * @returns True if the provider was registered, false if it already existed and override was false.
   */
  register(provider: DbxFirebaseAuthLoginProvider, override: boolean = true): boolean {
    if (override || !this._providers.has(provider.loginMethodType)) {
      this._providers.set(provider.loginMethodType, provider);

      if (provider.assets) {
        this.updateAssetsForProvider(provider.loginMethodType, provider.assets);
      }
      return true;
    } else {
      return false;
    }
  }

  /**
   * Updates the assets for a provider type.
   *
   * @param type
   * @param assets
   */
  updateAssetsForProvider(type: FirebaseLoginMethodType, assets: Partial<DbxFirebaseAuthLoginProviderAssets>): void {
    const current = this._assets.get(type);
    const update = {
      ...current,
      ...assets
    };

    this._assets.set(type, update);
  }

  // MARK: Enable/Disable
  /**
   * Enables all providers and any providers that will be registered.
   *
   * @param enableAll - Whether to enable all providers. Defaults to true.
   */
  setEnableAll(enableAll = true) {
    this._enableAll = enableAll;
  }

  clearEnabled(): void {
    this._enabled = new Set();
  }

  /**
   * Enables all of the specified types.
   *
   * @param types
   */
  enable(types: ArrayOrValue<FirebaseLoginMethodType>): void {
    addToSet(this._enabled, types);
  }

  disable(types: ArrayOrValue<FirebaseLoginMethodType>): void {
    removeFromSet(this._enabled, types);
  }

  // MARK: Get
  getRegisteredTypes(): FirebaseLoginMethodType[] {
    return [...this._providers.keys()];
  }

  getEnabledTypes(): FirebaseLoginMethodType[] {
    return this._enableAll ? this.getRegisteredTypes() : [...this._enabled];
  }

  getLoginProvider(type: FirebaseLoginMethodType): Maybe<DbxFirebaseAuthLoginProvider> {
    return this._providers.get(type);
  }

  getLoginProviders(types: Iterable<FirebaseLoginMethodType>): DbxFirebaseAuthLoginProvider[] {
    return filterMaybeArrayValues(mapIterable(types ?? [], (x) => this._providers.get(x)));
  }

  getRegisterProvider(type: FirebaseLoginMethodType): Maybe<DbxFirebaseAuthLoginProvider> {
    return this._providers.get(type);
  }

  getRegisterProviders(types: Iterable<FirebaseLoginMethodType>): DbxFirebaseAuthLoginProvider[] {
    return filterMaybeArrayValues(mapIterable(types ?? [], (x) => this._providers.get(x))).filter((x) => x.registrationComponentClass !== false);
  }

  getLinkProviders(types: Iterable<FirebaseLoginMethodType>): DbxFirebaseAuthLoginProvider[] {
    return filterMaybeArrayValues(mapIterable(types ?? [], (x) => this._providers.get(x))).filter((x) => x.allowLinking !== false);
  }

  /**
   * Returns all registered provider assets.
   *
   * @returns A map of login method types to their asset configurations.
   */
  getAllProviderAssets(): Map<FirebaseLoginMethodType, DbxFirebaseAuthLoginProviderAssets> {
    return new Map(this._assets);
  }

  getProviderAssets(type: FirebaseLoginMethodType): Maybe<DbxFirebaseAuthLoginProviderAssets> {
    return this._assets.get(type);
  }

  getPasswordConfig() {
    return this._passwordConfig;
  }

  setPasswordConfig(passwordConfig: DbxFirebaseAuthLoginPasswordConfig) {
    this._passwordConfig = passwordConfig;
  }
}
