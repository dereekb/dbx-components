import { Component, computed, inject } from '@angular/core';
import { DbxContentLayoutModule, DbxSectionPageComponent, DbxSectionComponent, DbxLabelBlockComponent, DbxButtonComponent, DbxFileUploadComponent } from '@dereekb/dbx-web';
import { DbxFirebaseAuthService, DbxFirebaseStorageFileDocumentStoreDirective, DbxFirebaseStorageService } from '@dereekb/dbx-firebase';
import { AsyncPipe, JsonPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { userAvatarFileStoragePath } from 'demo-firebase';
import { map, switchMap } from 'rxjs';

@Component({
  templateUrl: './settings.component.html',
  imports: [JsonPipe, AsyncPipe, DbxContentLayoutModule, DbxSectionPageComponent, DbxSectionComponent, DbxLabelBlockComponent, DbxButtonComponent, DbxFileUploadComponent, DbxFirebaseStorageFileDocumentStoreDirective],
  standalone: true
})
export class DemoAppSettingsComponent {
  readonly storageService = inject(DbxFirebaseStorageService);

  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);

  readonly uidSignal = toSignal(this.dbxFirebaseAuthService.userIdentifier$);

  readonly file$ = this.dbxFirebaseAuthService.userIdentifier$.pipe(map((uid) => this.storageService.file(userAvatarFileStoragePath(uid))));
  readonly avatarUrlSignal$ = this.file$.pipe(switchMap((file) => file?.getDownloadUrl()));

  readonly avatarUrlSignal = toSignal(this.avatarUrlSignal$);

  readonly currentIdTokenString$ = this.dbxFirebaseAuthService.currentIdTokenString$;
  readonly idTokenResult$ = this.dbxFirebaseAuthService.idTokenResult$;

  refreshToken() {
    this.dbxFirebaseAuthService.refreshToken();
  }
}
