import { mapIterable, addToSet, removeFromSet, Maybe, ArrayOrValue, filterMaybeArrayValues } from '@dereekb/util';
import { Inject, Injectable, InjectionToken, Optional, Type, inject } from '@angular/core';
import { FirebaseLoginMethodCategory, FirebaseLoginMethodType, KnownFirebaseLoginMethodType } from './login';
import { DbxFirebaseLoginTermsSimpleComponent } from './login.terms.simple.component';
import { DbxFirebaseAuthLoginPasswordConfig, DEFAULT_FIREBASE_AUTH_LOGIN_PASSWORD_CONFIG } from './login.password';

/**
 * Default providers to inject.
 */
export const DEFAULT_FIREBASE_AUTH_LOGIN_PROVIDERS_TOKEN = new InjectionToken('DefaultDbxFirebaseAuthLoginProviders');
export const DEFAULT_FIREBASE_AUTH_LOGIN_TERMS_COMPONENT_CLASS_TOKEN = new InjectionToken('DefaultDbxFirebaseAuthLoginTermsComponentClass');
export const DEFAULT_FIREBASE_AUTH_LOGIN_PASSWORD_CONFIG_TOKEN = new InjectionToken('DefaultDbxFirebaseAuthLoginPasswordConfig');

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
   * Custom registration type to use instead. If false, registration is not allowd for this type.
   */
  readonly registrationComponentClass?: Type<unknown> | false;
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
   * Optional background color to apply.
   */
  readonly backgroundColor?: string;
  /**
   * Optional background color to apply.
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
  readonly loginTermsComponentClass = inject<Type<unknown>>(DEFAULT_FIREBASE_AUTH_LOGIN_TERMS_COMPONENT_CLASS_TOKEN) ?? DbxFirebaseLoginTermsSimpleComponent;

  private readonly _providers = new Map<FirebaseLoginMethodType, DbxFirebaseAuthLoginProvider>();
  private readonly _assets = new Map<FirebaseLoginMethodType, DbxFirebaseAuthLoginProviderAssets>();

  private _enableAll = false;
  private _passwordConfig: DbxFirebaseAuthLoginPasswordConfig;
  private _enabled = new Set<FirebaseLoginMethodType>();

  constructor(@Optional() @Inject(DEFAULT_FIREBASE_AUTH_LOGIN_PROVIDERS_TOKEN) defaultProviders: DbxFirebaseAuthLoginProvider[], @Optional() @Inject(DEFAULT_FIREBASE_AUTH_LOGIN_PASSWORD_CONFIG_TOKEN) passwordConfig: DbxFirebaseAuthLoginPasswordConfig) {
    if (defaultProviders) {
      defaultProviders.forEach((x) => this.register(x, false));
    }

    this._passwordConfig = passwordConfig ?? DEFAULT_FIREBASE_AUTH_LOGIN_PASSWORD_CONFIG;
  }

  /**
   * Used to register a provider. If a provider is already registered, this will override it by default.
   *
   * @param provider
   * @param override
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
    return Array.from(this._providers.keys());
  }

  getEnabledTypes(): FirebaseLoginMethodType[] {
    return this._enableAll ? this.getRegisteredTypes() : Array.from(this._enabled);
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
