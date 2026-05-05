import { Injectable } from '@angular/core';
import { moveItemInArray } from '@angular/cdk/drag-drop';
import { ComponentStore } from '@ngrx/component-store';
import { BehaviorSubject, catchError, combineLatest, defaultIfEmpty, distinctUntilChanged, from, map, type Observable, of, shareReplay, startWith, switchMap } from 'rxjs';
import { type Building, type Maybe } from '@dereekb/util';
import { type DbxPdfMergeEditorValidator, type PdfMergeEditorState, type PdfMergeEntry, type PdfMergeEntryMove, type PdfMergeEntryStatus } from './pdf.merge';
import { buildPdfMergeEntry, mergePdfMergeEntries } from './pdf.merge.utility';
import { filterMaybe } from '@dereekb/rxjs';

/**
 * Initial state used by {@link DbxPdfMergeEditorStore} — no entries.
 */
export const DBX_PDF_MERGE_EDITOR_INITIAL_STATE: PdfMergeEditorState = {
  rawEntries: []
};

/**
 * Input accepted by {@link DbxPdfMergeEditorStore.addFiles}: either a bare list of files (treated as unscoped) or `{ files, slotId }` to attribute the new entries to a slot.
 */
export type DbxPdfMergeEditorAddFilesInput =
  | readonly File[]
  | {
      readonly files: readonly File[];
      readonly slotId?: Maybe<string>;
    };

/**
 * Component-scoped {@link ComponentStore} that owns the list of files staged for merging in the PDF merge editor. Each {@link PdfMergeEntry} carries its own validation promise from the moment it is built; {@link entries$} composes those promises into a live stream — emitting the entry first in `validating` state and then again as each promise resolves to `ready` or `error`. {@link mergeOutput$} emits the merged PDF blob once every entry has finished validating, at least one is `ready`, and the registered validator delegate (if any) reports `true`.
 */
