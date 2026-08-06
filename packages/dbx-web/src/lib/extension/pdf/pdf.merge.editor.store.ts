import { Injectable } from '@angular/core';
import { moveItemInArray } from '@angular/cdk/drag-drop';
import { ComponentStore } from '@ngrx/component-store';
import { BehaviorSubject, catchError, combineLatest, defaultIfEmpty, distinctUntilChanged, from, map, type Observable, of, shareReplay, startWith, switchMap } from 'rxjs';
import { makeValuesGroupMap, type Building, type FileSize, type Maybe } from '@dereekb/util';
import {
  DBX_PDF_MERGE_ENCRYPTED_ERROR_MESSAGE,
  DEFAULT_DBX_PDF_MERGE_ENCRYPTED_HANDLING,
  DEFAULT_DBX_PDF_MERGE_PAGE_EDITING,
  DEFAULT_DBX_PDF_MERGE_SIDECAR,
  entryIdForPdfMergePageId,
  pdfMergePageGroupKeyForSlotId,
  type DbxPdfMergeEditorValidator,
  type DbxPdfMergeEncryptedHandling,
  type PdfMergeEditorState,
  type PdfMergeEntry,
  type PdfMergeEntryMove,
  type PdfMergeEntryStatus,
  type PdfMergeEntryView,
  type PdfMergePageGroup,
  type PdfMergePageMeta,
  type PdfMergePageMove,
  type PdfMergePageRemovedChange,
  type PdfMergePageRotationChange,
  type PdfMergePageView
} from './pdf.merge';
import { buildPdfMergeEntrySync, buildPdfMergePagePlan, mergePdfMergeEntries, readPdfMergeEntryPageMetas } from './pdf.merge.utility';
import { type DbxImageCompressionConfig } from '../image';
import { filterMaybe } from '@dereekb/rxjs';

/**
 * Initial state used by {@link DbxPdfMergeEditorStore} — no entries and no page edits.
 */
export const DBX_PDF_MERGE_EDITOR_INITIAL_STATE: PdfMergeEditorState = {
  rawEntries: [],
  pageOverrides: {},
  pageOrder: {}
};

/**
 * Drops page overrides and stored orderings that belong to entries no longer in the list.
 *
 * The derived plan already ignores stale ids, so this is hygiene rather than correctness — it keeps the two records from growing without bound as the user adds and removes files.
 *
 * @param state - Current state.
 * @param liveEntryIds - Ids of the entries that remain.
 * @returns The pruned page-state slice.
 * @__NO_SIDE_EFFECTS__
 */
function prunePdfMergePageState(state: PdfMergeEditorState, liveEntryIds: Set<string>): Pick<PdfMergeEditorState, 'pageOverrides' | 'pageOrder'> {
  const pageOverrides: Record<string, PdfMergeEditorState['pageOverrides'][string]> = {};
  const pageOrder: Record<string, string[]> = {};

  Object.entries(state.pageOverrides).forEach(([pageId, override]) => {
    if (liveEntryIds.has(entryIdForPdfMergePageId(pageId))) {
      pageOverrides[pageId] = override;
    }
  });

  Object.entries(state.pageOrder).forEach(([groupKey, pageIds]) => {
    const kept = pageIds.filter((pageId) => liveEntryIds.has(entryIdForPdfMergePageId(pageId)));

    if (kept.length > 0) {
      pageOrder[groupKey] = kept;
    }
  });

  return { pageOverrides, pageOrder };
}

/**
 * Input accepted by {@link DbxPdfMergeEditorStore.addFiles}: either a bare list of files (treated as unscoped, synchronously wrapped into entries) or `{ files, slotId }` to attribute the new entries to a slot. Callers that need client-side compression should construct entries via the async `buildPdfMergeEntry` and pass `{ entries }` instead.
 */
export type DbxPdfMergeEditorAddFilesInput =
  | readonly File[]
  | {
      readonly files: readonly File[];
      readonly slotId?: Maybe<string>;
    }
  | {
      readonly entries: readonly PdfMergeEntry[];
    };

