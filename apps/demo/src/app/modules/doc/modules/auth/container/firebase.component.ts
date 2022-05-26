import { Component } from '@angular/core';
import { DbxFirebaseAuthLoginService, DbxFirebaseAuthService } from '@dereekb/dbx-firebase';

@Component({
  templateUrl: './firebase.component.html'
})
export class DocAuthFirebaseComponent {
  readonly authUserInfo$ = this.dbxFirebaseAuthService.currentAuthUserInfo$;

  constructor(readonly dbxFirebaseAuthLoginService: DbxFirebaseAuthLoginService, readonly dbxFirebaseAuthService: DbxFirebaseAuthService) {}

  logOut() {
    this.dbxFirebaseAuthService.logOut();
  }
}
