import { Directive, inject } from '@angular/core';
import { first, switchMap } from 'rxjs';
import { DbxActionContextStoreSourceInstance, cleanSubscriptionWithLockSet } from '@dereekb/dbx-core';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';

/**
 * Bridges an ancestor `dbxAction` to an ancestor {@link DbxPdfMergeEditorStore}: when the action's `triggered$` fires, the directive reads the latest `mergeOutput$` from the store and calls `source.readyValue(blob)` so the action handler runs with the merged PDF.
 *
 * Action-aware companion to {@link DbxPdfMergeUploadButtonDirective}, which is intentionally action-blind. Together with the stock `dbxActionButton`, all three compose on a single `<dbx-button>`:
 *
 * - `dbxActionButton` fires `source.trigger()` on click and reflects the action's working/disabled state on the button.
 * - `dbxPdfMergeUploadButton` opens the merge dialog and only allows the click to propagate if the user confirms.
 * - `dbxPdfMergeUploadAction` (this directive) listens for `triggered$` and supplies the store's merge output to the action.
 *
 * The trigger-then-readyValue ordering matches the canonical {@link DbxActionContextStoreSourceInstance.triggerWithValue} flow — `readyValue` is only honored after `trigger()` has moved the state out of `IDLE`, so listening to `triggered$` is what makes the value actually reach the handler.
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
  selector: '[dbxPdfMergeUploadAction]',
  standalone: true
})
export class DbxPdfMergeUploadActionDirective {
  readonly source = inject<DbxActionContextStoreSourceInstance<Blob, unknown>>(DbxActionContextStoreSourceInstance);
  readonly store = inject(DbxPdfMergeEditorStore);

  constructor() {
    cleanSubscriptionWithLockSet({
      lockSet: this.source.lockSet,
      sub: this.source.triggered$.pipe(switchMap(() => this.store.mergeOutput$.pipe(first()))).subscribe((blob) => {
        this.source.readyValue(blob);
      })
    });
  }
}