/**
 * Component-scoped {@link ComponentStore} that owns the list of files staged for merging in the PDF merge editor. Each {@link PdfMergeEntry} carries its own validation promise from the moment it is built; {@link entries$} composes those promises into a live stream — emitting the entry first in `validating` state and then again as each promise resolves to `ready` or `error`. {@link mergeOutput$} emits the merged PDF blob once every entry has finished validating, at least one is `ready`, and the registered validator delegate (if any) reports `true`.
 */
@Injectable()
export class DbxPdfMergeEditorStore extends ComponentStore<PdfMergeEditorState> {
  private readonly _validator$ = new BehaviorSubject<Maybe<DbxPdfMergeEditorValidator>>(undefined);
  private readonly _outputSizeLimit$ = new BehaviorSubject<Maybe<FileSize>>(undefined);
  private readonly _imageCompression$ = new BehaviorSubject<Maybe<DbxImageCompressionConfig>>(undefined);
  private readonly _encryptedHandling$ = new BehaviorSubject<Maybe<DbxPdfMergeEncryptedHandling>>(undefined);
  private readonly _pageEditing$ = new BehaviorSubject<Maybe<boolean>>(undefined);
  private readonly _sidecar$ = new BehaviorSubject<Maybe<boolean>>(undefined);
  /**
   * Per-entry page metadata, parsed at most once per entry. Keyed by entry id; a resolved `null` means the entry could not be expanded. Only populated while page editing is enabled.
   */
  private readonly _pageMetaCache = new Map<string, Promise<Maybe<PdfMergePageMeta[]>>>();

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

                // Mutate the rawEntries entry so subsequent state re-emissions (e.g. when another
                // file is added) take the `of(entry)` branch below and skip re-validation.
                (entry as Building<PdfMergeEntry>).status = status;
                (entry as Building<PdfMergeEntry>).errorMessage = validationResult.errorMessage;
                (entry as Building<PdfMergeEntry>).encrypted = validationResult.encrypted ?? false;

                // Emit a new reference so consumer signal inputs notice the status transition —
                // returning `entry` would leave `DbxPdfMergeEntryComponent.entry` pointing at the
                // same object and its computeds wouldn't re-run, stranding the row at "Checking…".
                return { ...entry };
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

