import { Directive, computed, effect, inject, input } from '@angular/core';
import { type FileSize, type Maybe } from '@dereekb/util';
import { DBX_PDF_MERGE_EDITOR_CONFIG, type DbxPdfMergeEditorConfig } from './pdf.merge';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';

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
  standalone: true,
  providers: [DbxPdfMergeEditorStore],
  exportAs: 'dbxPdfMergeEditorStore'
})
export class DbxPdfMergeEditorStoreDirective {
  readonly store = inject(DbxPdfMergeEditorStore);
  private readonly _injectedConfig = inject(DBX_PDF_MERGE_EDITOR_CONFIG, { optional: true });

  readonly config = input<Maybe<DbxPdfMergeEditorConfig>>();
  readonly outputSizeLimit = input<Maybe<FileSize>>();

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
  }
}
