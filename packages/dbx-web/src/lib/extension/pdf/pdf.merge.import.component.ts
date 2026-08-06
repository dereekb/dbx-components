import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PDF_MIME_TYPE, type Maybe } from '@dereekb/util';
import { type FileArrayAcceptMatchConfig } from '../../interaction/upload/upload.accept';
import { DbxFileUploadComponent, type DbxFileUploadMode } from '../../interaction/upload/upload.component';
import { type DbxFileUploadFilesChangedEvent } from '../../interaction/upload/abstract.upload.component';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';
import { buildPdfMergeEntriesFromSidecar, type PdfMergeSidecarImportErrorReason, type PdfMergeSidecarImportResult } from './pdf.merge.utility';

/**
 * Messages shown for each reason an import can fail.
 */
export const DBX_PDF_MERGE_IMPORT_ERROR_MESSAGES: Record<PdfMergeSidecarImportErrorReason, string> = {
  unreadable: 'This file could not be read as a PDF. It may be corrupt or password protected.',
  no_sidecar: 'This PDF has no embedded manifest, so its pages cannot be matched back to sections. Choose a PDF that was exported from this editor.',
  no_documents: 'This PDF has a manifest, but none of its recorded pages could be found in the file.'
};

/**
 * Configures the appearance of a {@link DbxPdfMergeImportComponent}.
 */
export interface DbxPdfMergeImportConfig {
  readonly label?: Maybe<string>;
  readonly hint?: Maybe<string | boolean>;
  readonly text?: Maybe<string>;
  readonly icon?: Maybe<string>;
  readonly mode?: Maybe<DbxFileUploadMode>;
  readonly accept?: Maybe<FileArrayAcceptMatchConfig['accept']>;
}

/**
 * Loads a PDF that was previously exported from the editor with an embedded manifest, and repopulates the editor's slots from it.
 *
 * This is the payoff of the sidecar: a completed single-file document goes back to being the set of per-slot documents it was assembled from, so a user can replace or edit one section in place instead of rebuilding the whole file. Every entry currently in the store is replaced.
 *
 * Bind {@link expectedSlotIds} to reject a file whose sections do not belong to this editor — without it, entries carrying an unrecognized slot id would be imported and then render nowhere.
 *
 * @example
 * ```html
 * <dbx-pdf-merge-import [expectedSlotIds]="['license', 'cert']" (imported)="onImported($event)"></dbx-pdf-merge-import>
 * ```
 */
@Component({
  selector: 'dbx-pdf-merge-import',
  template: `
    @if (labelSignal(); as label) {
      <div class="dbx-pdf-merge-import-label">{{ label }}</div>
    }
    <dbx-file-upload [accept]="acceptSignal()" [multiple]="false" [mode]="modeSignal()" [hint]="hintSignal()" [text]="textSignal()" [icon]="iconSignal()" (filesChanged)="onFiles($event)"></dbx-file-upload>
    @if (errorSignal(); as error) {
      <div class="dbx-pdf-merge-import-error">
        <mat-icon class="dbx-pdf-merge-import-icon">error</mat-icon>
        <span>{{ error }}</span>
      </div>
    }
    @if (successLabelSignal(); as success) {
      <div class="dbx-pdf-merge-import-success">
        <mat-icon class="dbx-pdf-merge-import-icon">check_circle</mat-icon>
        <span>{{ success }}</span>
      </div>
    }
  `,
  host: {
    class: 'dbx-pdf-merge-import d-block dbx-mb3'
  },
  imports: [MatIconModule, DbxFileUploadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPdfMergeImportComponent {
  readonly store = inject(DbxPdfMergeEditorStore);

  readonly config = input<Maybe<DbxPdfMergeImportConfig>>();
  /**
   * Slot ids this editor renders. When set, a file whose manifest names any other slot is rejected rather than partially imported.
   */
  readonly expectedSlotIds = input<Maybe<readonly string[]>>();

  readonly imported = output<PdfMergeSidecarImportResult>();
  readonly importFailed = output<string>();

  private readonly _error = signal<Maybe<string>>(null);
  private readonly _result = signal<Maybe<PdfMergeSidecarImportResult>>(null);

  readonly errorSignal = this._error.asReadonly();
  readonly resultSignal = this._result.asReadonly();

  readonly acceptSignal = computed<FileArrayAcceptMatchConfig['accept']>(() => this.config()?.accept ?? ([PDF_MIME_TYPE] as FileArrayAcceptMatchConfig['accept']));
  readonly modeSignal = computed<DbxFileUploadMode>(() => this.config()?.mode ?? 'default');
  readonly labelSignal = computed(() => this.config()?.label);
  readonly hintSignal = computed(() => this.config()?.hint ?? 'Choose a PDF previously exported from this editor');
  readonly textSignal = computed(() => this.config()?.text ?? 'Import merged PDF');
  readonly iconSignal = computed(() => this.config()?.icon ?? 'upload_file');

  readonly successLabelSignal = computed<Maybe<string>>(() => {
    const result = this._result();
    let label: Maybe<string>;

    if (result == null) {
      label = null;
    } else {
      const sections = result.slotIds.map((slotId) => slotId ?? 'unsectioned').join(', ');
      label = `Imported ${result.entries.length} section(s): ${sections}.`;
    }

    return label;
  });

  async onFiles(event: DbxFileUploadFilesChangedEvent): Promise<void> {
    const file = event.matchResult.accepted[0];

    if (file == null) {
      return;
    }

    this._error.set(null);
    this._result.set(null);

    const outcome = await buildPdfMergeEntriesFromSidecar(file);

    if ('error' in outcome) {
      this.fail(DBX_PDF_MERGE_IMPORT_ERROR_MESSAGES[outcome.error]);
    } else {
      const expected = this.expectedSlotIds();
      const unexpected = expected == null ? [] : outcome.slotIds.filter((slotId) => slotId == null || !expected.includes(slotId));

      if (unexpected.length > 0) {
        this.fail(`This PDF contains section(s) this editor does not have: ${unexpected.map((slotId) => slotId ?? 'unsectioned').join(', ')}.`);
      } else {
        this.store.replaceEntries(outcome.entries);
        this._result.set(outcome);
        this.imported.emit(outcome);
      }
    }
  }

  private fail(message: string): void {
    this._error.set(message);
    this.importFailed.emit(message);
  }
}
