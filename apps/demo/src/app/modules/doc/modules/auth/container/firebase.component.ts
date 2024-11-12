import { Component, inject } from '@angular/core';
import { DbxFirebaseAuthLoginService, DbxFirebaseAuthService } from '@dereekb/dbx-firebase';

@Component({
  templateUrl: './firebase.component.html'
})
export class DocAuthFirebaseComponent {
  readonly dbxFirebaseAuthLoginService = inject(DbxFirebaseAuthLoginService);
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);

  readonly authUserInfo$ = this.dbxFirebaseAuthService.currentAuthUserInfo$;

  logOut() {
    this.dbxFirebaseAuthService.logOut();
  }
}
