import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AsyncPipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, finalize, type Observable } from 'rxjs';
import { type Maybe } from '@dereekb/util';
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

/**
 * Editor that lets the user collect PDFs and images, reorder them via drag-and-drop, and produce a single merged PDF. Reads from an ancestor-provided {@link DbxPdfMergeEditorStore} and emits the merged blob via the `merged` output. Optionally embeds a {@link DbxDownloadBlobButtonComponent} to offer a download affordance for the most recent merge.
 *
 * The parent view (or another directive) is responsible for providing {@link DbxPdfMergeEditorStore} so the editor and its peer components ({@link DbxPdfMergeListComponent}, {@link DbxPdfMergeEntryComponent}) share the same instance.
 *
 * @example
 * ```html
 * <dbx-pdf-merge-editor (merged)="onMerged($event)" [showDownloadButton]="true" fileName="receipts.pdf"></dbx-pdf-merge-editor>
 * ```
 */
@Component({
  selector: 'dbx-pdf-merge-editor',
  templateUrl: './pdf.merge.editor.component.html',
  host: {
    class: 'dbx-pdf-merge-editor'
  },
  imports: [AsyncPipe, DbxButtonComponent, DbxFileUploadComponent, DbxDownloadBlobButtonComponent, DbxPdfMergeListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPdfMergeEditorComponent {
  readonly store = inject(DbxPdfMergeEditorStore);
  private readonly _matDialog = inject(MatDialog);
  private readonly _destroyRef = inject(DestroyRef);

  readonly accept = input<FileArrayAcceptMatchConfig['accept']>(PDF_MERGE_DEFAULT_ACCEPT as FileArrayAcceptMatchConfig['accept']);
  readonly multiple = input<boolean>(true);
  readonly fileName = input<string>(DEFAULT_MERGED_FILE_NAME);
  readonly showDownloadButton = input<boolean>(false);
  readonly showPreviewButton = input<boolean>(true);

  readonly merged = output<Blob>();
  readonly entriesChanged = output<readonly PdfMergeEntry[]>();

  private readonly _lastBlobSignal = signal<Maybe<Blob>>(undefined);
  private readonly _merging$ = new BehaviorSubject<boolean>(false);

  readonly hasReadyEntries$ = this.store.hasReadyEntries$;
  readonly entryCount$ = this.store.entryCount$;
  readonly mergeError$ = this.store.mergeError$;
  readonly merging$: Observable<boolean> = this._merging$.asObservable();

  readonly lastBlobSignal = this._lastBlobSignal.asReadonly();

  readonly downloadConfigSignal = computed<DbxDownloadBlobButtonConfig>(() => ({
    blob: this._lastBlobSignal(),
    fileName: this.fileName(),
    buttonDisplay: { icon: 'download', text: 'Download' },
    buttonStyle: { type: 'stroked' }
  }));

  constructor() {
    this.store.entries$.pipe(takeUntilDestroyed()).subscribe((entries) => this.entriesChanged.emit(entries));
  }

  onFiles(event: DbxFileUploadFilesChangedEvent): void {
    if (event.matchResult.accepted.length > 0) {
      this.store.addFiles(event.matchResult.accepted);
    }
  }

  onClear(): void {
    this._lastBlobSignal.set(undefined);
    this.store.clearAll();
  }

  onPreview(): void {
    const blob = this._lastBlobSignal();

    if (blob != null) {
      this.openPreviewDialog(blob);
    } else if (!this._merging$.value) {
      this._merging$.next(true);
      this.store.mergeOutput$
        .pipe(
          finalize(() => this._merging$.next(false)),
          takeUntilDestroyed(this._destroyRef)
        )
        .subscribe((merged) => {
          this.handleMergedBlob(merged);
          this.openPreviewDialog(merged);
        });
    }
  }

  private handleMergedBlob(blob: Blob): void {
    this._lastBlobSignal.set(blob);
    this.merged.emit(blob);
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
