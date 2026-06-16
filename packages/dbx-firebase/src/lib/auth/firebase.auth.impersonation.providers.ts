import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { type ProvideDbxAuthImpersonationConfig, provideDbxAuthImpersonation } from '@dereekb/dbx-core';
import { DbxFirebaseAuthImpersonationDelegate } from './service/firebase.auth.impersonation.delegate';

/**
 * Configuration for {@link provideDbxFirebaseAuthImpersonation}. Mirrors {@link ProvideDbxAuthImpersonationConfig}
 * but the impersonation details delegate is wired automatically to {@link DbxFirebaseAuthImpersonationDelegate}.
 */
export type ProvideDbxFirebaseAuthImpersonationConfig = Omit<ProvideDbxAuthImpersonationConfig, 'delegateType'>;

/**
 * Enables the impersonation ("view as another user") feature for a Firebase app.
 *
 * Registers the {@link DbxFirebaseAuthImpersonationDelegate} (which loads details via the app's configured
 * {@link DbxFirebaseAuthServiceDelegate.loadImpersonationAuthDetails}) and the dbx-core impersonation feature.
 *
 * @param config - Optional configuration forwarded to {@link provideDbxAuthImpersonation}.
 * @returns Angular `EnvironmentProviders` for the Firebase impersonation feature.
 */
export function provideDbxFirebaseAuthImpersonation(config?: ProvideDbxFirebaseAuthImpersonationConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideDbxAuthImpersonation({ ...config, delegateType: DbxFirebaseAuthImpersonationDelegate }) //
  ]);
}
