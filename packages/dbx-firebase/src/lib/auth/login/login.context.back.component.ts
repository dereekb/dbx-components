import { ClickableAnchor } from '@dereekb/dbx-core';
import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'dbx-firebase-login-context-back-button',
  template: `
    <dbx-link [anchor]="anchor">Choose other login method.</dbx-link>
  `
})
export class DbxFirebaseLoginContextBackButtonComponent {
  @Output()
  readonly cancelLogin = new EventEmitter<void>();

  readonly anchor: ClickableAnchor = {
    onClick: () => this.cancelLogin.emit()
  };
}
