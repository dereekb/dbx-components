import { ChangeDetectionStrategy, type OnInit, Component, inject } from '@angular/core';
import { type WorkUsingContext, type IsModifiedFunction, loadingStateContext } from '@dereekb/rxjs';
import {
  DbxFirebaseAuthService,
  type DbxFirebaseStorageFileUploadFileModifier,
  dbxFirebaseStorageFileImageCompressionFileModifier,
  DbxFirebaseStorageFileDownloadButtonComponent,
  type DbxFirebaseStorageFileDownloadButtonConfig,
  type DbxFirebaseStorageFileDownloadButtonSource,
  dbxFirebaseStorageFileDownloadServiceCustomSourceFromObs,
  DbxFirebaseStorageFileUploadModule,
  DbxFirebaseStorageService,
  type StorageFileUploadConfig,
  storageFileUploadHandler,
  type StorageFileUploadHandler
} from '@dereekb/dbx-firebase';
import { first, map } from 'rxjs';
import { DemoProfileFormComponent, type DemoProfileFormValue, DemoProfileUsernameFormComponent, type DemoProfileUsernameFormValue, ProfileDocumentStore } from 'demo-components';
import { DbxActionErrorDirective, DbxActionModule, DbxAvatarComponent, DbxButtonModule, DbxContentBoxDirective, DbxErrorComponent, DbxLabelBlockComponent, DbxLoadingComponent, DbxLoadingProgressComponent, DbxSectionComponent, DbxSectionLayoutModule } from '@dereekb/dbx-web';
import { DbxActionFormDirective, DbxFormSourceDirective } from '@dereekb/dbx-form';
import { ProfileResumeState, USER_RESUME_FILE_UPLOADS_MAX_FILE_SIZE_BYTES, userAvatarUploadsFilePath, userResumeFileUploadsFilePath } from 'demo-firebase';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxAppEnvironmentService, type DbxActionSuccessHandlerFunction, TimeDistancePipe } from '@dereekb/dbx-core';
import { type SlashPathFile, isSlashPathFile } from '@dereekb/util';

/**
 * Fallback name for an upload whose own name is not usable as a path part.
 */
const DEFAULT_DEMO_PROFILE_RESUME_FILENAME: SlashPathFile = 'resume.pdf';

/**
 * The signed-in user's own profile page.
 *
 * @dbxRouteModel profile {authUid} - The signed-in user's profile
 */
