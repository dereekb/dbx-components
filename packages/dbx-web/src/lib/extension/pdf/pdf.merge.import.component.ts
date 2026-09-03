import { Component, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { PDF_MIME_TYPE, type Maybe } from '@dereekb/util';
import { type FileArrayAcceptMatchConfig } from '../../interaction/upload/upload.accept';
import { DbxFileUploadComponent, type DbxFileUploadMode } from '../../interaction/upload/upload.component';
import { type DbxFileUploadFilesChangedEvent } from '../../interaction/upload/abstract.upload.component';
import { DbxPdfMergeEditorStore, type DbxPdfMergeEditorImportResult, type DbxPdfMergeEditorImportState } from './pdf.merge.editor.store';
import { type PdfMergeSidecarImportErrorReason } from './pdf.merge.utility';

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
 * **Zero configuration.** The sections this editor accepts are read from the `<dbx-pdf-merge-editor-file-upload>` slots mounted against the shared {@link DbxPdfMergeEditorStore} (see {@link DbxPdfMergeEditorStore.registeredSlotIds$}), so the common case needs no bindings at all. A file naming any other section is rejected rather than partially imported — without that check, entries carrying an unrecognized slot id would import and then render nowhere.
 *
 * **Renders nothing when no sections are configured.** This component exists to split a document back into slots, so with no slots mounted (and no explicit {@link expectedSlotIds}) it has nothing to import into and collapses to zero size. Bind {@link enforceExpectedSlots} to `false` for the unusual case of an editor that wants the import affordance without declaring slots.
 *
 * @example
 * ```html
 * <!-- derives its sections from the slots below it -->
 * <dbx-pdf-merge-import (imported)="onImported($event)"></dbx-pdf-merge-import>
 * <dbx-pdf-merge-editor>
 *   <dbx-pdf-merge-editor-file-upload slotId="license"></dbx-pdf-merge-editor-file-upload>
 *   <dbx-pdf-merge-editor-file-upload slotId="cert"></dbx-pdf-merge-editor-file-upload>
 * </dbx-pdf-merge-editor>
 * ```
 */
@Component({
  selector: 'dbx-pdf-merge-import',
  template: `
    @if (activeSignal()) {
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
      @if (missingLabelSignal(); as missing) {
        <div class="dbx-pdf-merge-import-warning">
          <mat-icon class="dbx-pdf-merge-import-icon">warning</mat-icon>
          <span>{{ missing }}</span>
        </div>
      }
    }
  `,
  host: {
    class: 'dbx-pdf-merge-import',
    // Collapsed rather than merely emptied while inactive: without `d-block` the host is an empty
    // inline element of zero size, and dropping the margin keeps it from occupying layout.
    '[class.d-block]': 'activeSignal()',
    '[class.dbx-mb3]': 'activeSignal()'
  },
  imports: [MatIconModule, DbxFileUploadComponent]
})
export class DbxPdfMergeImportComponent {
  readonly store = inject(DbxPdfMergeEditorStore);

  readonly config = input<Maybe<DbxPdfMergeImportConfig>>();
  /**
   * Optional override for the slot ids this editor renders. Leave unbound to derive them from the slots mounted against the store — the zero-configuration default. When set, a file whose manifest names any other slot is rejected rather than partially imported.
   *
   * An explicitly bound empty array reads as "this editor deliberately has no sections" and hides the component, the same as having no slots mounted.
   */
  readonly expectedSlotIds = input<Maybe<readonly string[]>>();
  /**
   * Whether the imported file's sections must match this editor's. Defaults to `true`.
   *
   * Binding `false` is the single escape hatch for an editor with no slots that still wants the import affordance: it both skips the check and keeps the component rendered.
   */
  readonly enforceExpectedSlots = input<boolean>(true);

  readonly imported = output<DbxPdfMergeEditorImportResult>();
  readonly importFailed = output<string>();
  /**
   * Emits the expected sections the imported file did not fill, when there are any. The import itself still succeeds — a missing section is a partial state the user can fill in.
   */
  readonly missingSlots = output<readonly string[]>();

  private readonly _error = signal<Maybe<string>>(null);
  private readonly _result = signal<Maybe<DbxPdfMergeEditorImportResult>>(null);
  private readonly _missingSlotIds = signal<readonly string[]>([]);

  readonly errorSignal = this._error.asReadonly();
  readonly resultSignal = this._result.asReadonly();
  readonly missingSlotIdsSignal = this._missingSlotIds.asReadonly();

  private readonly _registeredSlotIdsSignal = toSignal(this.store.registeredSlotIds$, { initialValue: [] as readonly string[] });

  /**
   * The exact import state the notices below currently describe — the one this component's own picked file produced. Identity, not contents: it is the only reliable way to tell "still my file" from "the store moved on".
   */
  private _displayedState: Maybe<DbxPdfMergeEditorImportState>;

  constructor() {
    // The notices are set from what `onFiles` gets back rather than from `importState$`, so that
    // they only ever describe a file picked here. They must not outlive it, though: once the store
    // is showing anything other than this component's own import — cleared outright, restored to a
    // programmatic baseline, or replaced by an import from elsewhere — the notice is describing
    // content the editor no longer holds, and goes.
    this.store.importState$.pipe(takeUntilDestroyed()).subscribe((state) => {
      if (state !== this._displayedState) {
        this.resetDisplay();
      }
    });
  }

  /**
   * The sections an imported file is allowed to name, or `null` when no check applies. Resolves the explicit {@link expectedSlotIds} binding over the slots registered with the store.
   */
  readonly effectiveExpectedSlotIdsSignal = computed<Maybe<readonly string[]>>(() => {
    const registered = this._registeredSlotIdsSignal();
    const bound = this.expectedSlotIds();
    let expected: Maybe<readonly string[]>;

    if (!this.enforceExpectedSlots()) {
      expected = null;
    } else if (bound == null) {
      // An empty registry is "nothing declared yet", not "nothing allowed" — the component hides
      // rather than rejecting, so a null here never becomes a check that fails every file.
      expected = registered.length > 0 ? registered : null;
    } else {
      expected = bound;
    }

    return expected;
  });

  /**
   * Whether this component has anything to import into. `false` collapses it to nothing — see the class docs.
   */
  readonly activeSignal = computed<boolean>(() => {
    const expected = this.effectiveExpectedSlotIdsSignal();
    return !this.enforceExpectedSlots() || (expected != null && expected.length > 0);
  });

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

  /**
   * Warning shown when the imported file left one or more expected sections empty. The import succeeded — this only explains why a slot is still blank.
   */
  readonly missingLabelSignal = computed<Maybe<string>>(() => {
    const missing = this._missingSlotIds();
    return missing.length > 0 ? `This PDF did not include section(s): ${missing.join(', ')}.` : null;
  });

  async onFiles(event: DbxFileUploadFilesChangedEvent): Promise<void> {
    const file = event.matchResult.accepted[0];

    if (file != null) {
      this.resetDisplay();

      // Delegates to the store so the picker and a programmatic import share one implementation
      // and one set of error semantics. The slot check is opt-in on the store, so the component's
      // own resolved expectation is what preserves the picker's behavior. The returned state is
      // used rather than `importState$` so these outputs only ever describe a picked file.
      // `origin: 'user'` marks this as discardable — it must not become the store's clear-time
      // restore point, which belongs to whatever document the app itself supplied.
      const state = await this.store.importMergedPdf({ source: file, expectedSlotIds: this.effectiveExpectedSlotIdsSignal(), origin: 'user' });

      // Claim this state before rendering it: the subscription above resets on anything it does
      // not recognise, and the 'importing'/terminal emissions have already gone past by now.
      this._displayedState = state;

      if (state.status === 'failed') {
        this.fail(this.messageForFailure(state));
      } else if (state.result != null) {
        const { result } = state;

        this._result.set(result);
        this._missingSlotIds.set(result.missingSlotIds);
        this.imported.emit(result);

        if (result.missingSlotIds.length > 0) {
          this.missingSlots.emit(result.missingSlotIds);
        }
      }
    }
  }

  private messageForFailure(state: DbxPdfMergeEditorImportState): string {
    const unexpected: readonly Maybe<string>[] = state.unexpectedSlotIds ?? [];
    let message: string;

    if (state.error === 'unexpected_slots') {
      message = `This PDF contains section(s) this editor does not have: ${unexpected.map((slotId) => slotId ?? 'unsectioned').join(', ')}.`;
    } else {
      message = DBX_PDF_MERGE_IMPORT_ERROR_MESSAGES[state.error ?? 'unreadable'];
    }

    return message;
  }

  private fail(message: string): void {
    this._error.set(message);
    this.importFailed.emit(message);
  }

  /**
   * Drops every notice this component renders, returning it to its pre-import appearance and releasing its claim on the store's import state.
   */
  private resetDisplay(): void {
    this._displayedState = null;
    this._error.set(null);
    this._result.set(null);
    this._missingSlotIds.set([]);
  }
}
