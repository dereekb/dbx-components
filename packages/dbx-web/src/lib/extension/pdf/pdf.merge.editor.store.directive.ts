import { Directive, computed, effect, inject, input, untracked } from '@angular/core';
import { type FileSize, type Maybe } from '@dereekb/util';
import { DBX_PDF_MERGE_EDITOR_CONFIG, type DbxPdfMergeEditorConfig } from './pdf.merge';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';

/**
 * Options applied to the blob bound to {@link DbxPdfMergeEditorStoreDirective.source}. Mirrors the tail of {@link DbxPdfMergeEditorImportMergedPdfInput}.
 */
export interface DbxPdfMergeEditorSourceConfig {
  /**
   * Sections the source is allowed to name. Omit to skip the check — the default, since a bound source usually arrives before any slot has mounted.
   */
  readonly expectedSlotIds?: Maybe<readonly string[]>;
  /**
   * When `true`, a readable PDF with no manifest loads as one unslotted entry instead of failing. Defaults to `false`.
   */
  readonly allowWithoutSidecar?: Maybe<boolean>;
  /**
   * File name to give a bare {@link Blob} loaded through the sidecar-less fallback.
   */
  readonly fileName?: Maybe<string>;
}

/**
 * Provides a {@link DbxPdfMergeEditorStore} on its host element so descendant components (including {@link DbxPdfMergeUploadButtonComponent} and any dialog opened with the host's injector) share the same store instance. Optionally pushes configuration onto the store via inputs.
 *
 * The directive only writes to {@link DbxPdfMergeEditorStore.setOutputSizeLimit} when {@link outputSizeLimit} or {@link config}'s `outputSizeLimits.errorBytes` is explicitly bound — leaving the embedded {@link DbxPdfMergeEditorComponent}'s own effect free to handle the case where the editor is configured directly. Falls back to the workspace-wide {@link DBX_PDF_MERGE_EDITOR_CONFIG} token when neither input is set.
 *
 * @example
 * ```html
 * <div dbxPdfMergeEditorStore [config]="{ outputSizeLimits: { errorBytes: 8 * 1024 * 1024 } }">
 *   <dbx-pdf-merge-upload-button></dbx-pdf-merge-upload-button>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxPdfMergeEditorStore]',
  providers: [DbxPdfMergeEditorStore],
  exportAs: 'dbxPdfMergeEditorStore'
})
export class DbxPdfMergeEditorStoreDirective {
  readonly store = inject(DbxPdfMergeEditorStore);
  private readonly _injectedConfig = inject(DBX_PDF_MERGE_EDITOR_CONFIG, { optional: true });

  readonly config = input<Maybe<DbxPdfMergeEditorConfig>>();
  readonly outputSizeLimit = input<Maybe<FileSize>>();
  /**
   * A previously-exported merged PDF to load into the store, for an app that fetches a stored document itself and wants the editor to open already populated — no picker involved.
   *
   * Imported once per distinct blob instance: re-emitting the same object does nothing, so a template re-render or an unrelated input change cannot re-import. Emitting a *different* blob imports again and replaces the entries, even if the bytes are identical.
   *
   * Watch {@link DbxPdfMergeEditorStore.importState$} for the outcome — a failure surfaces there rather than throwing.
   */
  readonly source = input<Maybe<Blob>>();
  readonly sourceConfig = input<Maybe<DbxPdfMergeEditorSourceConfig>>();

  /**
   * The blob instance most recently handed to the store, so the same one is never imported twice.
   */
  private _importedSource: Maybe<Blob>;

  readonly effectiveErrorBytesSignal = computed<Maybe<FileSize>>(() => {
    const direct = this.outputSizeLimit();

    if (direct != null) {
      return direct;
    }

    const fromInput = this.config()?.outputSizeLimits?.errorBytes;

    if (fromInput != null) {
      return fromInput;
    }

    return this._injectedConfig?.outputSizeLimits?.errorBytes;
  });

  constructor() {
    effect(() => {
      const errorBytes = this.effectiveErrorBytesSignal();

      if (errorBytes != null) {
        this.store.setOutputSizeLimit(errorBytes);
      }
    });

    // Push the directive's image-compression config onto the store so it reaches the
    // upload dialog's bare <dbx-pdf-merge-editor> (which renders with no own [config]).
    // Only the store directive pushes — the editor reads the store as the middle tier of
    // its resolution chain (own [config] → store → token) — so the bare editor never
    // clobbers this value with an empty config.
    effect(() => {
      this.store.setImageCompression(this.config()?.imageCompression);
    });

    // Same channel for encryptedHandling — pushes the directive-level mode onto the store
    // so any descendant editor (including the upload dialog's bare editor) picks it up.
    effect(() => {
      this.store.setEncryptedHandling(this.config()?.encryptedHandling);
    });

    // Same channel for pageEditing, so a dialog-hosted editor opens straight into page
    // editing mode when the host directive asked for it.
    effect(() => {
      this.store.setPageEditing(this.config()?.pageEditing);
    });

    // Same channel for the embedded manifest. Gated separately from pageEditing — a plain
    // slot merge benefits from recording which pages came from which slot too.
    effect(() => {
      this.store.setSidecar(this.config()?.sidecar);
    });

    // Loading a source is not idempotent the way the setters above are — it REPLACES the store's
    // entries — so this tracks only `source` and guards on instance identity. `sourceConfig` is
    // read untracked so changing it never re-imports; it is read at the moment a new blob arrives.
    effect(() => {
      const source = this.source();

      if (source != null && source !== this._importedSource) {
        this._importedSource = source;

        const sourceConfig = untracked(() => this.sourceConfig());
        void this.store.importMergedPdf({ source, expectedSlotIds: sourceConfig?.expectedSlotIds, allowWithoutSidecar: sourceConfig?.allowWithoutSidecar, fileName: sourceConfig?.fileName });
      }
    });
  }
}
