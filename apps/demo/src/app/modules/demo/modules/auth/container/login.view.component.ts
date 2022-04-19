import { Component } from '@angular/core';
import { DbxFirebaseLoginMode } from '@dereekb/dbx-firebase';

@Component({
  selector: 'demo-login-view',
  templateUrl: './login.view.component.html'
})
export class DemoAuthLoginViewComponent {

  mode: DbxFirebaseLoginMode = 'login';

}
