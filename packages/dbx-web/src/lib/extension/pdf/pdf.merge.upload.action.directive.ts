import { Directive, inject } from '@angular/core';
import { first } from 'rxjs';
import { AbstractDbxActionValueGetterDirective, type AbstractDbxActionValueGetterDirectiveConfig } from '@dereekb/dbx-core';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';

/**
 * Bridges an ancestor `dbxAction` to an ancestor {@link DbxPdfMergeEditorStore}: when the action is triggered, the directive reads the latest `mergeOutput$` from the store and readies it as the action value so the action handler runs with the merged PDF.
 *
 * Action-aware companion to {@link DbxPdfMergeUploadButtonDirective}, which is intentionally action-blind. Together with the stock `dbxActionButton`, all three compose on a single `<dbx-button>`:
 *
 * - `dbxActionButton` fires `source.trigger()` on click and reflects the action's working/disabled state on the button.
 * - `dbxPdfMergeUploadButton` opens the merge dialog and only allows the click to propagate if the user confirms.
 * - `dbxPdfMergeUploadAction` (this directive) supplies the store's merge output to the action when it is triggered.
 *
 * Extends {@link AbstractDbxActionValueGetterDirective}, which calls the getter on each TRIGGERED edge. No value snapshot is registered, since reading the merge output starts a merge.
 *
 * @example
 * ```html
 * <div dbxAction [dbxActionHandler]="handleUpload">
 *   <div dbxPdfMergeEditorStore>
 *     <dbx-button text="Upload PDF" raised color="primary" dbxActionButton dbxPdfMergeUploadAction dbxPdfMergeUploadButton></dbx-button>
 *   </div>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxPdfMergeUploadAction]'
})
export class DbxPdfMergeUploadActionDirective extends AbstractDbxActionValueGetterDirective<Blob> {
  readonly store = inject(DbxPdfMergeEditorStore);

  constructor() {
    super();
    this.setValueGetterFunction(() => this.store.mergeOutput$.pipe(first()));
  }

  protected override valueGetterConfig(): AbstractDbxActionValueGetterDirectiveConfig {
    return { registerValueSnapshot: false };
  }
}
