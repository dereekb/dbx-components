import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DbxContentLayoutModule, DbxSectionPageComponent, DbxSectionComponent, DbxLabelBlockComponent, DbxButtonComponent } from '@dereekb/dbx-web';
import { DbxFirebaseAuthService, DbxFirebaseStorageService } from '@dereekb/dbx-firebase';
import { JsonPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { makeUserAvatarFileStoragePath } from 'demo-firebase';
import { map, switchMap } from 'rxjs';

@Component({
  templateUrl: './settings.component.html',
  imports: [JsonPipe, DbxContentLayoutModule, DbxSectionPageComponent, DbxSectionComponent, DbxLabelBlockComponent, DbxButtonComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoAppSettingsComponent {
  readonly storageService = inject(DbxFirebaseStorageService);

  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);

  readonly uidSignal = toSignal(this.dbxFirebaseAuthService.userIdentifier$);

  readonly file$ = this.dbxFirebaseAuthService.userIdentifier$.pipe(map((uid) => this.storageService.file(makeUserAvatarFileStoragePath(uid))));
  readonly avatarUrlSignal$ = this.file$.pipe(switchMap((file) => file?.getDownloadUrl()));

  readonly avatarUrlSignal = toSignal(this.avatarUrlSignal$);

  readonly currentIdTokenStringSignal = toSignal(this.dbxFirebaseAuthService.currentIdTokenString$);
  readonly idTokenResultSignal = toSignal(this.dbxFirebaseAuthService.idTokenResult$);

  refreshToken() {
    this.dbxFirebaseAuthService.refreshToken();
  }
}
