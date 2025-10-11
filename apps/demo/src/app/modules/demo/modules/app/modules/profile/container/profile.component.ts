import { OnInit, Component, inject } from '@angular/core';
import { WorkUsingContext, IsModifiedFunction, loadingStateContext } from '@dereekb/rxjs';
import { DbxFirebaseAuthService, DbxFirebaseStorageFileUploadModule, DbxFirebaseStorageService, StorageFileUploadConfig, storageFileUploadHandler, StorageFileUploadHandler } from '@dereekb/dbx-firebase';
import { first, map } from 'rxjs';
import { DemoProfileFormComponent, DemoProfileFormValue, DemoProfileUsernameFormComponent, DemoProfileUsernameFormValue, ProfileDocumentStore } from 'demo-components';
import { DbxActionErrorDirective, DbxActionModule, DbxAvatarComponent, DbxButtonModule, DbxContentBoxDirective, DbxErrorComponent, DbxLabelBlockComponent, DbxLoadingComponent, DbxLoadingProgressComponent, DbxSectionComponent, DbxSectionLayoutModule } from '@dereekb/dbx-web';
import { DbxActionFormDirective, DbxFormSourceDirective } from '@dereekb/dbx-form';
import { AsyncPipe } from '@angular/common';
import { userAvatarUploadsFilePath } from 'demo-firebase';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  templateUrl: './profile.component.html',
  providers: [ProfileDocumentStore],
  imports: [DbxLoadingProgressComponent, DemoProfileUsernameFormComponent, DemoProfileFormComponent, DbxSectionLayoutModule, DbxActionFormDirective, DbxFormSourceDirective, AsyncPipe, DbxLoadingComponent, DbxContentBoxDirective, DbxSectionComponent, DemoProfileUsernameFormComponent, DbxButtonModule, DbxActionModule, DbxErrorComponent, DbxActionErrorDirective, DbxFirebaseStorageFileUploadModule, DbxLabelBlockComponent, DbxAvatarComponent, DbxLoadingProgressComponent],
  standalone: true
})
export class DemoProfileViewComponent implements OnInit {
  readonly profileDocumentStore = inject(ProfileDocumentStore);

  readonly auth = inject(DbxFirebaseAuthService);
  readonly userIdentifier$ = this.auth.userIdentifier$;
  readonly userIdentifierSignal = toSignal(this.userIdentifier$, { requireSync: true });

  readonly storageService = inject(DbxFirebaseStorageService);

  readonly avatarUploadHandler: StorageFileUploadHandler = storageFileUploadHandler({
    storageService: this.storageService,
    storageFileUploadConfigFactory: (file: File): StorageFileUploadConfig => {
      const uid = this.userIdentifierSignal();
      const storagePath = userAvatarUploadsFilePath(uid);

      return {
        storagePath
      };
    }
  });

  readonly profileData$ = this.profileDocumentStore.data$;
  readonly avatarUrl$ = this.profileData$.pipe(map((x) => x.avatar));
  readonly username$ = this.profileData$.pipe(map((x) => x.username));

  readonly avatarUrlSignal = toSignal(this.avatarUrl$);

  readonly context = loadingStateContext({ obs: this.profileDocumentStore.dataLoadingState$ });

  ngOnInit(): void {
    this.profileDocumentStore.setId(this.auth.userIdentifier$);
  }

  readonly isUsernameModified: IsModifiedFunction<DemoProfileUsernameFormValue> = (value) => {
    return this.profileDocumentStore.currentData$.pipe(
      map((profileData) => {
        if (profileData) {
          return profileData.username !== value.username;
        } else {
          return true;
        }
      }),
      first()
    );
  };

  readonly isProfileModified: IsModifiedFunction<DemoProfileFormValue> = (value) => {
    return this.profileDocumentStore.currentData$.pipe(
      map((profileData) => {
        if (profileData) {
          return profileData.bio !== value.bio;
        } else {
          return true;
        }
      }),
      first()
    );
  };

  readonly handleChangeUsername: WorkUsingContext<DemoProfileUsernameFormValue> = (form, context) => {
    context.startWorkingWithLoadingStateObservable(this.profileDocumentStore.updateProfileUsername(form));
  };

  readonly handleUpdateProfile: WorkUsingContext<DemoProfileFormValue> = (form, context) => {
    context.startWorkingWithLoadingStateObservable(this.profileDocumentStore.updateProfile(form));
  };
}
