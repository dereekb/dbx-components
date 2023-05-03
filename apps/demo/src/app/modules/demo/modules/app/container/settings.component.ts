import { Component } from '@angular/core';
import { DbxFirebaseModelTrackerHistoryFilter, DbxFirebaseModelTrackerService, DbxFirebaseAuthService } from '@dereekb/dbx-firebase';
import { loadingStateFromObs } from '@dereekb/rxjs';

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
