import { filterMaybeArrayValues, type Maybe } from '@dereekb/util';
import { type DbxFirebaseAuthLoginProvider } from '../../../auth/login/login.service';
import { type DbxFirebaseExternalConnectionProvider, type DbxFirebaseExternalConnectionProviderEntry } from './externalconnection';
import { dbxFirebaseExternalConnectionProviderForEntry } from './externalconnection.default';
import { DbxFirebaseLoginExternalConnectionComponent, type DbxFirebaseLoginExternalConnectionComponentData } from './externalconnection.login.component';

/**
 * The login category external-connection sign-in providers register under.
 *
 * `oauth`, the same category the Firebase-native federated providers use: to a user, "Log in with
 * Discord" and "Log in with Google" are the same affordance, and a login list filtering by category
 * should show them together.
 */
export const DBX_FIREBASE_EXTERNAL_CONNECTION_LOGIN_CATEGORY = 'oauth';

/**
 * Derives the {@link DbxFirebaseAuthLoginProvider} for an external-connection provider that declares
 * a `signIn` config.
 *
 * DERIVED rather than declared separately so the login button and the settings row can never disagree
 * about which providers exist — there is one registration, and this projects it onto the login
 * registry.
 *
 * `allowLinking: false` is not a limitation but the design: a custom-token user has no
 * `providerData` entry to link or unlink, and managing the identity is the connect flow's job. See
 * {@link DbxFirebaseLoginExternalConnectionComponent}.
 *
 * `registrationComponentClass` is the same component: "Sign up with Discord" and "Log in with
 * Discord" are one button pressed by users in two situations, and the server resolves which it is.
 *
 * @param provider - The external connection provider to derive from.
 * @returns The login provider, or null when the provider declares no `signIn`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function dbxFirebaseExternalConnectionLoginProvider(provider: DbxFirebaseExternalConnectionProvider): Maybe<DbxFirebaseAuthLoginProvider<DbxFirebaseLoginExternalConnectionComponentData>> {
  const { providerType, signIn, assets } = provider;
  let result: Maybe<DbxFirebaseAuthLoginProvider<DbxFirebaseLoginExternalConnectionComponentData>>;

  if (signIn) {
    result = {
      category: DBX_FIREBASE_EXTERNAL_CONNECTION_LOGIN_CATEGORY,
      loginMethodType: signIn.loginMethodType ?? providerType,
      componentClass: DbxFirebaseLoginExternalConnectionComponent,
      registrationComponentClass: DbxFirebaseLoginExternalConnectionComponent,
      allowLinking: false,
      componentData: { providerType },
      assets: {
        providerName: assets.providerName,
        loginText: signIn.loginText ?? `Log in with ${assets.providerName}`,
        loginIcon: signIn.loginIcon ?? assets.icon ?? undefined,
        logoUrl: assets.logoUrl ?? undefined,
        logoFilter: assets.logoFilter ?? undefined,
        backgroundColor: signIn.backgroundColor ?? undefined,
        textColor: signIn.textColor ?? undefined
      }
    };
  }

  return result;
}

/**
 * Derives the login providers for every entry that declares a `signIn` config.
 *
 * @param entries - The app's external-connection provider entries.
 * @returns The derived login providers, in the order the entries were declared.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function dbxFirebaseExternalConnectionLoginProviders(entries: DbxFirebaseExternalConnectionProviderEntry[]): DbxFirebaseAuthLoginProvider<DbxFirebaseLoginExternalConnectionComponentData>[] {
  return filterMaybeArrayValues(entries.map((x) => dbxFirebaseExternalConnectionLoginProvider(dbxFirebaseExternalConnectionProviderForEntry(x))));
}
