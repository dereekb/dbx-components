import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DbxActionLoadingContextDirective, DbxActionModule, DbxActionSnackbarErrorDirective, type DbxButtonStyle, type DbxFileListItemDetailsDateStyle, DbxFileUploadActionSyncDirective, DbxFileUploadComponent, DbxLabelBlockComponent, DbxLoadingComponent, type FileAcceptFilterTypeString } from '@dereekb/dbx-web';
import { DEFAULT_FORM_SPACE_FILE_ACCESS, DEFAULT_FORM_SPACE_SLOT_MAX_FILES, type FormSpaceFile, type FormSpaceFileAccess, type FormSpaceFileSlot, FormSpaceFileValidationState, firestoreModelKey, isFormSpaceFileAccessibleWithAccess, type StorageFileKey, storageFileIdentity } from '@dereekb/firebase';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { type ArrayOrValue, type Maybe } from '@dereekb/util';
import { type Observable, of, shareReplay, switchMap } from 'rxjs';
import { type DbxFirebaseStorageFileDownloadButtonConfig } from '../../storagefile/container/storagefile.download.button.component';
import { DbxFirebaseStorageFileListComponent, type DbxFirebaseStorageFileListComponentConfig, type DbxFirebaseStorageFileListEntry } from '../../storagefile/container/storagefile.list.component';
import { DbxFirebaseStorageFileUploadActionHandlerDirective } from '../../storagefile/container/storagefile.upload.action.handler.directive';
import { DbxFirebaseStorageFileUploadStoreDirective } from '../../storagefile/container/storagefile.upload.store.directive';
import { DbxFirebaseStorageFileUploadSyncDirective } from '../../storagefile/container/storagefile.upload.sync.directive';
import { DbxFirebaseAuthService } from '../../../auth/service/firebase.auth.service';
import { FormSpaceDocumentStore } from '../store/formspace.document.store';
import { DbxFirebaseFormSpaceSlotUploadDirective } from './formspace.slot.upload.directive';
import { DbxFirebaseFormSpaceUploadInitializeDocumentsDirective } from './formspace.upload.initialize.documents.directive';

/**
 * One row of the slot's file list: the entry the FormSpace holds, and the StorageFile key derived from it.
 *
 * Derived once per emission rather than by a template method, so a download button is not handed a new key
 * string on every change detection pass.
 */
export interface DbxFirebaseFormSpaceSlotUploadFileEntry {
  readonly file: FormSpaceFile;
  readonly storageFileKey: StorageFileKey;
  /**
   * Whether the signed-in user may read and remove this file, per the slot's {@link FormSpaceFileAccess}.
   *
   * A COURTESY, not a control — the server decides both verbs again. Rendering a download button that
   * returns FORBIDDEN and a remove button that raises `FORM_SPACE_FILE_ACCESS_DENIED` is the thing this
   * spares the user; it is not what stops them.
   */
  readonly accessible: boolean;
}

/**
 * Configuration for the {@link DbxFirebaseFormSpaceSlotUploadComponent}.
 */
