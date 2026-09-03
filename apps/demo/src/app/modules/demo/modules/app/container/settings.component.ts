import { Component, inject } from '@angular/core';
import { DbxContentLayoutModule, DbxSectionPageComponent, DbxSectionComponent, DbxLabelBlockComponent, DbxButtonComponent } from '@dereekb/dbx-web';
import { DbxFirebaseAuthService, DbxFirebaseStorageService, DbxFirebaseExternalConnectionsComponent, DbxFirebaseManageAuthProvidersComponent, DbxFirebaseNotificationHealthCheckDialogButtonComponent, DbxFirebaseNotificationUserDocumentStoreDirective } from '@dereekb/dbx-firebase';
import { JsonPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { makeUserAvatarFileStoragePath } from 'demo-firebase';
import { map, of, switchMap } from 'rxjs';

@Component({
  templateUrl: './settings.component.html',
  imports: [JsonPipe, DbxContentLayoutModule, DbxSectionPageComponent, DbxSectionComponent, DbxLabelBlockComponent, DbxButtonComponent, DbxFirebaseExternalConnectionsComponent, DbxFirebaseManageAuthProvidersComponent, DbxFirebaseNotificationHealthCheckDialogButtonComponent, DbxFirebaseNotificationUserDocumentStoreDirective]
})
export class DemoAppSettingsComponent {
  readonly storageService = inject(DbxFirebaseStorageService);

  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);

  // currentUid$ rather than userIdentifier$: this page is dbxAppContextState="public", so a signed-out
  // visitor genuinely reaches it, and userIdentifier$ would substitute NO_AUTH_USER_IDENTIFIER ('0')
  // and ask Firestore for nu/0.
  readonly uidSignal = toSignal(this.dbxFirebaseAuthService.currentUid$);

  readonly file$ = this.dbxFirebaseAuthService.currentUid$.pipe(map((uid) => (uid ? this.storageService.file(makeUserAvatarFileStoragePath(uid)) : undefined)));
  readonly avatarUrlSignal$ = this.file$.pipe(switchMap((file) => (file ? file.getDownloadUrl() : of(undefined))));

  readonly avatarUrlSignal = toSignal(this.avatarUrlSignal$);

  readonly currentIdTokenStringSignal = toSignal(this.dbxFirebaseAuthService.currentIdTokenString$);
  readonly idTokenResultSignal = toSignal(this.dbxFirebaseAuthService.idTokenResult$);

  refreshToken() {
    void this.dbxFirebaseAuthService.refreshToken();
  }
}
