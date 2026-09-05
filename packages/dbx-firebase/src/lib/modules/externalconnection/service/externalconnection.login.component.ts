import { Component, inject } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION } from '../../../auth/login/login.button.component';
import { type FirebaseLoginMethodType } from '../../../auth/login/login';
import { DbxFirebaseExternalConnectionService } from './externalconnection.service';

/**
 * The `componentData` an external-connection login provider registers with.
 *
 * The only thing the shared button below cannot read from the login registry: which external
 * connection provider it is rendering. `loginMethodType` usually IS the provider type, but an app may
 * register under a different one, so it is carried explicitly rather than inferred.
 */
export interface DbxFirebaseLoginExternalConnectionComponentData {
  readonly providerType: UserExternalConnectionProviderType;
}

/**
 * The login button for a third-party provider that is NOT a Firebase auth provider.
 *
 * ONE component class for every such provider, not one per provider like Google or Apple: those each
 * construct a different `firebase/auth` provider class, which is code; here the only per-provider
 * variation is a url and some brand colors, which is data. The provider it is rendering arrives as
 * `componentData`.
 *
 * ## Why there is no link/unlink here
 *
 * A custom-token sign-in produces a Firebase user with NO `providerData` entry — there is no Firebase
 * provider behind it — so `handleUnlink()` has nothing to unlink and
 * `LOGIN_METHOD_TYPE_TO_FIREBASE_PROVIDER_ID_MAP` has no entry to resolve. These providers are
 * therefore registered with `allowLinking: false`, which keeps them out of the link/unlink list
 * entirely.
 *
 * That is not a gap: managing a third-party identity is the CONNECT flow's job, on the settings page,
 * where `DbxFirebaseExternalConnectionsComponent` already renders a connect/disconnect row for the
 * same provider. Sign-in and account management are the two directions of one system, and each has
 * exactly one surface.
 */
@Component({
  selector: 'dbx-firebase-login-external-connection',
  imports: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.imports,
  template: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.template
})
export class DbxFirebaseLoginExternalConnectionComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {
  readonly dbxFirebaseExternalConnectionService = inject(DbxFirebaseExternalConnectionService);

  /**
   * The external connection provider this button signs in with.
   *
   * @returns The provider type from the registered `componentData`.
   * @throws {Error} When the component was rendered without it — a registration mistake, and one that
   *   would otherwise surface as a redirect to an unrelated provider.
   */
  get providerType(): UserExternalConnectionProviderType {
    const componentData = this.injectedComponentData as Maybe<DbxFirebaseLoginExternalConnectionComponentData>;

    if (!componentData?.providerType) {
      throw new Error('DbxFirebaseLoginExternalConnectionComponent was rendered with no providerType in its componentData.');
    }

    return componentData.providerType;
  }

  get loginProvider(): FirebaseLoginMethodType {
    return this.providerType;
  }

  handleLogin(): Promise<unknown> {
    return this.dbxFirebaseExternalConnectionService.signInWithProvider(this.providerType);
  }
}