export interface DbxFirebaseFormSpaceSlotUploadComponentConfig {
  /**
   * The slot to upload into and list.
   */
  readonly slot?: Maybe<FormSpaceFileSlot>;
  /**
   * Label shown above the slot. Defaults to the slot's own name.
   */
  readonly label?: Maybe<string>;
  /**
   * Hint shown under the label while the slot holds at least one file.
   */
  readonly hint?: Maybe<string>;
  /**
   * Text shown in place of the hint while the slot is empty.
   */
  readonly emptyText?: Maybe<string>;
  /**
   * How many files the slot holds, mirroring the type's `FormSpaceFileSlotConfig.maxFiles`.
   *
   * Defaults to {@link DEFAULT_FORM_SPACE_SLOT_MAX_FILES}. At 1 the slot is a POSITION — a new upload
   * supersedes what is there, so the upload button is never disabled for being "full" — and above 1 it is a
   * FOLDER, where the count is shown and uploading stops once the folder is full.
   */
  readonly maxFiles?: Maybe<number>;
  /**
   * Mime types the file picker accepts. Mirrors the slot's server-side `allowedMimeTypes`.
   */
  readonly fileTypesAccepted?: Maybe<ArrayOrValue<FileAcceptFilterTypeString>>;
  /**
   * Text of the upload button. Defaults to "Upload".
   */
  readonly uploadText?: Maybe<string>;
  /**
   * Icon of the upload button. Defaults to "upload".
   */
  readonly uploadIcon?: Maybe<string>;
  readonly uploadButtonStyle?: Maybe<DbxButtonStyle>;
  /**
   * Text of each file's remove button. Defaults to "Remove".
   */
  readonly removeText?: Maybe<string>;
  readonly removeButtonStyle?: Maybe<DbxButtonStyle>;
  /**
   * Disables uploading and removing, on top of the space's own editability.
   */
  readonly disabled?: Maybe<boolean>;
  /**
   * Who may read and remove an individual file here, mirroring the slot's server-side
   * {@link FormSpaceFileAccess}. Defaults to {@link DEFAULT_FORM_SPACE_FILE_ACCESS}.
   *
   * Under `'uploader'` a file another member uploaded still LISTS — the space's `f` is the shared record of
   * what the slot holds — but its download and remove controls are withheld, because the server would
   * refuse both.
   */
  readonly fileAccess?: Maybe<FormSpaceFileAccess>;
  /**
   * Whether each file gets a download button. Defaults to true.
   */
  readonly showDownloadButton?: Maybe<boolean>;
  /**
   * Whether each file gets a remove button. Defaults to true.
   *
   * Set false on a SHARED space, where a member may upload into the space without being allowed to take
   * another member's file back out of it.
   */
  readonly showRemoveButton?: Maybe<boolean>;
  /**
   * What is shown in place of a file's controls when {@link fileAccess} withholds them.
   */
  readonly inaccessibleText?: Maybe<string>;
  /**
   * Whether an accepted upload is processed immediately rather than waiting for the queue. Defaults to true.
   */
  readonly expediteProcessing?: Maybe<boolean>;
  readonly downloadButtonConfig?: Maybe<DbxFirebaseStorageFileDownloadButtonConfig>;
}

/**
 * Renders one slot of the surrounding FormSpace: what it currently holds, and the control that adds to it.
 *
 * Reads the ambient {@link FormSpaceDocumentStore}, so it must sit inside whatever provides it — the page
 * component's own `providers`, or a `dbxFirebaseFormSpaceDocument` directive. Note that a page cannot use
 * BOTH: the directive provides a store of its own, and the second instance never receives the key the page
 * set on the first, leaving every upload here with no space to upload into.
 *
 * The upload chain is the same one a page would otherwise assemble by hand — an upload store, the slot's
 * path handler, and the multi-file initializer — with the slot's file list, download buttons, and remove
 * actions attached to it.
 *
 * @example
 * ```html
 * <dbx-firebase-formspace-slot-upload slot="cover" label="Cover File" uploadText="Upload Cover" fileTypesAccepted="application/pdf,image/png"></dbx-firebase-formspace-slot-upload>
 * ```
 */
