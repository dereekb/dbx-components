import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { first, from, map } from 'rxjs';
import { type FileSize, type Maybe } from '@dereekb/util';
import { type WorkUsingObservable } from '@dereekb/rxjs';
import { cleanSubscription, DbxActionButtonDirective, DbxActionDirective, DbxActionDisabledDirective, DbxActionHandlerDirective } from '@dereekb/dbx-core';
import { type DbxButtonDisplayStylePair } from '../../button/button';
import { DbxButtonComponent } from '../../button/button.component';
import { DbxActionConfirmDirective, type DbxActionConfirmConfig } from '../../action/action.confirm.directive';
import { DbxActionSnackbarErrorDirective } from '../../error/error.snackbar.action.directive';
import { DbxFileUploadComponent } from '../../interaction/upload/upload.component';
import { type DbxFileUploadFilesChangedEvent } from '../../interaction/upload/abstract.upload.component';
import { DbxDownloadBlobButtonComponent, type DbxDownloadBlobButtonConfig } from '../download/blob/download.blob.button.component';
import { type FileArrayAcceptMatchConfig } from '../../interaction/upload/upload.accept';
import { DBX_PDF_MERGE_EDITOR_CONFIG, DEFAULT_DBX_PDF_MERGE_ENCRYPTED_HANDLING, DEFAULT_DBX_PDF_MERGE_PAGE_EDITING, DEFAULT_DBX_PDF_MERGE_RESTORE_IMPORT_ON_CLEAR, DEFAULT_DBX_PDF_MERGE_SIDECAR, DEFAULT_PDF_MERGE_ACCEPT, type DbxPdfMergeEditorConfig, type DbxPdfMergeEncryptedHandling, type DbxPdfMergeOutputSizeLimitsConfig, type PdfMergeEntry } from './pdf.merge';
import { type DbxImageCompressionConfig } from '../image';
import { DbxPdfMergeEditorStore, type DbxPdfMergeEditorClearEntriesResult } from './pdf.merge.editor.store';
import { DbxPdfMergeListComponent } from './pdf.merge.list.component';
import { DbxPdfMergePageListComponent } from './pdf.merge.page.list.component';
import { buildPdfMergeEntry, formatPdfMergeEntrySize } from './pdf.merge.utility';
import { openPdfPreviewDialog } from './pdf.preview.dialog.component';

const DEFAULT_MERGED_FILE_NAME = 'merged.pdf';

const DEFAULT_DOWNLOAD_BUTTON: DbxButtonDisplayStylePair = {
  display: { icon: 'download', text: 'Download' },
  style: { type: 'stroked' }
};

const DEFAULT_CLEAR_CONFIRM: DbxActionConfirmConfig = {
  title: 'Clear all files?',
  prompt: 'Every file added to this editor will be removed, along with any page edits made to them.',
  confirmText: 'Clear',
  cancelText: 'Cancel'
};

/**
 * Shown in place of {@link DEFAULT_CLEAR_CONFIRM} when the editor has a programmatic baseline, since Clear resets to that document rather than emptying.
 */
const DEFAULT_RESTORE_CONFIRM: DbxActionConfirmConfig = {
  title: 'Reset to the imported document?',
  prompt: 'Every change made here — added files, page edits, removed sections — will be discarded and the imported document reloaded as it first arrived.',
  confirmText: 'Reset',
  cancelText: 'Cancel'
};

/**
 * Editor that lets the user collect PDFs and images, reorder them via drag-and-drop, and produce a single merged PDF for preview/download. Reads from an ancestor-provided {@link DbxPdfMergeEditorStore}. Optionally embeds a {@link DbxDownloadBlobButtonComponent} to offer a download affordance for the most recent merge.
 *
 * The parent view (or another directive) is responsible for providing {@link DbxPdfMergeEditorStore} so the editor and its peer components ({@link DbxPdfMergeListComponent}, {@link DbxPdfMergeEntryComponent}) share the same instance. Subscribe to the store's {@link DbxPdfMergeEditorStore.mergeOutput$} directly for downstream merge consumers.
 *
 * @example
 * ```html
 * <dbx-pdf-merge-editor [showDownloadButton]="true" fileName="receipts.pdf" [downloadButton]="{ display: { icon: 'cloud_download', text: 'Save' }, style: { type: 'flat', color: 'primary' } }"></dbx-pdf-merge-editor>
 * ```
 */
