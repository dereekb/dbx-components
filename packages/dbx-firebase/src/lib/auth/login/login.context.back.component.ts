import { type ClickableAnchor } from '@dereekb/dbx-core';
import { Component, output } from '@angular/core';
import { DbxRouterAnchorModule } from '@dereekb/dbx-web';

/**
 * Navigation component that allows users to return to the login method selection list.
 */
@Component({
  selector: 'dbx-firebase-login-context-back-button',
  standalone: true,
  imports: [DbxRouterAnchorModule],
  template: `
    <dbx-link [anchor]="anchor">Choose other login method.</dbx-link>
  `
})
export class DbxFirebaseLoginContextBackButtonComponent {
  readonly cancelLogin = output<void>();

  readonly anchor: ClickableAnchor = {
    onClick: () => this.cancelLogin.emit()
  };
}
