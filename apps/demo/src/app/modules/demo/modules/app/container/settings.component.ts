import { Component, inject } from '@angular/core';
import { DbxContentLayoutModule, DbxSectionPageComponent, DbxSectionComponent, DbxLabelBlockComponent, DbxButtonComponent } from '@dereekb/dbx-web';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';
import { AsyncPipe, JsonPipe } from '@angular/common';

@Component({
  templateUrl: './settings.component.html',
  imports: [JsonPipe, AsyncPipe, DbxContentLayoutModule, DbxSectionPageComponent, DbxSectionComponent, DbxLabelBlockComponent, DbxButtonComponent],
  standalone: true
})
export class DemoAppSettingsComponent {
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);

  readonly currentIdTokenString$ = this.dbxFirebaseAuthService.currentIdTokenString$;
  readonly idTokenResult$ = this.dbxFirebaseAuthService.idTokenResult$;

  refreshToken() {
    this.dbxFirebaseAuthService.refreshToken();
  }
}