  /**
   * Emits the active {@link DbxPdfMergeEncryptedHandling} mode (defaults to {@link DEFAULT_DBX_PDF_MERGE_ENCRYPTED_HANDLING}). Pushed onto the store via {@link setEncryptedHandling} by the editor component or {@link DbxPdfMergeEditorStoreDirective}.
   */
  readonly encryptedHandling$: Observable<DbxPdfMergeEncryptedHandling> = this._encryptedHandling$.pipe(
    map((handling) => handling ?? DEFAULT_DBX_PDF_MERGE_ENCRYPTED_HANDLING),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Entries enriched with the `ignored` flag derived from {@link encryptedHandling$}. Under `focus` mode (the default) the *first* ready encrypted entry is the focus target — every other entry (encrypted or not) is marked `ignored`, so the merge stream always sees a single encrypted entry and routes through the passthrough branch in {@link mergePdfMergeEntries}. Under `error` mode, encrypted entries are demoted to `status: 'error'` with the standard "Password-protected" message. Under `allow` mode, entries pass through unchanged.
   */
  readonly displayEntries$: Observable<PdfMergeEntryView[]> = combineLatest([this.entries$, this.encryptedHandling$]).pipe(
    map(([entries, handling]) => {
      const focusTarget = handling === 'focus' ? entries.find((entry) => entry.encrypted && entry.status === 'ready') : undefined;
      return entries.map((entry) => {
        let view: PdfMergeEntryView;

        if (handling === 'error' && entry.encrypted && entry.status !== 'validating') {
          view = { ...entry, status: 'error', errorMessage: DBX_PDF_MERGE_ENCRYPTED_ERROR_MESSAGE, ignored: false };
        } else if (focusTarget != null && entry !== focusTarget) {
          view = { ...entry, ignored: true };
        } else {
          view = { ...entry, ignored: false };
        }

        return view;
      });
    }),
    shareReplay(1)
  );

  /**
   * Emits `true` while {@link encryptedHandling$} is `'focus'` and at least one ready encrypted entry exists. Drives the editor's focus banner and is the same condition used to mark non-encrypted entries as `ignored` in {@link displayEntries$}.
   */
  readonly focusActive$: Observable<boolean> = combineLatest([this.entries$, this.encryptedHandling$]).pipe(
    map(([entries, handling]) => handling === 'focus' && entries.some((entry) => entry.encrypted && entry.status === 'ready')),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Emits the encrypted, `ready` entries currently in the list. Useful for consumers that want to surface UI specifically for encrypted files.
   */
  readonly encryptedEntries$: Observable<PdfMergeEntry[]> = this.entries$.pipe(
    map((entries) => entries.filter((entry) => entry.encrypted && entry.status === 'ready')),
    shareReplay(1)
  );

  readonly hasReadyEntries$: Observable<boolean> = this.displayEntries$.pipe(
    map((entries) => entries.some((entry) => entry.status === 'ready' && !entry.ignored)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // MARK: Page editing
  /**
   * Raw {@link DbxPdfMergeEditorConfig.pageEditing} value pushed onto the store, before defaulting. Consumed by the editor as the middle tier of its resolution chain (own `[config]` input → store → {@link DBX_PDF_MERGE_EDITOR_CONFIG} token), so a store-level default does not shadow the token.
   */
  readonly pageEditingSetting$: Observable<Maybe<boolean>> = this._pageEditing$.asObservable();

  /**
   * Whether page editing is active, defaulted to {@link DEFAULT_DBX_PDF_MERGE_PAGE_EDITING}. Every page-related stream is inert while this is `false`.
   */
  readonly pageEditing$: Observable<boolean> = this.pageEditingSetting$.pipe(
    map((pageEditing) => pageEditing ?? DEFAULT_DBX_PDF_MERGE_PAGE_EDITING),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Raw {@link DbxPdfMergeEditorConfig.sidecar} value pushed onto the store, before defaulting.
   */
  readonly sidecarSetting$: Observable<Maybe<boolean>> = this._sidecar$.asObservable();

  /**
   * Whether the merged output should carry an embedded manifest, defaulted to {@link DEFAULT_DBX_PDF_MERGE_SIDECAR}. Independent of {@link pageEditing$}.
   */
  readonly sidecar$: Observable<boolean> = this.sidecarSetting$.pipe(
    map((sidecar) => sidecar ?? DEFAULT_DBX_PDF_MERGE_SIDECAR),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Hydrated page metadata keyed by entry id.
   *
   * Short-circuits to an empty record while page editing is off, so the default configuration never parses a source document — the upload path's cheap header scan stays the only inspection performed. Each entry is parsed at most once thanks to {@link _pageMetaCache}, and metadata for departed entries is pruned on each pass.
   */
  readonly pageMetas$: Observable<Record<string, Maybe<PdfMergePageMeta[]>>> = combineLatest([this.entries$, this.pageEditing$]).pipe(
    switchMap(([entries, pageEditing]) => {
      const ready = pageEditing ? entries.filter((entry) => entry.status === 'ready') : [];
      let next$: Observable<Record<string, Maybe<PdfMergePageMeta[]>>>;

      if (ready.length === 0) {
        next$ = of({});
      } else {
        const readyIds = new Set(ready.map((entry) => entry.id));

        Array.from(this._pageMetaCache.keys()).forEach((entryId) => {
          if (!readyIds.has(entryId)) {
            this._pageMetaCache.delete(entryId);
          }
        });

        const loaded = ready.map(async (entry) => {
          let metas = this._pageMetaCache.get(entry.id);

          if (metas == null) {
            metas = readPdfMergeEntryPageMetas(entry);
            this._pageMetaCache.set(entry.id, metas);
          }

          return [entry.id, await metas] as const;
        });

        next$ = from(Promise.all(loaded)).pipe(map((pairs) => Object.fromEntries(pairs)));
      }

      return next$;
    }),
    shareReplay(1)
  );

  /**
   * The editor's ordered page plan, or `null` while page editing is disabled. Passing `null` through to the merge is what makes the default path emit every page of every entry exactly as it did before page editing existed.
   */
  readonly pages$: Observable<Maybe<PdfMergePageView[]>> = combineLatest([this.displayEntries$, this.pageEditing$, this.pageMetas$, this.select((state) => state.pageOverrides), this.select((state) => state.pageOrder)]).pipe(
    map(([entries, pageEditing, pageMetas, pageOverrides, pageOrder]) => {
      let pages: Maybe<PdfMergePageView[]>;

      if (pageEditing) {
        pages = buildPdfMergePagePlan({ entries, pageMetas, pageOverrides, pageOrder });
      } else {
        pages = null;
      }

      return pages;
    }),
    shareReplay(1)
  );

  /**
   * The page plan split into the groups the UI renders, one per slot plus one for unslotted entries. Empty while page editing is disabled.
   */
  readonly pageGroups$: Observable<PdfMergePageGroup[]> = this.pages$.pipe(
    map((pages) => {
      const grouped = makeValuesGroupMap(pages ?? [], (page) => page.groupKey);
      const groups: PdfMergePageGroup[] = [];

      grouped.forEach((groupPages, groupKey) => {
        groups.push({ groupKey: groupKey as string, slotId: groupPages[0]?.slotId ?? null, pages: groupPages });
      });

      return groups;
    }),
    shareReplay(1)
  );

  /**
   * Entries that are ready to merge but whose pages could not be listed — encrypted documents (which `pdf-lib` cannot open) and anything unparseable. Surfaced so the UI can explain why those rows are not expandable instead of letting them silently vanish from the page list. Always empty while page editing is disabled.
   */
  readonly unexpandableEntries$: Observable<PdfMergeEntryView[]> = combineLatest([this.displayEntries$, this.pageEditing$, this.pageMetas$]).pipe(
    map(([entries, pageEditing, pageMetas]) => (pageEditing ? entries.filter((entry) => entry.status === 'ready' && !entry.ignored && pageMetas[entry.id] === null) : [])),
    shareReplay(1)
  );

  /**
   * Number of pages that will reach the merged output — the plan minus anything marked for removal. Zero while page editing is disabled, where the count is not meaningful.
   */
  readonly mergeablePageCount$: Observable<number> = this.pages$.pipe(
    map((pages) => (pages ?? []).filter((page) => !page.removed).length),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Whether at least one page survives the user's edits. Emits `true` while page editing is disabled so it never gates the default path.
   */
  readonly hasMergeablePages$: Observable<boolean> = this.pages$.pipe(
    map((pages) => pages == null || pages.some((page) => !page.removed)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Returns the pages belonging to one group, for a slot rendering its own pages inline.
   *
   * @param slotId - Slot identifier, or `null` for the unslotted group.
   * @returns Observable of that group's ordered pages.
   */
  pagesForSlotId$(slotId: Maybe<string>): Observable<PdfMergePageView[]> {
    const groupKey = pdfMergePageGroupKeyForSlotId(slotId);
    return this.pages$.pipe(
      map((pages) => (pages ?? []).filter((page) => page.groupKey === groupKey)),
      shareReplay(1)
    );
  }

  /**
   * Emits `true` while any entry's validation promise has not yet resolved (i.e. one or more entries are still in `validating` status). Reads from {@link entries$} (not {@link displayEntries$}) so validation gating ignores the `ignored`/`error` projection done by encryption handling.
   */
  readonly isValidating$: Observable<boolean> = this.entries$.pipe(
    map((entries) => entries.some((entry) => entry.status === 'validating')),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Emits the boolean output of the registered {@link DbxPdfMergeEditorValidator} delegate, or a constant `true` when no delegate is registered. Composed with {@link sizeLimitValid$} into {@link isValid$} to gate {@link currentMergeOutput$}.
   */
  readonly validatorValid$: Observable<boolean> = this._validator$.pipe(
    switchMap((validator) => (validator ? validator(this.entries$) : of(true))),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Internal pre-validity merge stream produced without consulting {@link isValid$}. Drives both {@link outputSize$} and the eventual {@link currentMergeOutput$} so size-based gating can observe the would-be blob without creating a cycle. Consumes {@link displayEntries$} so the merge respects the active {@link DbxPdfMergeEncryptedHandling} (encrypted-focused entries pass through, ignored entries are dropped, `error` mode demotions are honored).
   */
  private readonly _candidateMergeOutput$: Observable<Maybe<Blob>> = combineLatest([this.displayEntries$, this.isValidating$, this.validatorValid$, this.pages$, this.sidecar$]).pipe(
    switchMap(([entries, isValidating, validatorValid, pages, sidecar]) => {
      const mergeable = entries.filter((entry) => !entry.ignored);
      const hasReady = mergeable.some((entry) => entry.status === 'ready');
      // A `null` plan means page editing is off, in which case the merge takes its original every-page path.
      const hasPages = pages == null || pages.some((page) => !page.removed);
      let next$: Observable<Maybe<Blob>>;

      if (isValidating || !hasReady || !validatorValid || !hasPages) {
        next$ = of(undefined);
      } else {
        next$ = from(mergePdfMergeEntries(mergeable, { pages, sidecar })).pipe(catchError(() => of(undefined)));
      }

      return next$;
    }),
    shareReplay(1)
  );

  /**
   * Emits the byte size of the most recent candidate merge output, or `undefined` while there is none.
   */
  readonly outputSize$: Observable<Maybe<FileSize>> = this._candidateMergeOutput$.pipe(
    map((blob) => blob?.size),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Emits `true` while the candidate merge fits inside the active output-size limit (or when no limit is set). Cleared when the merge has not yet produced a blob — emits `true` in that case to avoid blocking the UI before there is anything to gate on.
   */
  readonly sizeLimitValid$: Observable<boolean> = combineLatest([this._outputSizeLimit$, this.outputSize$]).pipe(
    map(([limit, size]) => {
      let valid: boolean;

      if (limit == null || size == null) {
        valid = true;
      } else {
        valid = size <= limit;
      }

      return valid;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Emits `true` while the registered {@link DbxPdfMergeEditorValidator} delegate (if any), the optional output-size limit, and the page plan are all satisfied. {@link currentMergeOutput$} gates merge emissions on this stream.
   *
   * The page-plan term is `true` whenever page editing is disabled, so this stream is unchanged on the default path. With page editing on it blocks the merge once the user has marked every page for deletion.
   */
  readonly isValid$: Observable<boolean> = combineLatest([this.validatorValid$, this.sizeLimitValid$, this.hasMergeablePages$]).pipe(
    map(([validatorValid, sizeLimitValid, hasMergeablePages]) => validatorValid && sizeLimitValid && hasMergeablePages),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Emits the merged PDF blob whenever every entry has finished validating (see {@link isValidating$}), at least one is `ready`, and {@link isValid$} reports `true`. Emits `undefined` while validation is in flight, when the list is empty, when the delegate or size limit reports invalid, or when the most recent merge failed.
   */
  readonly currentMergeOutput$: Observable<Maybe<Blob>> = combineLatest([this._candidateMergeOutput$, this.sizeLimitValid$]).pipe(
    map(([blob, sizeLimitValid]) => (sizeLimitValid ? blob : undefined)),
    shareReplay(1)
  );

  readonly mergeOutput$: Observable<Blob> = this.currentMergeOutput$.pipe(filterMaybe());

  /**
   * Emits the active client-side image-compression config pushed via {@link setImageCompression}, or `undefined` when none is set. Consumed by the editor and its slot uploaders as the middle tier of compression resolution (own `[config]` input → store → {@link DBX_PDF_MERGE_EDITOR_CONFIG} token), letting {@link DbxPdfMergeEditorStoreDirective} supply a store-level default that flows through the upload dialog's bare editor.
   */
  readonly imageCompression$: Observable<Maybe<DbxImageCompressionConfig>> = this._imageCompression$.asObservable();

  /**
   * Returns an observable of entries belonging to the given slot id. The result is filtered from {@link displayEntries$} so per-slot rows honor the active {@link DbxPdfMergeEncryptedHandling} (ignored / error projection).
   *
   * @param slotId - Slot identifier to filter for.
   * @returns Observable of entries whose `slotId` matches, enriched with the `ignored` flag.
   */
  entriesForSlotId$(slotId: string): Observable<PdfMergeEntryView[]> {
    return this.displayEntries$.pipe(
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
   * Clears any registered validator delegate so {@link validatorValid$} returns to its default `true` stream.
   */
  clearValidator(): void {
    this._validator$.next(undefined);
  }

  /**
   * Sets the maximum allowed output blob size in bytes. When the candidate merge exceeds this limit, {@link sizeLimitValid$} (and therefore {@link isValid$}) emits `false` and {@link currentMergeOutput$} suppresses the blob. Pass `null`/`undefined` to clear the limit.
   *
   * @param maxBytes - Output byte ceiling, or a falsy value to remove the limit.
   */
  setOutputSizeLimit(maxBytes: Maybe<FileSize>): void {
    this._outputSizeLimit$.next(maxBytes ?? undefined);
  }

  /**
   * Sets the store-level client-side image-compression config exposed via {@link imageCompression$}. The editor and its slot uploaders apply it as the middle tier of compression resolution (own `[config]` input → store → {@link DBX_PDF_MERGE_EDITOR_CONFIG} token), so a value pushed here by {@link DbxPdfMergeEditorStoreDirective} reaches the upload dialog's bare editor while a per-input/per-slot override still wins. Pass `null`/`undefined` to clear the store-level default.
   *
   * @param config - Image-compression config, or a falsy value to clear the store-level default.
   */
  setImageCompression(config: Maybe<DbxImageCompressionConfig>): void {
    this._imageCompression$.next(config ?? undefined);
  }

  /**
   * Sets the active {@link DbxPdfMergeEncryptedHandling} mode, exposed via {@link encryptedHandling$}. Pass `null`/`undefined` to clear the value and fall back to {@link DEFAULT_DBX_PDF_MERGE_ENCRYPTED_HANDLING}.
   *
   * @param handling - Encryption handling mode, or a falsy value to clear.
   */
  setEncryptedHandling(handling: Maybe<DbxPdfMergeEncryptedHandling>): void {
    this._encryptedHandling$.next(handling ?? undefined);
  }

  /**
   * Enables or disables page editing, exposed via {@link pageEditing$}. Turning it on expands each ready entry into its individual pages; turning it off returns the editor to its file-granular behavior while preserving any page edits in state, so toggling back on restores them.
   *
   * @param pageEditing - Whether page editing is active, or a falsy value to clear and fall back to {@link DEFAULT_DBX_PDF_MERGE_PAGE_EDITING}.
   */
  setPageEditing(pageEditing: Maybe<boolean>): void {
    this._pageEditing$.next(pageEditing ?? undefined);
  }

  /**
   * Enables or disables the embedded manifest, exposed via {@link sidecar$}.
   *
   * @param sidecar - Whether to embed the manifest, or a falsy value to clear and fall back to {@link DEFAULT_DBX_PDF_MERGE_SIDECAR}.
   */
  setSidecar(sidecar: Maybe<boolean>): void {
    this._sidecar$.next(sidecar ?? undefined);
  }

  // MARK: Updaters
  /**
   * Appends entries (already constructed) or builds them from raw files and appends them to state. Each entry's validation promise starts when the entry is built; {@link entries$} reflects each result as it resolves. When `input` is an object with `files` and `slotId`, the resulting entries are tagged with that slot id. When `input` is `{ entries }`, the entries are appended as-is — use this shape for entries that went through async client-side compression upstream.
   */
  readonly addFiles = this.updater((state, input: DbxPdfMergeEditorAddFilesInput) => {
    let newEntries: PdfMergeEntry[];

    if (Array.isArray(input)) {
      newEntries = (input as readonly File[]).map((file) => buildPdfMergeEntrySync(file)).filter((entry): entry is PdfMergeEntry => entry != null);
    } else {
      const objectInput = input as { readonly files?: readonly File[]; readonly slotId?: Maybe<string>; readonly entries?: readonly PdfMergeEntry[] };

      if (objectInput.entries == null) {
        const files = objectInput.files ?? [];
        const slotId = objectInput.slotId;
        newEntries = files.map((file) => buildPdfMergeEntrySync(file, { slotId })).filter((entry): entry is PdfMergeEntry => entry != null);
      } else {
        newEntries = [...objectInput.entries];
      }
    }

    return newEntries.length > 0 ? { ...state, rawEntries: [...state.rawEntries, ...newEntries] } : state;
  });

  readonly removeEntry = this.updater((state, id: string) => {
    const rawEntries = state.rawEntries.filter((entry) => entry.id !== id);
    return { ...state, rawEntries, ...prunePdfMergePageState(state, new Set(rawEntries.map((entry) => entry.id))) };
  });

  /**
   * Removes every entry whose `slotId` matches the given id. Used by {@link DbxPdfMergeEditorFileUploadComponent} on destroy so a slot's entries leave with it.
   */
  readonly removeEntriesBySlotId = this.updater((state, slotId: string) => {
    const rawEntries = state.rawEntries.filter((entry) => entry.slotId !== slotId);
    return { ...state, rawEntries, ...prunePdfMergePageState(state, new Set(rawEntries.map((entry) => entry.id))) };
  });

  readonly moveEntry = this.updater((state, move: PdfMergeEntryMove) => {
    let nextState: PdfMergeEditorState;

    if (move.previousIndex === move.currentIndex) {
      nextState = state;
    } else {
      const next = [...state.rawEntries];
      moveItemInArray(next, move.previousIndex, move.currentIndex);
      nextState = { ...state, rawEntries: next };
    }

    return nextState;
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

  readonly clearAll = this.updater((state) => ({ ...state, rawEntries: [], pageOverrides: {}, pageOrder: {} }));

  /**
   * Replaces the entire entry list, discarding any page edits.
   *
   * Used by the sidecar import path, which reconstructs a fresh set of slot-tagged entries from a previously-exported file. Done as a single state change so subscribers never observe an intermediate empty list.
   */
  readonly replaceEntries = this.updater((state, entries: readonly PdfMergeEntry[]) => ({ ...state, rawEntries: [...entries], pageOverrides: {}, pageOrder: {} }));

  // MARK: Page updaters
  /**
   * Reorders a page inside its own group. Groups never exchange pages — the page list renders one CDK drop list per group, so a cross-group drag is impossible to express.
   *
   * The move rewrites the id array the caller rendered rather than recomputing it from state, keeping the stored order aligned with what the user saw.
   */
  readonly movePageWithinGroup = this.updater((state, move: PdfMergePageMove) => {
    let nextState: PdfMergeEditorState;

    if (move.previousIndex === move.currentIndex || move.previousIndex < 0 || move.currentIndex < 0 || move.previousIndex >= move.pageIds.length || move.currentIndex >= move.pageIds.length) {
      nextState = state;
    } else {
      const pageIds = [...move.pageIds];
      moveItemInArray(pageIds, move.previousIndex, move.currentIndex);
      nextState = { ...state, pageOrder: { ...state.pageOrder, [move.groupKey]: pageIds } };
    }

    return nextState;
  });

  /**
   * Sets a page's rotation. The value is composed onto the page's own source rotation at merge time, so this is the rotation the user applied rather than the page's absolute orientation.
   */
  readonly setPageRotation = this.updater((state, change: PdfMergePageRotationChange) => {
    const current = state.pageOverrides[change.pageId];
    return { ...state, pageOverrides: { ...state.pageOverrides, [change.pageId]: { rotation: change.rotation, removed: current?.removed ?? false } } };
  });

  /**
   * Marks a page for deletion or restores it. Marked pages stay in the list so the choice can be undone, but are excluded from the merged output.
   */
  readonly setPageRemoved = this.updater((state, change: PdfMergePageRemovedChange) => {
    const current = state.pageOverrides[change.pageId];
    return { ...state, pageOverrides: { ...state.pageOverrides, [change.pageId]: { rotation: current?.rotation ?? 0, removed: change.removed } } };
  });

  /**
   * Discards every page edit, returning the plan to natural order with no rotations or deletions. Leaves the entries themselves untouched.
   */
  readonly clearPageEdits = this.updater((state) => ({ ...state, pageOverrides: {}, pageOrder: {} }));
}
