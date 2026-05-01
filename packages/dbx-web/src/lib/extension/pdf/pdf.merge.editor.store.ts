import { Injectable } from '@angular/core';
import { moveItemInArray } from '@angular/cdk/drag-drop';
import { ComponentStore } from '@ngrx/component-store';
import { catchError, distinctUntilChanged, EMPTY, first, from, map, mergeMap, type Observable, shareReplay, switchMap, tap } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { type PdfMergeEditorState, type PdfMergeEntry, type PdfMergeEntryMove, type PdfMergeEntryStatusUpdate } from './pdf.merge';
import { buildPdfMergeEntry, mergePdfMergeEntries, validatePdfMergeEntry } from './pdf.merge.utility';

/**
 * Initial state used by {@link DbxPdfMergeEditorStore} — no entries, no error.
 */
export const DBX_PDF_MERGE_EDITOR_INITIAL_STATE: PdfMergeEditorState = {
  entries: []
};

/**
 * Component-scoped {@link ComponentStore} that owns the list of files staged for merging in the PDF merge editor. Provides selectors for the entry list and merge readiness, updaters for add/remove/reorder/clear, an effect for validating new entries, and a {@link mergeOutput$} observable that emits each merged PDF blob.
 */
@Injectable()
export class DbxPdfMergeEditorStore extends ComponentStore<PdfMergeEditorState> {
  constructor() {
    super(DBX_PDF_MERGE_EDITOR_INITIAL_STATE);
  }

  // MARK: Selectors
  readonly entries$: Observable<PdfMergeEntry[]> = this.select((state) => state.entries);

  readonly entryCount$: Observable<number> = this.entries$.pipe(
    map((entries) => entries.length),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly hasReadyEntries$: Observable<boolean> = this.entries$.pipe(
    map((entries) => entries.some((entry) => entry.status === 'ready')),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly mergeError$: Observable<Maybe<string>> = this.select((state) => state.mergeError);

  // MARK: Updaters
  readonly addEntries = this.updater((state, added: PdfMergeEntry[]) => ({ ...state, entries: [...state.entries, ...added] }));

  readonly removeEntry = this.updater((state, id: string) => ({ ...state, entries: state.entries.filter((entry) => entry.id !== id) }));

  readonly moveEntry = this.updater((state, move: PdfMergeEntryMove) => {
    if (move.previousIndex === move.currentIndex) {
      return state;
    }

    const next = [...state.entries];
    moveItemInArray(next, move.previousIndex, move.currentIndex);
    return { ...state, entries: next };
  });

  readonly setEntryStatus = this.updater((state, update: PdfMergeEntryStatusUpdate) => ({
    ...state,
    entries: state.entries.map((entry) => (entry.id === update.id ? { ...entry, status: update.status, errorMessage: update.errorMessage } : entry))
  }));

  readonly clearAll = this.updater((state) => ({ ...state, entries: [], mergeError: undefined }));

  private readonly setMergeError = this.updater((state, mergeError: Maybe<string>) => ({ ...state, mergeError }));

  // MARK: Effects
  readonly addFiles = this.effect((files$: Observable<readonly File[]>) =>
    files$.pipe(
      tap((files) => {
        const newEntries = files.map((file) => buildPdfMergeEntry(file)).filter((entry): entry is PdfMergeEntry => entry != null);

        if (newEntries.length > 0) {
          this.addEntries(newEntries);
          newEntries.forEach((entry) => this.validateEntry(entry));
        }
      })
    )
  );

  readonly validateEntry = this.effect((entry$: Observable<PdfMergeEntry>) =>
    entry$.pipe(
      mergeMap((entry) =>
        from(validatePdfMergeEntry(entry)).pipe(
          tap((result) =>
            this.setEntryStatus({
              id: entry.id,
              status: result.ok ? 'ready' : 'error',
              errorMessage: result.ok ? undefined : (result.error ?? 'Validation failed.')
            })
          )
        )
      )
    )
  );

  /**
   * Reads the current entries and emits the resulting PDF blob. Each subscription triggers a new merge; failures are recorded on {@link mergeError$}.
   */
  readonly mergeOutput$: Observable<Blob> = this.entries$.pipe(
    first(),
    tap(() => this.setMergeError(undefined)),
    switchMap((entries) => from(mergePdfMergeEntries(entries))),
    catchError((err: unknown) => {
      this.setMergeError((err as Error)?.message ?? 'Failed to merge PDFs.');
      return EMPTY;
    })
  );
}
