import { Directive, inject, input } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, distinctUntilChanged, map, type Observable } from 'rxjs';
import { type ArrayOrValue, asArray, type Maybe } from '@dereekb/util';
import { AbstractIfDirective } from '@dereekb/dbx-core';
import { DbxPdfMergeEditorFileUploadComponent, type DbxPdfMergeEditorFileUploadState } from './pdf.merge.editor.file.upload.component';

/**
 * Structural directive that conditionally renders its host element based on the current state of an ancestor {@link DbxPdfMergeEditorFileUploadComponent}.
 *
 * Use it inside a slot's projected header content to render state-aware indicators — icons, badges, status text — without subscribing to the slot's `state$` manually.
 *
 * @example
 * ```html
 * <dbx-pdf-merge-editor-file-upload slotId="license" [config]="licenseConfig">
 *   <mat-icon *dbxPdfMergeEditorFileUploadHasState="'valid'">check_circle</mat-icon>
 *   <mat-icon *dbxPdfMergeEditorFileUploadHasState="'invalid'">error</mat-icon>
 *   <mat-icon *dbxPdfMergeEditorFileUploadHasState="['no_file', 'invalid']">radio_button_unchecked</mat-icon>
 * </dbx-pdf-merge-editor-file-upload>
 * ```
 */
@Directive({
  selector: '[dbxPdfMergeEditorFileUploadHasState]',
  standalone: true
})
export class DbxPdfMergeEditorFileUploadHasStateDirective extends AbstractIfDirective {
  private readonly _slot = inject(DbxPdfMergeEditorFileUploadComponent);

  readonly targetState = input<Maybe<ArrayOrValue<DbxPdfMergeEditorFileUploadState>>>(undefined, { alias: 'dbxPdfMergeEditorFileUploadHasState' });
  readonly targetState$ = toObservable(this.targetState);

  readonly show$: Observable<boolean> = combineLatest([this._slot.state$, this.targetState$]).pipe(
    map(([state, target]) => {
      const targets = asArray(target);
      return targets.includes(state);
    }),
    distinctUntilChanged()
  );
}
