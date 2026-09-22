import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { cleanSubscription } from '@dereekb/dbx-core';
import { filter, first, of } from 'rxjs';
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION } from './login.button.component';
import { DbxFirebaseLoginEmailContentComponent } from './login.email.content.component';
import { DbxFirebaseLoginPrefillStore } from './login.prefill.store';

/**
 * Login button component for email/password authentication. Opens the email login context on click.
 *
 * When a {@link DbxFirebaseLoginPrefillDirective} is present the button seeds the opened form from its prefill, and
 * opens the form on its own unless the prefill was configured not to.
 */
@Component({
  selector: 'dbx-firebase-login-email',
  imports: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.imports,
  template: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.template
})
export class DbxFirebaseLoginEmailComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {
  readonly loginProvider = 'email';

  private readonly _prefillStore = inject(DbxFirebaseLoginPrefillStore, { optional: true });

  readonly prefillSignal = toSignal(this._prefillStore?.prefill$ ?? of(undefined));

  constructor() {
    super();

    const prefillStore = this._prefillStore;

    if (prefillStore != null && this.effectiveLoginMode === 'login') {
      cleanSubscription(
        prefillStore.shouldOpenPrefill$
          .pipe(
            filter((shouldOpen) => shouldOpen),
            first()
          )
          .subscribe(() => {
            prefillStore.markOpened();
            this.handleLogin().catch(() => {
              // The opened view reports its own errors, and there is no button action state to reject here.
            });
          })
      );
    }
  }

  handleLogin() {
    const prefill = this.prefillSignal();

    return DbxFirebaseLoginEmailContentComponent.openEmailLoginContext(this.dbxFirebaseLoginContext, {
      loginMode: 'login',
      passwordConfig: this.dbxFirebaseAuthLoginService.getPasswordConfig(),
      passwordResetAnchor: this.dbxFirebaseAuthLoginService.getPasswordResetAnchor(),
      defaultValue: prefill ? { username: prefill.email ?? '', password: prefill.password ?? '' } : undefined
    });
  }
}
