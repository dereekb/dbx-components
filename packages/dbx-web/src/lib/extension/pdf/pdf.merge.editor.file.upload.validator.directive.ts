import { Directive, inject, type OnDestroy, type OnInit } from '@angular/core';
import { BehaviorSubject, combineLatest, distinctUntilChanged, map, type Observable, of, shareReplay, switchMap } from 'rxjs';
import { completeOnDestroy } from '@dereekb/dbx-core';
import { type DbxPdfMergeEditorFileUploadValidatorSlot } from './pdf.merge';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';

/**
 * Directive that registers as the active {@link DbxPdfMergeEditorValidator} on a {@link DbxPdfMergeEditorStore} and gates merge emissions on the readiness of every registered slot. {@link DbxPdfMergeEditorFileUploadComponent} instances walk the injector tree, find this directive, and call {@link registerSlot}/{@link unregisterSlot} during their own lifecycle.
 *
 * @example
 * ```html
 * <dbx-pdf-merge-editor [showAddFiles]="false" [showFileList]="false">
 *   <div dbxPdfMergeEditorFileUploadValidator>
 *     <dbx-pdf-merge-editor-file-upload slotId="license" [config]="{ label: 'Driver’s License' }"></dbx-pdf-merge-editor-file-upload>
 *     <dbx-pdf-merge-editor-file-upload slotId="insurance" [config]="{ label: 'Insurance Card', required: false }"></dbx-pdf-merge-editor-file-upload>
 *   </div>
 * </dbx-pdf-merge-editor>
 * ```
 */
@Directive({
  selector: '[dbxPdfMergeEditorFileUploadValidator]',
  standalone: true
})
export class DbxPdfMergeEditorFileUploadValidatorDirective implements OnInit, OnDestroy {
  readonly store = inject(DbxPdfMergeEditorStore);

  private readonly _slots$ = completeOnDestroy(new BehaviorSubject<readonly DbxPdfMergeEditorFileUploadValidatorSlot[]>([]));

  /**
   * Emits `true` when every registered slot reports valid (or when no slots are registered yet). Multicast via {@link shareReplay}.
   */
  readonly isValid$: Observable<boolean> = this._slots$.pipe(
    switchMap((slots) => {
      let next$: Observable<boolean>;

      if (slots.length === 0) {
        next$ = of(true);
      } else {
        next$ = combineLatest(slots.map((slot) => slot.isValid$)).pipe(map((values) => values.every(Boolean)));
      }

      return next$;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  ngOnInit(): void {
    this.store.setValidator(() => this.isValid$);
  }

  ngOnDestroy(): void {
    this.store.clearValidator();
  }

  /**
   * Adds a slot to the active set. Idempotent — registering the same slot twice has no effect.
   *
   * @param slot - Slot component to track.
   */
  registerSlot(slot: DbxPdfMergeEditorFileUploadValidatorSlot): void {
    const current = this._slots$.value;

    if (!current.includes(slot)) {
      this._slots$.next([...current, slot]);
    }
  }

  /**
   * Removes a slot from the active set. No-op when the slot is not currently registered.
   *
   * @param slot - Slot component to drop.
   */
  unregisterSlot(slot: DbxPdfMergeEditorFileUploadValidatorSlot): void {
    const current = this._slots$.value;
    const next = current.filter((existing) => existing !== slot);

    if (next.length !== current.length) {
      this._slots$.next(next);
    }
  }
}
