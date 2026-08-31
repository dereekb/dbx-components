import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { TimeDistancePipe } from '@dereekb/dbx-core';
import { DbxActionLoadingContextDirective, DbxActionModule, DbxActionSnackbarErrorDirective, DbxButtonComponent, type DbxButtonStyle, DbxFileUploadActionSyncDirective, DbxFileUploadComponent, DbxLabelBlockComponent, DbxLoadingComponent, type FileAcceptFilterTypeString } from '@dereekb/dbx-web';
import { DEFAULT_FORM_SPACE_SLOT_MAX_FILES, type FormSpaceFile, type FormSpaceFileSlot, FormSpaceFileValidationState, firestoreModelKey, type StorageFileKey, storageFileIdentity } from '@dereekb/firebase';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { type ArrayOrValue, type Maybe } from '@dereekb/util';
import { type Observable, of, shareReplay, switchMap } from 'rxjs';
import { DbxFirebaseStorageFileDownloadButtonComponent, type DbxFirebaseStorageFileDownloadButtonConfig } from '../../storagefile/container/storagefile.download.button.component';
import { DbxFirebaseStorageFileUploadActionHandlerDirective } from '../../storagefile/container/storagefile.upload.action.handler.directive';
import { DbxFirebaseStorageFileUploadStoreDirective } from '../../storagefile/container/storagefile.upload.store.directive';
import { DbxFirebaseStorageFileUploadSyncDirective } from '../../storagefile/container/storagefile.upload.sync.directive';
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
        @if (entriesSignal().length) {
          <div class="dbx-button-column dbx-w100">
            @for (entry of entriesSignal(); track entry.storageFileKey) {
              <div class="dbx-flex-bar dbx-w100">
                <dbx-label-block class="dbx-flex-fill-0" [header]="entry.file.n">
                  @switch (entry.file.v) {
                    @case (formSpaceFileValidationState.PENDING) {
                      <div class="dbx-hint">Checking...</div>
                    }
                    @case (formSpaceFileValidationState.INVALID) {
                      <div class="dbx-warn">{{ entry.file.r ?? 'This file was rejected.' }}</div>
                    }
                    @default {
                      <div class="dbx-hint">Uploaded {{ entry.file.at | timeDistance }}.</div>
                    }
                  }
                </dbx-label-block>
                <span class="dbx-spacer"></span>
                @if (showDownloadButtonSignal()) {
                  <dbx-firebase-storagefile-download-button [config]="downloadButtonConfigSignal()" [storageFileKey]="entry.storageFileKey"></dbx-firebase-storagefile-download-button>
                }
                @if (showRemoveButtonSignal()) {
                  <div dbxAction dbxActionSnackbarError [dbxActionValue]="entry.file" [dbxActionHandler]="handleRemoveFile">
                    <dbx-button dbxActionButton [buttonStyle]="removeButtonStyleSignal()" [text]="removeTextSignal()" [disabled]="removeDisabledSignal()"></dbx-button>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>
    }
  `,
  imports: [
    //
    DbxActionModule,
    DbxActionLoadingContextDirective,
    DbxActionSnackbarErrorDirective,
    DbxButtonComponent,
    DbxFileUploadActionSyncDirective,
    DbxFileUploadComponent,
    DbxLabelBlockComponent,
    DbxLoadingComponent,
    DbxFirebaseStorageFileDownloadButtonComponent,
    DbxFirebaseStorageFileUploadActionHandlerDirective,
    DbxFirebaseStorageFileUploadStoreDirective,
    DbxFirebaseStorageFileUploadSyncDirective,
    DbxFirebaseFormSpaceSlotUploadDirective,
    DbxFirebaseFormSpaceUploadInitializeDocumentsDirective,
    TimeDistancePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseFormSpaceSlotUploadComponent {
  readonly formSpaceDocumentStore = inject(FormSpaceDocumentStore);

  readonly formSpaceFileValidationState = FormSpaceFileValidationState;

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

  readonly entriesSignal = computed<DbxFirebaseFormSpaceSlotUploadFileEntry[]>(() => this.filesSignal().map((file) => ({ file, storageFileKey: firestoreModelKey(storageFileIdentity, file.sf) })));

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
