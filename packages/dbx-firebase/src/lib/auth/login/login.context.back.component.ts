import { ClickableAnchor } from '@dereekb/dbx-core';
import { Component, EventEmitter, output, Output } from '@angular/core';
import { DbxRouterAnchorModule } from '@dereekb/dbx-web';

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
