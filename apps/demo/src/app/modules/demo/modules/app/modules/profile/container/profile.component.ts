import { ChangeDetectionStrategy, type OnInit, Component, computed, inject } from '@angular/core';
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
  StorageFileDocumentStore,
  type StorageFileUploadConfig,
  storageFileUploadHandler,
  type StorageFileUploadHandler
} from '@dereekb/dbx-firebase';
import { first, map } from 'rxjs';
import { DemoProfileFormComponent, type DemoProfileFormValue, DemoProfileUsernameFormComponent, type DemoProfileUsernameFormValue, ProfileDocumentStore } from 'demo-components';
import { DbxActionErrorDirective, DbxActionModule, DbxAvatarComponent, DbxButtonModule, DbxContentBoxDirective, DbxErrorComponent, DbxLabelBlockComponent, DbxLoadingComponent, DbxLoadingProgressComponent, DbxSectionComponent, DbxSectionLayoutModule } from '@dereekb/dbx-web';
import { DbxActionFormDirective, DbxFormSourceDirective } from '@dereekb/dbx-form';
import { StorageFileProcessingState } from '@dereekb/firebase';
import { USER_RESUME_FILE_UPLOADS_MAX_FILE_SIZE_BYTES, type UserResumeFileMetadata, userAvatarUploadsFilePath, userResumeFileUploadsFilePath } from 'demo-firebase';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxAppEnvironmentService, type DbxActionSuccessHandlerFunction } from '@dereekb/dbx-core';
import { type Maybe, type SlashPathFile, isSlashPathFile, slashPathName } from '@dereekb/util';

/**
 * What the profile view shows about the user's resume and the model's verdict on it.
 */
export interface DemoProfileResumeCheckStatus {
  /**
   * The uploaded file's name.
   */
  readonly filename: string;
  /**
   * True while the resume-check run is queued or in flight.
   */
  readonly checking: boolean;
  /**
   * True when every check attempt was spent without an answer.
   */
  readonly failed: boolean;
  /**
   * When the verdict was written, if it has been.
   */
  readonly checkedAt?: Maybe<Date>;
  /**
   * The model's verdict, if it has answered.
   */
  readonly isResume?: Maybe<boolean>;
  /**
   * The model's reasoning for the verdict.
   */
  readonly reason?: Maybe<string>;
}

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
  // The resume section's StorageFileDocumentStore is provided here rather than by a
  // dbxFirebaseStorageFileDocument directive so this component can read the check's verdict off it. The
  // avatar section keeps its own store, provided by the directive on that block's element.
  providers: [ProfileDocumentStore, StorageFileDocumentStore],
  imports: [
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

  readonly resumeStorageFileDocumentStore = inject(StorageFileDocumentStore);

  readonly resumeMaxFileSizeKb = USER_RESUME_FILE_UPLOADS_MAX_FILE_SIZE_BYTES / 1024;

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
  readonly resumeStorageFileKey$ = this.profileData$.pipe(map((x) => x.resumeStorageFile));
  readonly username$ = this.profileData$.pipe(map((x) => x.username));
  readonly usernameSignal = toSignal(this.username$);

  readonly avatarUrlSignal = toSignal(this.avatarUrl$);
  readonly avatarStorageFileKeySignal = toSignal(this.avatarStorageFileKey$);

  readonly resumeStorageFileSignal = toSignal(this.resumeStorageFileDocumentStore.currentData$);

  readonly resumeCheckStatusSignal = computed<Maybe<DemoProfileResumeCheckStatus>>(() => {
    const storageFile = this.resumeStorageFileSignal();
    let status: Maybe<DemoProfileResumeCheckStatus>;

    if (storageFile != null) {
      const processingState = storageFile.ps;
      // The `send`/`retrieve` subtask pair writes its verdict onto the StorageFile's metadata.
      const metadata = storageFile.d as Maybe<UserResumeFileMetadata>;

      status = {
        filename: slashPathName(storageFile.pathString),
        checking: processingState === StorageFileProcessingState.QUEUED_FOR_PROCESSING || processingState === StorageFileProcessingState.PROCESSING,
        failed: processingState === StorageFileProcessingState.FAILED,
        checkedAt: metadata?.checkedAt,
        isResume: metadata?.isResume,
        reason: metadata?.reason
      };
    }

    return status;
  });

  readonly context = loadingStateContext({ obs: this.profileDocumentStore.dataLoadingState$ });

  ngOnInit(): void {
    this.profileDocumentStore.setId(this.auth.userIdentifier$);
    // Points the section at any resume already on the profile. An upload re-points the same store at the
    // StorageFile it creates, and the API writes that key back onto the profile, so the two converge.
    this.resumeStorageFileDocumentStore.setKey(this.resumeStorageFileKey$);
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
