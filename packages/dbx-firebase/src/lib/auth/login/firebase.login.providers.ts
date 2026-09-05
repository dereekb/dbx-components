import { inject, type EnvironmentProviders, makeEnvironmentProviders, provideAppInitializer, type Provider, type Type } from '@angular/core';
import { type FirebaseLoginMethodType } from './login';
import { type DbxFirebaseAuthLoginPasswordConfig } from './login.password';
import { type DbxFirebaseAuthLoginProvider, DbxFirebaseAuthLoginService, DEFAULT_FIREBASE_AUTH_LOGIN_PASSWORD_CONFIG_TOKEN, DEFAULT_FIREBASE_AUTH_LOGIN_PROVIDERS_TOKEN, DEFAULT_FIREBASE_AUTH_LOGIN_TERMS_COMPONENT_CLASS_TOKEN } from './login.service';
import { type Maybe } from '@dereekb/util';
import { DBX_FIREBASE_LOGIN_TERMS_OF_SERVICE_URLS_CONFIG, type DbxFirebaseLoginTermsOfServiceUrlsConfig } from './login.terms';
import { defaultFirebaseAuthLoginProvidersFactory } from './firebase.login.providers.default';

/**
 * Configuration for provideDbxFirebaseLogin().
 */
export interface ProvideDbxFirebaseLoginConfig {
  /**
   * DbxFirebaseLoginTermsOfServiceUrlsConfig configuration.
   */
  readonly termsOfServiceUrls: DbxFirebaseLoginTermsOfServiceUrlsConfig;

  /**
   * Enabled login methods. Set to true to enable all methods.
   */
  readonly enabledLoginMethods: FirebaseLoginMethodType[] | true;

  /**
   * Configures the default login terms component class via DEFAULT_FIREBASE_AUTH_LOGIN_TERMS_COMPONENT_CLASS_TOKEN.
   */
  readonly loginTermsComponentClass?: Type<unknown>;

  /**
   * Optional password configuration.
   */
  readonly passwordConfig?: DbxFirebaseAuthLoginPasswordConfig;

  /**
   * Providers to register ALONGSIDE the library defaults — a custom login method (a third-party
   * OAuth provider bridged through a custom token, say) that the default catalog has no entry for.
   *
   * This is the right home for them because `firebase.login.providers.default.ts` is not re-exported
   * from the login barrel, so an app cannot compose onto the default array from outside; and a manual
   * `register()` in an app initializer races the `enable()` initializer below.
   *
   * Deliberately NOT part of the environment file's `Pick<>` shape — this carries component classes,
   * which are code, not configuration.
   */
  readonly additionalProviders?: Maybe<DbxFirebaseAuthLoginProvider[]>;
}

/**
 * Creates EnvironmentProviders for providing DbxFirebaseLogin configuration.
 *
 * @param config - Configuration.
 * @returns EnvironmentProviders.
 */
export function provideDbxFirebaseLogin(config: ProvideDbxFirebaseLoginConfig): EnvironmentProviders {
  const { termsOfServiceUrls: loginTerms, enabledLoginMethods, loginTermsComponentClass, passwordConfig, additionalProviders } = config;

  const providers: (EnvironmentProviders | Provider)[] = [
    // Default login providers
    {
      provide: DEFAULT_FIREBASE_AUTH_LOGIN_PROVIDERS_TOKEN,
      // the app's own providers go LAST: the service registers this array with `override: false`, so
      // an app entry for a type the defaults also carry would be dropped rather than winning — which
      // is the existing contract, and additional providers are additions, not replacements
      useFactory: () => [...defaultFirebaseAuthLoginProvidersFactory(), ...(additionalProviders ?? [])]
    },
    // Config for terms
    {
      provide: DBX_FIREBASE_LOGIN_TERMS_OF_SERVICE_URLS_CONFIG,
      useValue: loginTerms
    },
    DbxFirebaseAuthLoginService,
    // service initialization
    provideAppInitializer(() => {
      const dbxFirebaseAuthLoginService = inject(DbxFirebaseAuthLoginService);
      if (enabledLoginMethods === true) {
        dbxFirebaseAuthLoginService.setEnableAll();
      } else {
        dbxFirebaseAuthLoginService.enable(enabledLoginMethods);
      }
    })
  ];

  // Terms component
  if (loginTermsComponentClass) {
    providers.push({
      provide: DEFAULT_FIREBASE_AUTH_LOGIN_TERMS_COMPONENT_CLASS_TOKEN,
      useValue: loginTermsComponentClass
    });
  }

  // Password config
  if (passwordConfig) {
    providers.push({
      provide: DEFAULT_FIREBASE_AUTH_LOGIN_PASSWORD_CONFIG_TOKEN,
      useValue: passwordConfig
    });
  }

  return makeEnvironmentProviders(providers);
}