/**
 * High-level state of {@link DbxPdfMergeEditorComponent.outputSizeStateSignal}.
 *
 * - `ok` — output size is within or below the configured warning threshold (or no limits are configured).
 * - `warn` — output size exceeds `warnBytes` but stays under `errorBytes`.
 * - `error` — output size exceeds `errorBytes`. Preview and Download are blocked via the store's validity gate.
 */
export type DbxPdfMergeEditorOutputSizeState = 'ok' | 'warn' | 'error';

@Component({
  selector: 'dbx-pdf-merge-editor',
  templateUrl: './pdf.merge.editor.component.html',
  host: {
    class: 'dbx-pdf-merge-editor d-block'
  },
  imports: [MatIconModule, DbxButtonComponent, DbxFileUploadComponent, DbxDownloadBlobButtonComponent, DbxActionDirective, DbxActionButtonDirective, DbxActionDisabledDirective, DbxActionHandlerDirective, DbxActionConfirmDirective, DbxActionSnackbarErrorDirective, DbxPdfMergeListComponent, DbxPdfMergePageListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPdfMergeEditorComponent {
  readonly store = inject(DbxPdfMergeEditorStore);
  private readonly _matDialog = inject(MatDialog);
  private readonly _injectedConfig = inject(DBX_PDF_MERGE_EDITOR_CONFIG, { optional: true });
  /**
   * Single-slot subscription tracker for the deferred Preview path. Replacing the slot cancels any earlier in-flight wait so rapid clicks (or repeated programmatic calls) cannot stack pending dialogs.
   */
  private readonly _pendingPreview = cleanSubscription();

  /**
   * Individual inputs. Each takes precedence over the matching field on {@link config} (and the workspace-wide token), with defaults applied in the corresponding `*Signal` computed. See {@link DbxPdfMergeEditorConfig} for field docs.
   */
  readonly accept = input<Maybe<FileArrayAcceptMatchConfig['accept']>>();
  readonly multiple = input<Maybe<boolean>>();
  readonly fileName = input<Maybe<string>>();
  readonly showDownloadButton = input<Maybe<boolean>>();
  readonly showPreviewButton = input<Maybe<boolean>>();
  readonly downloadButton = input<Maybe<DbxButtonDisplayStylePair>>();
  readonly showAddFiles = input<Maybe<boolean>>();
  readonly showFileList = input<Maybe<boolean>>();
  readonly pageEditing = input<Maybe<boolean>>();
  readonly sidecar = input<Maybe<boolean>>();
  /**
   * Bundles every editor option into one object (see {@link DbxPdfMergeEditorConfig}). Individual inputs override the matching field here, which in turn overrides the workspace-wide {@link DBX_PDF_MERGE_EDITOR_CONFIG} token.
   */
  readonly config = input<Maybe<DbxPdfMergeEditorConfig>>();

  readonly entriesChanged = output<readonly PdfMergeEntry[]>();

  /**
   * Store-level image-compression default pushed by {@link DbxPdfMergeEditorStoreDirective}. Resolved between the editor's own `config` input and the workspace-wide token so a store-level default flows through the upload dialog's bare editor.
   */
  readonly storeImageCompressionSignal = toSignal(this.store.imageCompression$, { initialValue: undefined });

  /**
   * Store-level encryption handling default pushed by {@link DbxPdfMergeEditorStoreDirective}. Resolved between the editor's own `config` input and the workspace-wide token in {@link effectiveConfigSignal}.
   */
  readonly storeEncryptedHandlingSignal = toSignal(this.store.encryptedHandling$, { initialValue: undefined });

  /**
   * Store-level page-editing and sidecar defaults pushed by {@link DbxPdfMergeEditorStoreDirective}. These read the store's raw (undefaulted) settings so an unset store value still falls through to the workspace-wide token in {@link effectiveConfigSignal}.
   */
  readonly storePageEditingSignal = toSignal(this.store.pageEditingSetting$, { initialValue: undefined });
  readonly storeSidecarSignal = toSignal(this.store.sidecarSetting$, { initialValue: undefined });

  /**
   * Merged config — the editor's own `config` input wins over the store-level default (for `imageCompression`), which in turn wins over the workspace-wide token. The individual inputs are resolved on top of this object in the per-field `*Signal` computeds below.
   */
  readonly effectiveConfigSignal = computed<DbxPdfMergeEditorConfig>(() => {
    const fromInput = this.config();
    const fromToken = this._injectedConfig;
    const storeImageCompression = this.storeImageCompressionSignal();
    const storeEncryptedHandling = this.storeEncryptedHandlingSignal();
    const storePageEditing = this.storePageEditingSignal();
    const storeSidecar = this.storeSidecarSignal();
    return {
      imageCompression: fromInput?.imageCompression ?? storeImageCompression ?? fromToken?.imageCompression ?? null,
      outputSizeLimits: fromInput?.outputSizeLimits ?? fromToken?.outputSizeLimits ?? null,
      accept: fromInput?.accept ?? fromToken?.accept,
      multiple: fromInput?.multiple ?? fromToken?.multiple,
      fileName: fromInput?.fileName ?? fromToken?.fileName,
      showDownloadButton: fromInput?.showDownloadButton ?? fromToken?.showDownloadButton,
      showPreviewButton: fromInput?.showPreviewButton ?? fromToken?.showPreviewButton,
      downloadButton: fromInput?.downloadButton ?? fromToken?.downloadButton,
      showAddFiles: fromInput?.showAddFiles ?? fromToken?.showAddFiles,
      showFileList: fromInput?.showFileList ?? fromToken?.showFileList,
      encryptedHandling: fromInput?.encryptedHandling ?? storeEncryptedHandling ?? fromToken?.encryptedHandling ?? DEFAULT_DBX_PDF_MERGE_ENCRYPTED_HANDLING,
      pageEditing: fromInput?.pageEditing ?? storePageEditing ?? fromToken?.pageEditing ?? DEFAULT_DBX_PDF_MERGE_PAGE_EDITING,
      sidecar: fromInput?.sidecar ?? storeSidecar ?? fromToken?.sidecar ?? DEFAULT_DBX_PDF_MERGE_SIDECAR,
      clearConfirm: fromInput?.clearConfirm ?? fromToken?.clearConfirm,
      restoreImportOnClear: fromInput?.restoreImportOnClear ?? fromToken?.restoreImportOnClear ?? DEFAULT_DBX_PDF_MERGE_RESTORE_IMPORT_ON_CLEAR
    };
  });

  readonly restoreImportOnClearSignal = computed<boolean>(() => this.effectiveConfigSignal().restoreImportOnClear ?? DEFAULT_DBX_PDF_MERGE_RESTORE_IMPORT_ON_CLEAR);

  /**
   * Whether Clear will reset to a programmatic baseline instead of emptying. Only affects the confirmation's wording — {@link DbxPdfMergeEditorStore.clearEntries} makes the actual decision, and re-reads the store at the moment it runs.
   */
  readonly clearRestoresImportSignal = computed<boolean>(() => {
    // Tracks the entry count so the wording is re-evaluated as the editor's contents change; the
    // store's restore point is a plain field rather than a stream (nothing else needs to observe it).
    this.entryCountSignal();
    return this.restoreImportOnClearSignal() && this.store.hasRestorableImport();
  });

  /**
   * Config for the confirmation shown before the footer Clear button empties the editor. `clearConfirm` overrides any field of the default; `autoConfirm: true` restores the pre-confirmation one-click behavior.
   *
   * The default copy tells the truth about which of the two things Clear is about to do — reset to the app-supplied document, or remove everything.
   */
  readonly clearConfirmSignal = computed<DbxActionConfirmConfig>(() => {
    const base = this.clearRestoresImportSignal() ? DEFAULT_RESTORE_CONFIRM : DEFAULT_CLEAR_CONFIRM;
    return { ...base, ...this.effectiveConfigSignal().clearConfirm };
  });

  readonly encryptedHandlingSignal = computed<DbxPdfMergeEncryptedHandling>(() => this.effectiveConfigSignal().encryptedHandling ?? DEFAULT_DBX_PDF_MERGE_ENCRYPTED_HANDLING);

  /**
   * Whether page editing is active. When `false` the editor renders its original file list and no page machinery is instantiated at all.
   */
  readonly pageEditingSignal = computed<boolean>(() => {
    const config = this.effectiveConfigSignal();
    return this.pageEditing() ?? config.pageEditing ?? DEFAULT_DBX_PDF_MERGE_PAGE_EDITING;
  });

  readonly sidecarSignal = computed<boolean>(() => {
    const config = this.effectiveConfigSignal();
    return this.sidecar() ?? config.sidecar ?? DEFAULT_DBX_PDF_MERGE_SIDECAR;
  });

  readonly imageCompressionConfigSignal = computed<Maybe<DbxImageCompressionConfig>>(() => this.effectiveConfigSignal().imageCompression);
  readonly outputSizeLimitsSignal = computed<Maybe<DbxPdfMergeOutputSizeLimitsConfig>>(() => this.effectiveConfigSignal().outputSizeLimits);

  // Per-field resolution: dedicated input → config (input/token) → default. The config signal is
  // read unconditionally at the top of each computed so the computed tracks it on every run.
  readonly acceptSignal = computed<FileArrayAcceptMatchConfig['accept']>(() => {
    const config = this.effectiveConfigSignal();
    return this.accept() ?? config.accept ?? (DEFAULT_PDF_MERGE_ACCEPT as FileArrayAcceptMatchConfig['accept']);
  });
  readonly multipleSignal = computed<boolean>(() => {
    const config = this.effectiveConfigSignal();
    return this.multiple() ?? config.multiple ?? true;
  });
  readonly fileNameSignal = computed<string>(() => {
    const config = this.effectiveConfigSignal();
    return this.fileName() ?? config.fileName ?? DEFAULT_MERGED_FILE_NAME;
  });
  readonly showDownloadButtonSignal = computed<boolean>(() => {
    const config = this.effectiveConfigSignal();
    return this.showDownloadButton() ?? config.showDownloadButton ?? false;
  });
  readonly showPreviewButtonSignal = computed<boolean>(() => {
    const config = this.effectiveConfigSignal();
    return this.showPreviewButton() ?? config.showPreviewButton ?? true;
  });
  readonly downloadButtonSignal = computed<DbxButtonDisplayStylePair>(() => {
    const config = this.effectiveConfigSignal();
    return this.downloadButton() ?? config.downloadButton ?? DEFAULT_DOWNLOAD_BUTTON;
  });
  readonly showAddFilesSignal = computed<boolean>(() => {
    const config = this.effectiveConfigSignal();
    return this.showAddFiles() ?? config.showAddFiles ?? true;
  });
  readonly showFileListSignal = computed<boolean>(() => {
    const config = this.effectiveConfigSignal();
    return this.showFileList() ?? config.showFileList ?? true;
  });
  readonly warnBytesSignal = computed<Maybe<FileSize>>(() => this.outputSizeLimitsSignal()?.warnBytes);
  readonly errorBytesSignal = computed<Maybe<FileSize>>(() => this.outputSizeLimitsSignal()?.errorBytes);

  readonly hasReadyEntriesSignal = toSignal(this.store.hasReadyEntries$, { initialValue: false });
  readonly entryCountSignal = toSignal(this.store.entryCount$, { initialValue: 0 });
  /**
   * Number of pages that will actually reach the output — the page plan minus anything marked for removal. Only surfaced while page editing is enabled.
   */
  readonly mergeablePageCountSignal = toSignal(this.store.mergeablePageCount$, { initialValue: 0 });
  /**
   * Mirrors {@link DbxPdfMergeEditorStore.focusActive$} — `true` while `encryptedHandling === 'focus'` and at least one ready encrypted entry exists. Drives the encrypted-PDF focus banner.
   */
  readonly focusActiveSignal = toSignal(this.store.focusActive$, { initialValue: false });
  /**
   * Mirrors {@link DbxPdfMergeEditorStore.isValid$}. Defaults to `true` when no validator delegate is registered, so the Preview/Download buttons are gated only by the registered validator's output (if any).
   */
  readonly isValidSignal = toSignal(this.store.isValid$, { initialValue: true });

  /**
   * Computed gate for the Preview and Download affordances. Disabled while no entry is `ready` or while the registered validator delegate reports invalid.
   */
  readonly canMergeSignal = computed(() => {
    const isValid = this.isValidSignal();
    return this.hasReadyEntriesSignal() && isValid;
  });

  /**
   * Latest merged blob (or `undefined` while validation/merge is in flight or no entries are ready). Sourced from {@link DbxPdfMergeEditorStore.currentMergeOutput$} so the download button always reflects the current merge without needing the user to click Preview first.
   */
  readonly mergeBlobSignal = toSignal(this.store.currentMergeOutput$, { initialValue: undefined });

  /**
   * Latest candidate output size in bytes (sourced from {@link DbxPdfMergeEditorStore.outputSize$}). Drives the warning/error banner.
   */
  readonly outputSizeSignal = toSignal(this.store.outputSize$, { initialValue: undefined });

  readonly outputSizeStateSignal = computed<DbxPdfMergeEditorOutputSizeState>(() => {
    const size = this.outputSizeSignal();
    const warnBytes = this.warnBytesSignal();
    const errorBytes = this.errorBytesSignal();
    let state: DbxPdfMergeEditorOutputSizeState;

    if (size == null) {
      state = 'ok';
    } else if (errorBytes != null && size > errorBytes) {
      state = 'error';
    } else if (warnBytes != null && size > warnBytes) {
      state = 'warn';
    } else {
      state = 'ok';
    }

    return state;
  });

  readonly formattedOutputSizeSignal = computed<Maybe<string>>(() => {
    const size = this.outputSizeSignal();
    return size == null ? null : formatPdfMergeEntrySize(size);
  });

  readonly formattedWarnLimitSignal = computed<Maybe<string>>(() => {
    const warnBytes = this.warnBytesSignal();
    return warnBytes == null ? null : formatPdfMergeEntrySize(warnBytes);
  });

  readonly formattedErrorLimitSignal = computed<Maybe<string>>(() => {
    const errorBytes = this.errorBytesSignal();
    return errorBytes == null ? null : formatPdfMergeEntrySize(errorBytes);
  });

  readonly downloadConfigSignal = computed<DbxDownloadBlobButtonConfig>(() => ({
    blob: this.mergeBlobSignal(),
    fileName: this.fileNameSignal(),
    buttonStylePair: this.downloadButtonSignal()
  }));

  constructor() {
    this.store.entries$.pipe(takeUntilDestroyed()).subscribe((entries) => this.entriesChanged.emit(entries));

    effect(() => {
      const errorBytes = this.errorBytesSignal();
      this.store.setOutputSizeLimit(errorBytes);
    });

    effect(() => {
      const handling = this.encryptedHandlingSignal();
      this.store.setEncryptedHandling(handling);
    });

    effect(() => {
      const pageEditing = this.pageEditingSignal();
      this.store.setPageEditing(pageEditing);
    });

    effect(() => {
      const sidecar = this.sidecarSignal();
      this.store.setSidecar(sidecar);
    });
  }

  async onFiles(event: DbxFileUploadFilesChangedEvent): Promise<void> {
    const accepted = event.matchResult.accepted;

    if (accepted.length === 0) {
      return;
    }

    const imageCompression = this.imageCompressionConfigSignal();
    const entries = await Promise.all(accepted.map((file) => buildPdfMergeEntry(file, { imageCompression })));
    const filtered = entries.filter((entry): entry is PdfMergeEntry => entry != null);

    if (filtered.length > 0) {
      this.store.addFiles({ entries: filtered });
    }
  }

  /**
   * Clears the editor, resetting to a programmatic baseline when there is one. See {@link DbxPdfMergeEditorStore.clearEntries}.
   *
   * @returns The clear outcome, so a programmatic caller can tell a reset from an empty.
   */
  onClear(): Promise<DbxPdfMergeEditorClearEntriesResult> {
    return this.store.clearEntries({ restoreImport: this.restoreImportOnClearSignal() });
  }

  /**
   * Runs as the handler of the footer Clear button's own `dbxAction`, so the `dbxActionConfirm` on that action is what stands between a misclick and the whole entry list. Delegates to {@link onClear} so a programmatic clear and the button share one path.
   *
   * @returns An observable the action completes on — a restore re-parses the document, so this is not instantaneous.
   */
  readonly handleClear: WorkUsingObservable<unknown, void> = () => from(this.onClear()).pipe(map(() => undefined));

  onPreview(): void {
    if (!this.canMergeSignal()) {
      return;
    }

    const blob = this.mergeBlobSignal();

    if (blob == null) {
      this._pendingPreview.subscription = this.store.mergeOutput$.pipe(first()).subscribe((merged) => {
        this._pendingPreview.subscription = null;
        this.openPreviewDialog(merged);
      });
    } else {
      this._pendingPreview.subscription = null;
      this.openPreviewDialog(blob);
    }
  }

  private openPreviewDialog(blob: Blob): void {
    openPdfPreviewDialog(this._matDialog, {
      blob,
      downloadFileName: this.fileNameSignal(),
      width: '90vw',
      maxWidth: '1200px',
      height: '90vh'
    });
  }
}
