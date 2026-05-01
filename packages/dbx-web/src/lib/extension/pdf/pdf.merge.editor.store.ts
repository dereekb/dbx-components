import { Injectable } from '@angular/core';
import { moveItemInArray } from '@angular/cdk/drag-drop';
import { ComponentStore } from '@ngrx/component-store';
import { catchError, combineLatest, defaultIfEmpty, distinctUntilChanged, from, map, type Observable, of, shareReplay, startWith, switchMap } from 'rxjs';
import { type Building, type Maybe } from '@dereekb/util';
import { type PdfMergeEditorState, type PdfMergeEntry, type PdfMergeEntryMove, type PdfMergeEntryStatus } from './pdf.merge';
import { buildPdfMergeEntry, mergePdfMergeEntries } from './pdf.merge.utility';
import { filterMaybe } from '@dereekb/rxjs';

/**
 * Initial state used by {@link DbxPdfMergeEditorStore} — no entries.
 */
export const DBX_PDF_MERGE_EDITOR_INITIAL_STATE: PdfMergeEditorState = {
  rawEntries: []
};

/**
 * Component-scoped {@link ComponentStore} that owns the list of files staged for merging in the PDF merge editor. Each {@link PdfMergeEntry} carries its own validation promise from the moment it is built; {@link entries$} composes those promises into a live stream — emitting the entry first in `validating` state and then again as each promise resolves to `ready` or `error`. {@link mergeOutput$} emits the merged PDF blob once every entry has finished validating and at least one is `ready`.
 */
@Injectable()
export class DbxPdfMergeEditorStore extends ComponentStore<PdfMergeEditorState> {
  constructor() {
    super(DBX_PDF_MERGE_EDITOR_INITIAL_STATE);
  }

  // MARK: Selectors
  /**
   * Live entry list. Each raw entry's {@link PdfMergeEntry.validation} promise is mapped onto its status: while pending, the entry is emitted with status `validating`; once resolved, the entry is mutated to `ready`/`error` and re-emitted. Subsequent emissions of the underlying state pass already-resolved entries through unchanged.
   */
  readonly entries$: Observable<PdfMergeEntry[]> = this.select((state) => state.rawEntries).pipe(
    switchMap((rawEntries) =>
      combineLatest(
        rawEntries.map((entry) => {
          let entry$: Observable<PdfMergeEntry>;

          if (entry.status === 'validating') {
            entry$ = from(entry.validation).pipe(
              map((validationResult) => {
                let status: PdfMergeEntryStatus;

                if (validationResult.ok) {
                  status = 'ready';
                } else {
                  status = 'error';
                }

                (entry as Building<PdfMergeEntry>).status = status;
                (entry as Building<PdfMergeEntry>).errorMessage = validationResult.errorMessage;

                return entry;
              }),
              startWith(entry)
            );
          } else {
            entry$ = of(entry);
          }

          return entry$;
        })
      ).pipe(defaultIfEmpty([] as PdfMergeEntry[]))
    ),
    shareReplay(1)
  );

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

  /**
   * Emits `true` while any entry's validation promise has not yet resolved (i.e. one or more entries are still in `validating` status).
   */
  readonly isValidating$: Observable<boolean> = this.entries$.pipe(
    map((entries) => entries.some((entry) => entry.status === 'validating')),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Emits the merged PDF blob whenever every entry has finished validating (see {@link isValidating$}) and at least one is `ready`. Emits `undefined` while validation is in flight, when the list is empty, or when the most recent merge failed. Multicast via {@link shareReplay} so multiple subscribers share a single merge.
   */
  readonly currentMergeOutput$: Observable<Maybe<Blob>> = combineLatest([this.entries$, this.isValidating$]).pipe(
    switchMap(([entries, isValidating]) => {
      const hasReady = entries.some((entry) => entry.status === 'ready');
      let next$: Observable<Maybe<Blob>>;

      if (isValidating || !hasReady) {
        next$ = of(undefined);
      } else {
        next$ = from(mergePdfMergeEntries(entries)).pipe(catchError(() => of(undefined)));
      }

      return next$;
    }),
    shareReplay(1)
  );

  readonly mergeOutput$: Observable<Blob> = this.currentMergeOutput$.pipe(filterMaybe());

  // MARK: Updaters
  /**
   * Builds {@link PdfMergeEntry} objects from the supplied files (skipping unsupported types) and appends them to state. Each entry's validation promise starts when the entry is built; {@link entries$} reflects each result as it resolves.
   */
  readonly addFiles = this.updater((state, files: readonly File[]) => {
    const newEntries = files.map((file) => buildPdfMergeEntry(file)).filter((entry): entry is PdfMergeEntry => entry != null);
    return newEntries.length > 0 ? { ...state, rawEntries: [...state.rawEntries, ...newEntries] } : state;
  });

  readonly removeEntry = this.updater((state, id: string) => ({ ...state, rawEntries: state.rawEntries.filter((entry) => entry.id !== id) }));

  readonly moveEntry = this.updater((state, move: PdfMergeEntryMove) => {
    if (move.previousIndex === move.currentIndex) {
      return state;
    }

    const next = [...state.rawEntries];
    moveItemInArray(next, move.previousIndex, move.currentIndex);
    return { ...state, rawEntries: next };
  });

  readonly clearAll = this.updater((state) => ({ ...state, rawEntries: [] }));
}
