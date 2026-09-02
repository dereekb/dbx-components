import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { type DbxFirebaseLoginMode, DbxFirebaseLoginComponent, DbxFirebaseLoginTermsComponent, DbxFirebaseRegisterComponent } from '@dereekb/dbx-firebase';

import { DbxLinkComponent } from '@dereekb/dbx-web';

@Component({
  selector: 'app-login-view',
  templateUrl: './login.view.component.html',
  imports: [DbxFirebaseLoginComponent, DbxLinkComponent, DbxFirebaseLoginTermsComponent, DbxFirebaseRegisterComponent]
})
export class DemoAuthLoginViewComponent {
  readonly mode = signal<DbxFirebaseLoginMode>('login');
}