@Component({
  selector: 'dbx-firebase-formspace-slot-upload',
  template: `
    @if (slotSignal(); as slot) {
      <div class="dbx-firebase-formspace-slot-upload" dbxFirebaseStorageFileUploadStore [multipleUpload]="multipleUploadSignal()" [fileTypesAccepted]="fileTypesAcceptedSignal()">
        <!-- the flex bar is the slot directive's own element: the label and the upload button are its children, and a wrapper between them would collapse the row back into a stack -->
        <div class="dbx-flex-bar" [dbxFirebaseFormSpaceSlotUpload]="slot" #slotUpload="dbxFirebaseFormSpaceSlotUpload">
          <div class="dbx-flex-fill-0" dbxAction dbxActionSnackbarError dbxFirebaseFormSpaceUploadInitializeDocuments [initializeWithExpediteProcessing]="expediteProcessingSignal()">
            <dbx-loading dbxActionLoadingContext>
              <dbx-label-block [header]="headerSignal()">
                @if (!entriesSignal().length) {
                  <div class="dbx-hint">{{ emptyTextSignal() }}</div>
                } @else if (hintSignal()) {
                  <div class="dbx-hint">{{ hintSignal() }}</div>
                }
              </dbx-label-block>
            </dbx-loading>
          </div>
          <span class="dbx-spacer"></span>
          <div dbxAction dbxActionSnackbarError [dbxFirebaseStorageFileUploadActionHandler]="slotUpload.uploadHandlerSignal()" [triggerOnFiles]="true">
            <dbx-file-upload dbxFileUploadActionSync dbxFirebaseStorageFileUploadSync mode="button" [buttonStyle]="uploadButtonStyleSignal()" [icon]="uploadIconSignal()" [text]="uploadTextSignal()" [disabled]="uploadDisabledSignal()"></dbx-file-upload>
          </div>
        </div>
        <dbx-firebase-storagefile-list [entries]="fileListEntriesSignal()" [config]="fileListConfigSignal()" [removeHandler]="handleRemoveFile"></dbx-firebase-storagefile-list>
      </div>
    }
  `,
  imports: [
    //
    DbxActionModule,
    DbxActionLoadingContextDirective,
    DbxActionSnackbarErrorDirective,
    DbxFileUploadActionSyncDirective,
    DbxFileUploadComponent,
    DbxLabelBlockComponent,
    DbxLoadingComponent,
    DbxFirebaseStorageFileListComponent,
    DbxFirebaseStorageFileUploadActionHandlerDirective,
    DbxFirebaseStorageFileUploadStoreDirective,
    DbxFirebaseStorageFileUploadSyncDirective,
    DbxFirebaseFormSpaceSlotUploadDirective,
    DbxFirebaseFormSpaceUploadInitializeDocumentsDirective
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseFormSpaceSlotUploadComponent {
  readonly formSpaceDocumentStore = inject(FormSpaceDocumentStore);
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);

  readonly config = input<Maybe<DbxFirebaseFormSpaceSlotUploadComponentConfig>>();

  readonly slot = input<Maybe<FormSpaceFileSlot>>();
  readonly label = input<Maybe<string>>();
  readonly hint = input<Maybe<string>>();
  readonly emptyText = input<Maybe<string>>();
  readonly maxFiles = input<Maybe<number>>();
  readonly fileTypesAccepted = input<Maybe<ArrayOrValue<FileAcceptFilterTypeString>>>();
  readonly uploadText = input<Maybe<string>>();
  readonly uploadIcon = input<Maybe<string>>();
  readonly removeText = input<Maybe<string>>();
  readonly fileAccess = input<Maybe<FormSpaceFileAccess>>();
  readonly inaccessibleText = input<Maybe<string>>();
  readonly disabled = input<Maybe<boolean>>();
  readonly showDownloadButton = input<Maybe<boolean>>();
  readonly showRemoveButton = input<Maybe<boolean>>();
  readonly expediteProcessing = input<Maybe<boolean>>();

  readonly slotSignal = computed(() => {
    const config = this.config();
    return this.slot() ?? config?.slot;
  });
  readonly maxFilesSignal = computed(() => {
    const config = this.config();
    return this.maxFiles() ?? config?.maxFiles ?? DEFAULT_FORM_SPACE_SLOT_MAX_FILES;
  });
  readonly emptyTextSignal = computed(() => {
    const config = this.config();
    return this.emptyText() ?? config?.emptyText ?? 'Nothing here yet.';
  });
  readonly hintSignal = computed(() => {
    const config = this.config();
    return this.hint() ?? config?.hint;
  });
  readonly fileTypesAcceptedSignal = computed(() => {
    const config = this.config();
    return this.fileTypesAccepted() ?? config?.fileTypesAccepted;
  });
  readonly uploadTextSignal = computed(() => {
    const config = this.config();
    return this.uploadText() ?? config?.uploadText ?? 'Upload';
  });
  readonly uploadIconSignal = computed(() => {
    const config = this.config();
    return this.uploadIcon() ?? config?.uploadIcon ?? 'upload';
  });
  readonly removeTextSignal = computed(() => {
    const config = this.config();
    return this.removeText() ?? config?.removeText ?? 'Remove';
  });
  readonly fileAccessSignal = computed<FormSpaceFileAccess>(() => {
    const config = this.config();
    return this.fileAccess() ?? config?.fileAccess ?? DEFAULT_FORM_SPACE_FILE_ACCESS;
  });
  readonly inaccessibleTextSignal = computed(() => {
    const config = this.config();
    return this.inaccessibleText() ?? config?.inaccessibleText ?? 'Uploaded by someone else.';
  });
  readonly showDownloadButtonSignal = computed(() => {
    const config = this.config();
    return this.showDownloadButton() ?? config?.showDownloadButton ?? true;
  });
  readonly showRemoveButtonSignal = computed(() => {
    const config = this.config();
    return this.showRemoveButton() ?? config?.showRemoveButton ?? true;
  });
  readonly expediteProcessingSignal = computed(() => {
    const config = this.config();
    return this.expediteProcessing() ?? config?.expediteProcessing ?? true;
  });
  readonly downloadButtonConfigSignal = computed(() => this.config()?.downloadButtonConfig);

  readonly uploadButtonStyleSignal = computed<DbxButtonStyle>(() => this.config()?.uploadButtonStyle ?? { type: 'raised' });
  readonly removeButtonStyleSignal = computed<DbxButtonStyle>(() => this.config()?.removeButtonStyle ?? { type: 'basic' });

  /**
   * Whether the picker takes several files at once.
   *
   * A one-file slot supersedes rather than accumulates, so letting the picker return several would upload
   * files the slot immediately evicts — and consume the space's upload budget doing it.
   */
  readonly multipleUploadSignal = computed(() => this.maxFilesSignal() > 1);

  readonly slot$ = toObservable(this.slotSignal);

  readonly files$: Observable<FormSpaceFile[]> = this.slot$.pipe(
    switchMap((slot) => (slot == null ? of([] as FormSpaceFile[]) : this.formSpaceDocumentStore.filesInSlot$(slot))),
    shareReplay(1)
  );

  readonly filesSignal = toSignal(this.files$, { initialValue: [] as FormSpaceFile[] });
  readonly isEditableSignal = toSignal(this.formSpaceDocumentStore.isEditable$, { initialValue: false });
  readonly formSpaceSignal = toSignal(this.formSpaceDocumentStore.currentData$);
  readonly currentUidSignal = toSignal(this.dbxFirebaseAuthService.currentUid$);

  /**
   * The slot's files, each already carrying the two things a row needs beyond the entry itself.
   *
   * Both are derived HERE rather than by a template method so a row is not handed a freshly built key — and
   * a freshly computed verdict — on every change detection pass.
   */
  readonly entriesSignal = computed<DbxFirebaseFormSpaceSlotUploadFileEntry[]>(() => {
    const fileAccess = this.fileAccessSignal();
    const formSpace = this.formSpaceSignal();
    const uid = this.currentUidSignal();

    return this.filesSignal().map((file) => ({
      file,
      storageFileKey: firestoreModelKey(storageFileIdentity, file.sf),
      // the space is needed for the `ub ?? u` fallback an older entry relies on, so an unloaded space
      // withholds the controls rather than guessing — the state lasts one emission
      accessible: formSpace != null && isFormSpaceFileAccessibleWithAccess({ fileAccess, formSpace, file, uid })
    }));
  });

  /**
   * The slot's files as the StorageFile list presents them.
   *
   * The validation state becomes the row's details line here rather than in the list, so the list stays a
   * plain StorageFile listing that knows nothing about FormSpaces.
   */
  readonly fileListEntriesSignal = computed<DbxFirebaseStorageFileListEntry<FormSpaceFile>[]>(() =>
    this.entriesSignal().map(({ file, storageFileKey, accessible }) => {
      let details: Maybe<string>;
      let detailsDate: Maybe<Date>;
      let detailsDateStyle: Maybe<DbxFileListItemDetailsDateStyle>;
      let detailsClass: Maybe<string>;

      switch (file.v) {
        case FormSpaceFileValidationState.PENDING:
          details = 'Checking...';
          break;
        case FormSpaceFileValidationState.INVALID:
          details = file.r ?? 'This file was rejected.';
          detailsClass = 'dbx-warn';
          break;
        default:
          // NONE and VALID both read as uploaded: the file is in the slot either way.
          details = 'Uploaded';
          detailsDate = file.at;
          detailsDateStyle = 'distance';
          break;
      }

      return {
        storageFileKey,
        name: file.n,
        details,
        detailsDate,
        detailsDateStyle,
        detailsClass,
        accessible,
        value: file
      };
    })
  );

  readonly fileListConfigSignal = computed<DbxFirebaseStorageFileListComponentConfig<FormSpaceFile>>(() => ({
    showDownloadButton: this.showDownloadButtonSignal(),
    showRemoveButton: this.showRemoveButtonSignal(),
    removeText: this.removeTextSignal(),
    removeButtonStyle: this.removeButtonStyleSignal(),
    removeDisabled: this.removeDisabledSignal(),
    inaccessibleText: this.inaccessibleTextSignal(),
    downloadButtonConfig: this.downloadButtonConfigSignal()
  }));

  readonly labelSignal = computed(() => {
    const config = this.config();
    const slot = this.slotSignal();
    return this.label() ?? config?.label ?? slot;
  });

  /**
   * The label, carrying the slot's occupancy when the slot is a folder.
   *
   * A one-file slot has no count worth showing: it is either filled or it is not, and the file's own row
   * already says which.
   */
  readonly headerSignal = computed(() => {
    const entries = this.entriesSignal();
    const label = this.labelSignal();
    const maxFiles = this.maxFilesSignal();
    return maxFiles > 1 ? `${label} (${entries.length} / ${maxFiles})` : label;
  });

  readonly disabledSignal = computed(() => {
    const config = this.config();
    return (this.disabled() ?? config?.disabled) === true;
  });

  readonly isFullSignal = computed(() => {
    const entries = this.entriesSignal();
    const maxFiles = this.maxFilesSignal();
    return maxFiles > 1 && entries.length >= maxFiles;
  });

  readonly uploadDisabledSignal = computed(() => {
    const isEditable = this.isEditableSignal();
    const isFull = this.isFullSignal();
    return this.disabledSignal() || !isEditable || isFull;
  });
  readonly removeDisabledSignal = computed(() => {
    const isEditable = this.isEditableSignal();
    return this.disabledSignal() || !isEditable;
  });

  /**
   * Removes one file from the slot it records itself as being in.
   *
   * Takes the slot from the file rather than from the component's own input so the removal always names the
   * slot the server has the file in, even if the input changed after the list was rendered.
   *
   * @param file - The FormSpace file entry to remove.
   * @param context - The work instance driving the remove action.
   */
  readonly handleRemoveFile: WorkUsingContext<FormSpaceFile> = (file, context) => {
    context.startWorkingWithLoadingStateObservable(this.formSpaceDocumentStore.removeFormSpaceFile({ slot: file.sl, storageFileId: file.sf }));
  };
}