@Component({
  templateUrl: './profile.component.html',
  providers: [ProfileDocumentStore],
  imports: [
    TimeDistancePipe,
    DbxLoadingProgressComponent,
    DemoProfileUsernameFormComponent,
    DemoProfileFormComponent,
    DbxSectionLayoutModule,
    DbxActionFormDirective,
    DbxFormSourceDirective,
    DbxLoadingComponent,
    DbxContentBoxDirective,
    DbxSectionComponent,
    DemoProfileUsernameFormComponent,
    DbxButtonModule,
    DbxActionModule,
    DbxErrorComponent,
    DbxActionErrorDirective,
    DbxFirebaseStorageFileUploadModule,
    DbxLabelBlockComponent,
    DbxAvatarComponent,
    DbxLoadingProgressComponent,
    DbxFirebaseStorageFileDownloadButtonComponent
  ],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoProfileViewComponent implements OnInit {
  readonly environmentService = inject(DbxAppEnvironmentService);
  readonly profileDocumentStore = inject(ProfileDocumentStore);

  readonly auth = inject(DbxFirebaseAuthService);
  readonly userIdentifier$ = this.auth.userIdentifier$;
  readonly userIdentifierSignal = toSignal(this.userIdentifier$, { requireSync: true });

  readonly avatarDownloadButtonConfig: DbxFirebaseStorageFileDownloadButtonConfig = {
    text: 'Start Avatar Download',
    downloadReadyText: 'Save Avatar'
  };

  readonly archiveDownloadButtonConfig: DbxFirebaseStorageFileDownloadButtonConfig = {
    text: 'Start Archive Download',
    downloadReadyText: 'Save Archive'
  };

  readonly archiveDownloadSource: DbxFirebaseStorageFileDownloadButtonSource = {
    storageFileKey: this.profileDocumentStore.zipArchiveStorageFileKey$,
    customSource: dbxFirebaseStorageFileDownloadServiceCustomSourceFromObs((x) => this.profileDocumentStore.downloadArchive({ ...x, key: undefined }))
  };

  readonly storageService = inject(DbxFirebaseStorageService);

  readonly avatarUploadHandler: StorageFileUploadHandler = storageFileUploadHandler({
    storageService: this.storageService,
    storageFileUploadConfigFactory: (_file: File): StorageFileUploadConfig => {
      const uid = this.userIdentifierSignal();
      const storagePath = userAvatarUploadsFilePath(uid);

      return {
        storagePath
      };
    }
  });

  readonly resumeMaxFileSizeKb = USER_RESUME_FILE_UPLOADS_MAX_FILE_SIZE_BYTES / 1024;

  /**
   * The template cannot reach module scope, so the enum it switches on is exposed here.
   */
  readonly profileResumeState = ProfileResumeState;

  readonly resumeUploadHandler: StorageFileUploadHandler = storageFileUploadHandler({
    storageService: this.storageService,
    storageFileUploadConfigFactory: (file: File): StorageFileUploadConfig => {
      const uid = this.userIdentifierSignal();
      // The uploads folder is what the API matches on to pick the resume initializer, and the name is
      // carried all the way to OpenRouter as the attachment's filename.
      const filename = isSlashPathFile(file.name) ? file.name : DEFAULT_DEMO_PROFILE_RESUME_FILENAME;
      const storagePath = userResumeFileUploadsFilePath(uid, filename);

      return {
        storagePath
      };
    }
  });

  readonly avatarFileModifierFn: DbxFirebaseStorageFileUploadFileModifier = dbxFirebaseStorageFileImageCompressionFileModifier({
    compression: {
      maxDimension: 1280,
      convertPngToJpeg: true,
      jpegQuality: 0.95
    },
    log: !this.environmentService.isProduction
  });

  readonly profileData$ = this.profileDocumentStore.data$;
  readonly avatarUrl$ = this.profileData$.pipe(map((x) => x.avatar));
  readonly avatarStorageFileKey$ = this.profileData$.pipe(map((x) => x.avatarStorageFile));
  readonly username$ = this.profileData$.pipe(map((x) => x.username));
  readonly usernameSignal = toSignal(this.username$);

  readonly avatarUrlSignal = toSignal(this.avatarUrl$);
  readonly avatarStorageFileKeySignal = toSignal(this.avatarStorageFileKey$);

  /**
   * The upload initializer opens this as CHECKING and the `retrieve` subtask closes it out, so the
   * section follows the whole check by streaming the profile it already loads.
   */
  readonly resumeSignal = toSignal(this.profileData$.pipe(map((x) => x.resume)));

  readonly context = loadingStateContext({ obs: this.profileDocumentStore.dataLoadingState$ });

  ngOnInit(): void {
    this.profileDocumentStore.setId(this.auth.userIdentifier$);
  }

  readonly isUsernameModified: IsModifiedFunction<DemoProfileUsernameFormValue> = (value) => {
    return this.profileDocumentStore.currentData$.pipe(
      map((profileData) => {
        return profileData ? profileData.username !== value.username : true;
      }),
      first()
    );
  };

  readonly isProfileModified: IsModifiedFunction<DemoProfileFormValue> = (value) => {
    return this.profileDocumentStore.currentData$.pipe(
      map((profileData) => {
        return profileData ? profileData.bio !== value.bio : true;
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

  readonly handleResetPassword: WorkUsingContext = (_value, context) => {
    context.startWorkingWithLoadingStateObservable(this.profileDocumentStore.resetPassword({ requestReset: true }));
  };

  readonly handleAvatarUploadInitializationSuccess: DbxActionSuccessHandlerFunction<any> = () => {
    // example
    // console.log('Avatar uploaded and initialized successfully.');
  };
}
