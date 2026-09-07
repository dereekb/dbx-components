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
 * ## How link/unlink work here
 *
 * NOT through the Firebase SDK's own `linkWithPopup` and its inverse. A custom-token sign-in produces
 * a Firebase user with NO `providerData` entry — there is no Firebase provider behind it — so the base
 * implementations have nothing to act on and `LOGIN_METHOD_TYPE_TO_FIREBASE_PROVIDER_ID_MAP` has no
 * entry to resolve.
 *
 * Both are overridden onto the external-connection service instead: linking runs a second OAuth round
 * trip in `link` mode, which writes the account's login link server-side; the inverse calls the server
 * and removes it. To a user these mean exactly what they mean for Google, which is why these providers
 * belong in the same list rather than being excluded from it.
 *
 * Distinct from the CONNECT row `DbxFirebaseExternalConnectionsComponent` renders for the same
 * provider: that manages the DATA connection, whose credentials can expire and be revoked
 * independently of whether the provider is still a way to sign in.
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

  /**
   * Links the provider as a login method by starting the `link` OAuth handoff.
   *
   * @returns Resolves once the authorize page is opening.
   */
  override handleLink(): Promise<unknown> {
    return this.dbxFirebaseExternalConnectionService.linkProvider(this.providerType);
  }

  /**
   * Removes the provider as a login method.
   *
   * @returns Resolves once the server has applied the change.
   */
  override handleUnlink(): Promise<unknown> {
    return this.dbxFirebaseExternalConnectionService.unlinkProvider(this.providerType);
  }
}
