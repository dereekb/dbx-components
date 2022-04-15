import { AUTH_APP_USER_ROLE } from '@dereekb/dbx-core';
import { Component } from '@angular/core';
import { DbxFirebaseAuthLoginService } from '@dereekb/dbx-firebase';

@Component({
  templateUrl: './firebase.component.html'
})
export class DocAuthFirebaseComponent {

  constructor(readonly dbxFirebaseAuthLoginService: DbxFirebaseAuthLoginService) { }

}
