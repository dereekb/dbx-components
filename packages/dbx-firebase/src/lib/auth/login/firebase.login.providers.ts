import { APP_INITIALIZER, EnvironmentProviders, Provider, Type, makeEnvironmentProviders } from '@angular/core';
import { FirebaseLoginMethodType } from './login';
import { DbxFirebaseAuthLoginPasswordConfig } from './login.password';
import { DbxFirebaseAuthLoginService, DEFAULT_FIREBASE_AUTH_LOGIN_PASSWORD_CONFIG_TOKEN, DEFAULT_FIREBASE_AUTH_LOGIN_PROVIDERS_TOKEN, DEFAULT_FIREBASE_AUTH_LOGIN_TERMS_COMPONENT_CLASS_TOKEN } from './login.service';
import { DBX_FIREBASE_LOGIN_TERMS_OF_SERVICE_URLS_CONFIG, DbxFirebaseLoginTermsOfServiceUrlsConfig } from './login.terms';
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
}

/**
 * Creates EnvironmentProviders for providing DbxFirebaseLogin configuration.
 *
 * @param config Configuration
 * @returns EnvironmentProviders
 */
export function provideDbxFirebaseLogin(config: ProvideDbxFirebaseLoginConfig): EnvironmentProviders {
  const { termsOfServiceUrls: loginTerms, enabledLoginMethods, loginTermsComponentClass, passwordConfig } = config;

  const providers: Provider[] = [
    // Default login providers
    {
      provide: DEFAULT_FIREBASE_AUTH_LOGIN_PROVIDERS_TOKEN,
      useFactory: defaultFirebaseAuthLoginProvidersFactory
    },
    // Config for terms
    {
      provide: DBX_FIREBASE_LOGIN_TERMS_OF_SERVICE_URLS_CONFIG,
      useValue: loginTerms
    },
    // service initialization
    {
      provide: APP_INITIALIZER,
      useFactory: (dbxFirebaseAuthLoginService: DbxFirebaseAuthLoginService) => {
        // initialize the scheduler
        if (enabledLoginMethods === true) {
          dbxFirebaseAuthLoginService.setEnableAll();
        } else {
          dbxFirebaseAuthLoginService.enable(enabledLoginMethods);
        }
      },
      deps: [DbxFirebaseAuthLoginService],
      multi: true
    }
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
