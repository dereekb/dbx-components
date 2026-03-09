import { Component } from '@angular/core';
import { type DbxFirebaseLoginMode, DbxFirebaseLoginComponent, DbxFirebaseLoginTermsComponent, DbxFirebaseRegisterComponent } from '@dereekb/dbx-firebase';

import { DbxLinkComponent } from '@dereekb/dbx-web';

@Component({
  selector: 'demo-login-view',
  templateUrl: './login.view.component.html',
  standalone: true,
  imports: [DbxFirebaseLoginComponent, DbxLinkComponent, DbxFirebaseLoginTermsComponent, DbxFirebaseRegisterComponent]
})
export class DemoAuthLoginViewComponent {
  mode: DbxFirebaseLoginMode = 'login';
}