@Injectable()
export class DbxPdfMergeEditorStore extends ComponentStore<PdfMergeEditorState> {
  private readonly _validator$ = new BehaviorSubject<Maybe<DbxPdfMergeEditorValidator>>(undefined);

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
   * Emits the boolean output of the registered {@link DbxPdfMergeEditorValidator} delegate, or a constant `true` when no delegate is registered. {@link currentMergeOutput$} gates merge emissions on this stream.
   */
  readonly isValid$: Observable<boolean> = this._validator$.pipe(
    switchMap((validator) => (validator ? validator(this.entries$) : of(true))),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Emits the merged PDF blob whenever every entry has finished validating (see {@link isValidating$}), at least one is `ready`, and the registered validator delegate (if any) reports `true`. Emits `undefined` while validation is in flight, when the list is empty, when the delegate reports invalid, or when the most recent merge failed. Multicast via {@link shareReplay} so multiple subscribers share a single merge.
   */
  readonly currentMergeOutput$: Observable<Maybe<Blob>> = combineLatest([this.entries$, this.isValidating$, this.isValid$]).pipe(
    switchMap(([entries, isValidating, isValid]) => {
      const hasReady = entries.some((entry) => entry.status === 'ready');
      let next$: Observable<Maybe<Blob>>;

      if (isValidating || !hasReady || !isValid) {
        next$ = of(undefined);
      } else {
        next$ = from(mergePdfMergeEntries(entries)).pipe(catchError(() => of(undefined)));
      }

      return next$;
    }),
    shareReplay(1)
  );

  readonly mergeOutput$: Observable<Blob> = this.currentMergeOutput$.pipe(filterMaybe());

  /**
   * Returns an observable of entries belonging to the given slot id. The result is filtered from {@link entries$} so the per-slot stream still reflects validation progress and removals.
   *
   * @param slotId - Slot identifier to filter for.
   * @returns Observable of entries whose `slotId` matches.
   */
  entriesForSlotId$(slotId: string): Observable<PdfMergeEntry[]> {
    return this.entries$.pipe(
      map((entries) => entries.filter((entry) => entry.slotId === slotId)),
      shareReplay(1)
    );
  }

  // MARK: Validator
  /**
   * Registers a {@link DbxPdfMergeEditorValidator} delegate that gates merge emissions. Only one delegate is active at a time — calling this replaces any previously registered delegate.
   *
   * @param validator - Delegate to register, or a falsy value to clear.
   */
  setValidator(validator: Maybe<DbxPdfMergeEditorValidator>): void {
    this._validator$.next(validator);
  }

  /**
   * Clears any registered validator delegate so {@link isValid$} returns to its default `true` stream.
   */
  clearValidator(): void {
    this._validator$.next(undefined);
  }

  // MARK: Updaters
  /**
   * Builds {@link PdfMergeEntry} objects from the supplied files (skipping unsupported types) and appends them to state. Each entry's validation promise starts when the entry is built; {@link entries$} reflects each result as it resolves. When `input` is an object with a `slotId`, the resulting entries are tagged with that slot id.
   */
  readonly addFiles = this.updater((state, input: DbxPdfMergeEditorAddFilesInput) => {
    const files = Array.isArray(input) ? (input as readonly File[]) : (input as { readonly files: readonly File[] }).files;
    const slotId = Array.isArray(input) ? undefined : (input as { readonly slotId?: Maybe<string> }).slotId;
    const newEntries = files.map((file) => buildPdfMergeEntry(file, { slotId })).filter((entry): entry is PdfMergeEntry => entry != null);
    return newEntries.length > 0 ? { ...state, rawEntries: [...state.rawEntries, ...newEntries] } : state;
  });

  readonly removeEntry = this.updater((state, id: string) => ({ ...state, rawEntries: state.rawEntries.filter((entry) => entry.id !== id) }));

  /**
   * Removes every entry whose `slotId` matches the given id. Used by {@link DbxPdfMergeEditorFileUploadComponent} on destroy so a slot's entries leave with it.
   */
  readonly removeEntriesBySlotId = this.updater((state, slotId: string) => ({ ...state, rawEntries: state.rawEntries.filter((entry) => entry.slotId !== slotId) }));

  readonly moveEntry = this.updater((state, move: PdfMergeEntryMove) => {
    if (move.previousIndex === move.currentIndex) {
      return state;
    }

    const next = [...state.rawEntries];
    moveItemInArray(next, move.previousIndex, move.currentIndex);
    return { ...state, rawEntries: next };
  });

  /**
   * Reorders entries inside a single slot. The `previousIndex`/`currentIndex` are slot-local — the indices a {@link DbxPdfMergeEditorFileUploadComponent} sees in its filtered view of {@link entries$}. The updater translates them to global `rawEntries` positions and applies an in-place {@link moveItemInArray}, leaving entries from other slots untouched.
   */
  readonly moveEntryWithinSlot = this.updater((state, payload: { readonly slotId: string; readonly previousIndex: number; readonly currentIndex: number }) => {
    const { slotId, previousIndex, currentIndex } = payload;
    let nextState: PdfMergeEditorState;

    if (previousIndex === currentIndex) {
      nextState = state;
    } else {
      const ownedIndices: number[] = [];
      state.rawEntries.forEach((entry, index) => {
        if (entry.slotId === slotId) {
          ownedIndices.push(index);
        }
      });

      if (previousIndex < 0 || previousIndex >= ownedIndices.length || currentIndex < 0 || currentIndex >= ownedIndices.length) {
        nextState = state;
      } else {
        const next = [...state.rawEntries];
        moveItemInArray(next, ownedIndices[previousIndex], ownedIndices[currentIndex]);
        nextState = { ...state, rawEntries: next };
      }
    }

    return nextState;
  });

  readonly clearAll = this.updater((state) => ({ ...state, rawEntries: [] }));
}
