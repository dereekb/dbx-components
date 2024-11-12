import { Component, inject } from '@angular/core';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';

@Component({
  templateUrl: './settings.component.html'
})
export class DemoAppSettingsComponent {
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);

  readonly currentIdTokenString$ = this.dbxFirebaseAuthService.currentIdTokenString$;
  readonly idTokenResult$ = this.dbxFirebaseAuthService.idTokenResult$;

  refreshToken() {
    this.dbxFirebaseAuthService.refreshToken();
  }
}
