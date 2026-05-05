import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { first } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { cleanSubscription } from '@dereekb/dbx-core';
import { type DbxButtonDisplayStylePair } from '../../button/button';
import { DbxButtonComponent } from '../../button/button.component';
import { DbxFileUploadComponent } from '../../interaction/upload/upload.component';
import { type DbxFileUploadFilesChangedEvent } from '../../interaction/upload/abstract.upload.component';
import { DbxDownloadBlobButtonComponent, type DbxDownloadBlobButtonConfig } from '../download/blob/download.blob.button.component';
import { type FileArrayAcceptMatchConfig } from '../../interaction/upload/upload.accept';
import { PDF_MERGE_DEFAULT_ACCEPT, type PdfMergeEntry } from './pdf.merge';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';
import { DbxPdfMergeListComponent } from './pdf.merge.list.component';
import { openPdfPreviewDialog } from './pdf.preview.dialog.component';

const DEFAULT_MERGED_FILE_NAME = 'merged.pdf';

const DEFAULT_DOWNLOAD_BUTTON: DbxButtonDisplayStylePair = {
  display: { icon: 'download', text: 'Download' },
  style: { type: 'stroked' }
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
@Component({
  selector: 'dbx-pdf-merge-editor',
  templateUrl: './pdf.merge.editor.component.html',
  host: {
    class: 'dbx-pdf-merge-editor'
  },
  imports: [DbxButtonComponent, DbxFileUploadComponent, DbxDownloadBlobButtonComponent, DbxPdfMergeListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPdfMergeEditorComponent {
  readonly store = inject(DbxPdfMergeEditorStore);
  private readonly _matDialog = inject(MatDialog);
  /**
   * Single-slot subscription tracker for the deferred Preview path. Replacing the slot cancels any earlier in-flight wait so rapid clicks (or repeated programmatic calls) cannot stack pending dialogs.
   */
  private readonly _pendingPreview = cleanSubscription();

  readonly accept = input<FileArrayAcceptMatchConfig['accept']>(PDF_MERGE_DEFAULT_ACCEPT as FileArrayAcceptMatchConfig['accept']);
  readonly multiple = input<boolean>(true);
  readonly fileName = input<string>(DEFAULT_MERGED_FILE_NAME);
  readonly showDownloadButton = input<boolean>(false);
  readonly showPreviewButton = input<boolean>(true);
  readonly downloadButton = input<Maybe<DbxButtonDisplayStylePair>>(DEFAULT_DOWNLOAD_BUTTON);
  /**
   * When `false`, hides the default "Add files" upload area. Use when projecting one or more {@link DbxPdfMergeEditorFileUploadComponent} slots through `<ng-content>` instead of relying on the unscoped uploader.
   */
  readonly showAddFiles = input<boolean>(true);
  /**
   * When `false`, hides the shared {@link DbxPdfMergeListComponent} below the slot content. Useful when each slot displays its owned files inline and you don't want a duplicate unified list.
   */
  readonly showFileList = input<boolean>(true);

  readonly entriesChanged = output<readonly PdfMergeEntry[]>();

  readonly hasReadyEntriesSignal = toSignal(this.store.hasReadyEntries$, { initialValue: false });
  readonly entryCountSignal = toSignal(this.store.entryCount$, { initialValue: 0 });
  /**
   * Mirrors {@link DbxPdfMergeEditorStore.isValid$}. Defaults to `true` when no validator delegate is registered, so the Preview/Download buttons are gated only by the registered validator's output (if any).
   */
  readonly isValidSignal = toSignal(this.store.isValid$, { initialValue: true });

  /**
   * Computed gate for the Preview and Download affordances. Disabled while no entry is `ready` or while the registered validator delegate reports invalid.
   */
  readonly canMergeSignal = computed(() => this.hasReadyEntriesSignal() && this.isValidSignal());

  /**
   * Latest merged blob (or `undefined` while validation/merge is in flight or no entries are ready). Sourced from {@link DbxPdfMergeEditorStore.currentMergeOutput$} so the download button always reflects the current merge without needing the user to click Preview first.
   */
  readonly mergeBlobSignal = toSignal(this.store.currentMergeOutput$, { initialValue: undefined });

  readonly downloadConfigSignal = computed<DbxDownloadBlobButtonConfig>(() => ({
    blob: this.mergeBlobSignal(),
    fileName: this.fileName(),
    buttonStylePair: this.downloadButton() ?? DEFAULT_DOWNLOAD_BUTTON
  }));

  constructor() {
    this.store.entries$.pipe(takeUntilDestroyed()).subscribe((entries) => this.entriesChanged.emit(entries));
  }

  onFiles(event: DbxFileUploadFilesChangedEvent): void {
    if (event.matchResult.accepted.length > 0) {
      this.store.addFiles({ files: event.matchResult.accepted });
    }
  }

  onClear(): void {
    this.store.clearAll();
  }

  onPreview(): void {
    if (!this.canMergeSignal()) {
      return;
    }

    const blob = this.mergeBlobSignal();

    if (blob != null) {
      this._pendingPreview.subscription = null;
      this.openPreviewDialog(blob);
    } else {
      this._pendingPreview.subscription = this.store.mergeOutput$.pipe(first()).subscribe((merged) => {
        this._pendingPreview.subscription = null;
        this.openPreviewDialog(merged);
      });
    }
  }

  private openPreviewDialog(blob: Blob): void {
    openPdfPreviewDialog(this._matDialog, {
      blob,
      downloadFileName: this.fileName(),
      width: '90vw',
      maxWidth: '1200px',
      height: '90vh'
    });
  }
}
