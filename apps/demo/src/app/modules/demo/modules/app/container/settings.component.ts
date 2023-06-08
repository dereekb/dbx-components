import { Component } from '@angular/core';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';

@Component({
  templateUrl: './settings.component.html'
})
export class DemoAppSettingsComponent {
  readonly currentIdTokenString$ = this.dbxFirebaseAuthService.currentIdTokenString$;
  readonly idTokenResult$ = this.dbxFirebaseAuthService.idTokenResult$;

  constructor(readonly dbxFirebaseAuthService: DbxFirebaseAuthService) {}

  refreshToken() {
    this.dbxFirebaseAuthService.refreshToken();
  }
}
