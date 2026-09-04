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
import {
  asPdfMergeFile,
  buildPdfMergeEntriesFromSidecar,
  buildPdfMergeEntry,
  buildPdfMergeEntrySync,
  buildPdfMergePagePlan,
  mergePdfMergeEntries,
  pdfMergeEntriesUseEncryptedPassthrough,
  readPdfMergeEntryPageMetas,
  type BuildPdfMergeEntriesFromSidecarConfig,
  type PdfMergeSidecarImportErrorReason,
  type PdfMergeSidecarImportResult
} from './pdf.merge.utility';
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
 * Why a store-level import failed. Extends the parse-level reasons from {@link buildPdfMergeEntriesFromSidecar} with the store's own slot check.
 *
 * - `unexpected_slots` — the file's manifest names a section the caller said this editor does not have. The offending ids are on {@link DbxPdfMergeEditorImportState.unexpectedSlotIds}.
 */
export type DbxPdfMergeEditorImportErrorReason = PdfMergeSidecarImportErrorReason | 'unexpected_slots';

/**
 * Result of a successful store-level import — the sidecar result plus what the caller's expectation did not cover.
 */
export interface DbxPdfMergeEditorImportResult extends PdfMergeSidecarImportResult {
  /**
   * Expected sections the imported file did not fill. Always empty when no `expectedSlotIds` was supplied. A non-empty list is informational, not a failure — the import still replaced the store's entries.
   */
  readonly missingSlotIds: readonly string[];
}

/**
 * Who initiated an import.
 *
 * - `programmatic` — app code called {@link DbxPdfMergeEditorStore.importMergedPdf} directly, or a blob was bound to `[source]` on {@link DbxPdfMergeEditorStoreDirective}. This is the editor's *baseline*: the document the surrounding app decided the editor should be showing.
 * - `user` — the person picked a file through {@link DbxPdfMergeImportComponent}. Discardable; the baseline is not.
 *
 * The distinction exists for {@link DbxPdfMergeEditorStore.clearEntries}: emptying a programmatically-supplied editor would leave it in a state the app never asked for and cannot easily detect, so a clear restores the baseline instead of destroying it.
 */
export type DbxPdfMergeEditorImportOrigin = 'programmatic' | 'user';

/**
 * Lifecycle of the most recent {@link DbxPdfMergeEditorStore.importMergedPdf} call, exposed via {@link DbxPdfMergeEditorStore.importState$}.
 */
export interface DbxPdfMergeEditorImportState {
  readonly status: 'importing' | 'imported' | 'failed';
  /**
   * Who initiated this import. See {@link DbxPdfMergeEditorImportOrigin}.
   */
  readonly origin: DbxPdfMergeEditorImportOrigin;
  /**
   * Present with status `imported`.
   */
  readonly result?: Maybe<DbxPdfMergeEditorImportResult>;
  /**
   * Present with status `failed`.
   */
  readonly error?: Maybe<DbxPdfMergeEditorImportErrorReason>;
  /**
   * Sections the file named that the caller's `expectedSlotIds` did not allow. Present with error `unexpected_slots`; `null` entries represent unsectioned documents.
   */
  readonly unexpectedSlotIds?: readonly Maybe<string>[];
}

/**
 * Input for {@link DbxPdfMergeEditorStore.importMergedPdf}.
 */
export interface DbxPdfMergeEditorImportMergedPdfInput {
  /**
   * Bytes of a merged PDF previously exported from the editor.
   */
  readonly source: Blob;
  /**
   * Sections the file is allowed to name. **Omit to skip the check entirely** — the default for a programmatic import.
   *
   * The check is opt-in here rather than derived from {@link DbxPdfMergeEditorStore.registeredSlotIds$} because a programmatic import routinely runs before any slot exists (a store mounted on an `<ng-container>` whose editor only opens later in a dialog), where the registry is legitimately empty. Entries land in the store regardless and slots pick them up on mount, so importing early is safe; it is the caller who knows whether the document is trusted. {@link DbxPdfMergeImportComponent} passes its own resolved list, preserving the picker's behavior.
   */
  readonly expectedSlotIds?: Maybe<readonly string[]>;
  /**
   * When `true`, a readable PDF with no manifest is imported as one unslotted entry rather than failing with `no_sidecar`. Defaults to `false`. See {@link BuildPdfMergeEntriesFromSidecarConfig.allowWithoutSidecar}.
   */
  readonly allowWithoutSidecar?: Maybe<boolean>;
  /**
   * File name for the entry built by the `allowWithoutSidecar` fallback when `source` is a bare {@link Blob}.
   */
  readonly fileName?: Maybe<string>;
  /**
   * Who initiated this import. Defaults to `programmatic` — the picker passes `user` explicitly, so any other caller is app code by construction.
   *
   * A successful `programmatic` import becomes the editor's restore point for {@link DbxPdfMergeEditorStore.clearEntries}.
   */
  readonly origin?: Maybe<DbxPdfMergeEditorImportOrigin>;
}

/**
 * Input for {@link DbxPdfMergeEditorStore.clearEntries}.
 */
export interface DbxPdfMergeEditorClearEntriesInput {
  /**
   * Whether a programmatic import is restored rather than discarded. Defaults to `true`.
   *
   * Bind `false` for an editor whose clear really should empty everything, baseline included.
   */
  readonly restoreImport?: Maybe<boolean>;
}

/**
 * Outcome of {@link DbxPdfMergeEditorStore.clearEntries}.
 */
export interface DbxPdfMergeEditorClearEntriesResult {
  /**
   * Whether the editor was reset to its programmatic baseline (`true`) or emptied (`false`).
   */
  readonly restored: boolean;
  /**
   * Terminal state of the restoring re-import. Only present when a restore was attempted.
   */
  readonly importState?: Maybe<DbxPdfMergeEditorImportState>;
}

/**
 * Input for {@link DbxPdfMergeEditorStore.addFileToSlot}.
 */
export interface DbxPdfMergeEditorAddFileToSlotInput {
  /**
   * The document to add. A bare {@link Blob} is named via {@link fileName}.
   */
  readonly file: Blob | File;
  /**
   * Slot to attribute the entry to. Omit for an unslotted entry.
   */
  readonly slotId?: Maybe<string>;
  /**
   * Name for a bare {@link Blob}, or an override for a {@link File}'s own name.
   */
  readonly fileName?: Maybe<string>;
  /**
   * Image-compression override. Defaults to the store-level config set via {@link DbxPdfMergeEditorStore.setImageCompression}, matching what a slot uploader would apply to the same file.
   */
  readonly imageCompression?: Maybe<DbxImageCompressionConfig>;
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
  /**
   * Mount count per registered slot id. See {@link registerSlotId} for why this is a count rather than a set.
   */
  private readonly _slotIdCounts = new Map<string, number>();
  private readonly _registeredSlotIds$ = new BehaviorSubject<readonly string[]>([]);
  private readonly _importState$ = new BehaviorSubject<Maybe<DbxPdfMergeEditorImportState>>(undefined);
  /**
   * Input of the most recent successful `programmatic` import, replayed by {@link clearEntries} to reset the editor to the document the app supplied. `null` until one succeeds; a user's pick never overwrites it.
   */
  private _restorableImport: Maybe<DbxPdfMergeEditorImportMergedPdfInput>;

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
   * The single entry `focus` handling has narrowed the merge to — the first ready encrypted entry — or `null` whenever focus is not active (another handling mode, or no encrypted entry).
   *
   * Consumed by {@link DbxPdfMergeEditorFileUploadComponent} to answer "is my section still part of this document": while this entry exists, the output is that file alone, so every other slot's contents are ignored no matter what is put in them. Slots compare their own id against {@link PdfMergeEntry.slotId} here — a `null`/absent slot id means the focus target came from the editor's own upload area and supersedes every slot.
   */
  readonly encryptedFocusEntry$: Observable<Maybe<PdfMergeEntryView>> = combineLatest([this.displayEntries$, this.focusActive$]).pipe(
    map(([entries, focusActive]) => (focusActive ? (entries.find((entry) => entry.encrypted && entry.status === 'ready' && !entry.ignored) ?? null) : null)),
    // By id, not by reference: `displayEntries$` rebuilds its views on every emission, so the same
    // focus target arrives as a fresh object each time.
    distinctUntilChanged((a, b) => a?.id === b?.id),
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

  /**
   * Emits `true` while the merge will take the encrypted-passthrough branch — the only entry participating is a single ready encrypted PDF, whose original bytes become the output unchanged. See {@link pdfMergeEntriesUseEncryptedPassthrough}.
   *
   * This is what keeps page editing compatible with encrypted documents. `pdf-lib` cannot open an encrypted file, so it can never be expanded into pages and the page plan is necessarily empty for it — meaning every page-plan gate ({@link hasMergeablePages$} and the merge stream's own check) would otherwise read "the user deleted every page" and disable Preview, Download, and the upload/accept flows for the entire document. The passthrough has no plan to satisfy, so those gates consult this instead.
   */
  readonly encryptedPassthrough$: Observable<boolean> = this.displayEntries$.pipe(
    map((entries) => pdfMergeEntriesUseEncryptedPassthrough(entries.filter((entry) => !entry.ignored))),
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
   * Entries that are ready but contribute no pages to the plan: encrypted documents (which `pdf-lib` cannot open), anything unparseable, and entries the active {@link DbxPdfMergeEncryptedHandling} is ignoring. Surfaced so the UI can explain why those rows are not expandable instead of letting them silently vanish from the page list. Always empty while page editing is disabled.
   *
   * Ignored entries belong here rather than nowhere: the file-granular list greys them out and still offers a remove button, so omitting them under page editing would make a file the user just added disappear with no explanation and no way to take it back out.
   */
  readonly unexpandableEntries$: Observable<PdfMergeEntryView[]> = combineLatest([this.displayEntries$, this.pageEditing$, this.pageMetas$]).pipe(
    map(([entries, pageEditing, pageMetas]) => (pageEditing ? entries.filter((entry) => entry.status === 'ready' && (entry.ignored || pageMetas[entry.id] === null)) : [])),
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
   * Whether at least one page survives the user's edits. Emits `true` while page editing is disabled so it never gates the default path, and while {@link encryptedPassthrough$} is active, where the output is the encrypted file itself and there is no plan to satisfy.
   */
  readonly hasMergeablePages$: Observable<boolean> = combineLatest([this.pages$, this.encryptedPassthrough$]).pipe(
    map(([pages, encryptedPassthrough]) => encryptedPassthrough || pages == null || pages.some((page) => !page.removed)),
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
  private readonly _candidateMergeOutput$: Observable<Maybe<Blob>> = combineLatest([this.displayEntries$, this.isValidating$, this.validatorValid$, this.pages$, this.sidecar$, this.encryptedPassthrough$]).pipe(
    switchMap(([entries, isValidating, validatorValid, pages, sidecar, encryptedPassthrough]) => {
      const mergeable = entries.filter((entry) => !entry.ignored);
      const hasReady = mergeable.some((entry) => entry.status === 'ready');
      // A `null` plan means page editing is off, in which case the merge takes its original every-page
      // path. A passthrough has no plan either — the encrypted document cannot be opened, so its empty
      // plan must not read as "every page deleted" and suppress the output.
      const hasPages = encryptedPassthrough || pages == null || pages.some((page) => !page.removed);
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

  // MARK: Slot registry
  /**
   * Slot ids currently mounted against this store, i.e. the sections this editor declares.
   *
   * This is what makes `<dbx-pdf-merge-import>` a zero-configuration drop-in: it derives the set of sections a re-imported file is allowed to name (and whether it renders at all) from the slots actually on screen, rather than from a hand-maintained list duplicating them.
   *
   * Emitted **sorted ascending**, which is deterministic but is NOT declaration order. Sorting is what lets the guard below collapse slot churn: a set cycling through `@if` (`['a','b']` → `['b']` → `['b','a']`) ends up equal to the array it started with, where registration order would emit a spuriously different array for an identical set.
   *
   * Registered by {@link DbxPdfMergeEditorFileUploadComponent} from its own lifecycle. Kept here rather than on the optional {@link DbxPdfMergeEditorFileUploadValidatorDirective} because it must be available whether or not a validator is present — and because a separately-provided registry could be provided at a different level than the store, letting slots register with one instance while a reader sees another.
   */
  readonly registeredSlotIds$: Observable<readonly string[]> = this._registeredSlotIds$.pipe(
    distinctUntilChanged((a, b) => a.length === b.length && a.every((slotId, i) => slotId === b[i])),
    shareReplay(1)
  );

  /**
   * Registers a slot id as mounted, adding it to {@link registeredSlotIds$}.
   *
   * Reference-counted rather than a set: the same `slotId` can legitimately be mounted twice at once — the PDF merge upload dialog hosts its slots against an ancestor store while inline slots may still exist under {@link DBX_PDF_MERGE_EDITOR_PRESERVE_ENTRIES_ON_SLOT_DESTROY} — and one unmount must not deregister a still-mounted id.
   *
   * @param slotId - Slot identifier being mounted.
   */
  registerSlotId(slotId: string): void {
    this._slotIdCounts.set(slotId, (this._slotIdCounts.get(slotId) ?? 0) + 1);
    this._emitRegisteredSlotIds();
  }

  /**
   * Deregisters one mount of a slot id, removing it from {@link registeredSlotIds$} once the last mount is gone. Unknown ids are ignored.
   *
   * Callers must pair this with their own {@link registerSlotId} exactly once. The store frequently outlives its slots (a dialog-hosted slot is destroyed on every close while the page-level store lives on), so a missed call leaves the editor permanently claiming a section that is not on screen.
   *
   * @param slotId - Slot identifier being unmounted.
   */
  unregisterSlotId(slotId: string): void {
    const count = this._slotIdCounts.get(slotId);

    if (count != null) {
      if (count > 1) {
        this._slotIdCounts.set(slotId, count - 1);
      } else {
        this._slotIdCounts.delete(slotId);
      }

      this._emitRegisteredSlotIds();
    }
  }

  private _emitRegisteredSlotIds(): void {
    const next = Array.from(this._slotIdCounts.keys()).sort();
    const current = this._registeredSlotIds$.value;

    if (next.length !== current.length || next.some((slotId, i) => slotId !== current[i])) {
      this._registeredSlotIds$.next(next);
    }
  }

  // MARK: Import
  /**
   * Lifecycle of the most recent {@link importMergedPdf} call, or `undefined` before the first. Lets a consumer that triggered a programmatic import observe its outcome — the picker component is not the only entry point.
   */
  readonly importState$: Observable<Maybe<DbxPdfMergeEditorImportState>> = this._importState$.asObservable();

  /**
   * The most recent successful import, or `null` while none has succeeded.
   */
  readonly importResult$: Observable<Maybe<DbxPdfMergeEditorImportResult>> = this.importState$.pipe(
    map((state) => (state?.status === 'imported' ? state.result : null)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Why the most recent import failed, or `null` when it did not.
   */
  readonly importError$: Observable<Maybe<DbxPdfMergeEditorImportErrorReason>> = this.importState$.pipe(
    map((state) => (state?.status === 'failed' ? state.error : null)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Emits `true` while an import is in flight.
   */
  readonly isImporting$: Observable<boolean> = this.importState$.pipe(
    map((state) => state?.status === 'importing'),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Whether a programmatic baseline exists for {@link clearEntries} to restore. Lets a consumer word its own confirmation honestly — "reset to the imported document" rather than "remove everything".
   *
   * @returns `true` once a programmatic import has succeeded.
   */
  hasRestorableImport(): boolean {
    return this._restorableImport != null;
  }

  /**
   * Imports a previously-exported merged PDF, replacing every entry currently in the store with the per-slot documents recorded in its manifest.
   *
   * This is the programmatic equivalent of what {@link DbxPdfMergeImportComponent} does with a picked file, and that component delegates here — so a stored document loaded by an app and a file chosen by a user go through one implementation with one set of error semantics. Progress and outcome are published on {@link importState$} as well as returned.
   *
   * @param input - The source blob plus the optional slot check and sidecar-less fallback.
   * @returns The terminal state of this import.
   */
  async importMergedPdf(input: DbxPdfMergeEditorImportMergedPdfInput): Promise<DbxPdfMergeEditorImportState> {
    const { source, expectedSlotIds, allowWithoutSidecar, fileName } = input;
    const origin = input.origin ?? 'programmatic';
    const config: BuildPdfMergeEntriesFromSidecarConfig = { allowWithoutSidecar, fileName };

    this._importState$.next({ status: 'importing', origin });

    const outcome = await buildPdfMergeEntriesFromSidecar(source, config);
    let state: DbxPdfMergeEditorImportState;

    if ('error' in outcome) {
      state = { status: 'failed', origin, error: outcome.error };
    } else {
      // An unsectioned document counts as unexpected too: in a slots-only editor it would render
      // nowhere, so rejecting it beats importing pages the user can never see again.
      const unexpected = expectedSlotIds == null ? [] : outcome.slotIds.filter((slotId) => slotId == null || !expectedSlotIds.includes(slotId));

      if (unexpected.length > 0) {
        state = { status: 'failed', origin, error: 'unexpected_slots', unexpectedSlotIds: unexpected };
      } else {
        const missingSlotIds = expectedSlotIds == null ? [] : expectedSlotIds.filter((slotId) => !outcome.slotIds.includes(slotId));

        this.replaceEntries(outcome.entries);
        state = { status: 'imported', origin, result: { ...outcome, missingSlotIds } };

        // A programmatic import is the app telling the editor what it should be showing, so it
        // becomes the restore point. A user's pick deliberately does NOT overwrite it: the person
        // replaced what is on screen, not what the app configured.
        if (origin === 'programmatic') {
          this._restorableImport = input;
        }
      }
    }

    this._importState$.next(state);
    return state;
  }

  /**
   * Discards the current import lifecycle, so consumers rendering its notices (the picker's "Imported N section(s)" success line, its missing-section warning, its error) fall back to showing nothing.
   *
   * Separate from the entry list — this clears the *record* of an import, not its contents.
   */
  clearImportState(): void {
    this._importState$.next(undefined);
  }

  /**
   * Empties the editor, or resets it to its programmatic baseline when one exists.
   *
   * This is the "Clear" affordance's operation, and it deliberately is not a plain {@link clearAll}. When the surrounding app supplied the document (a programmatic {@link importMergedPdf}, or `[source]` on {@link DbxPdfMergeEditorStoreDirective}), emptying the editor would strand it in a state the app never asked for and has no obvious way to notice. Instead the original import is re-run, landing the view exactly where it was when the document first arrived — page edits, section removals, and any user-picked file on top of it all discarded.
   *
   * With no baseline — the ordinary case, including an editor whose only import came from {@link DbxPdfMergeImportComponent} — the entries and the import state both go, so no stale success/warning notice outlives the content it described.
   *
   * @param input - Optional override for the restore behavior.
   * @returns Whether the baseline was restored, plus the re-import's terminal state when one ran.
   */
  async clearEntries(input?: Maybe<DbxPdfMergeEditorClearEntriesInput>): Promise<DbxPdfMergeEditorClearEntriesResult> {
    const restorable = this._restorableImport;
    const shouldRestore = (input?.restoreImport ?? true) && restorable != null;
    let result: DbxPdfMergeEditorClearEntriesResult;

    if (shouldRestore) {
      const importState = await this.importMergedPdf(restorable);

      // A baseline that no longer imports (unreadable retained blob) must not leave the old
      // entries sitting there — the user asked for a clear and got neither.
      if (importState.status === 'imported') {
        result = { restored: true, importState };
      } else {
        this.clearAll();
        result = { restored: false, importState };
      }
    } else {
      this.clearAll();
      this.clearImportState();
      result = { restored: false };
    }

    return result;
  }

  /**
   * Adds a single document to a slot, without any sidecar involvement — the programmatic equivalent of a user dropping one file onto a slot uploader. Existing entries are left alone.
   *
   * Unlike {@link importMergedPdf} this neither reads nor requires a manifest; it is the plain "put this file in that slot" primitive, for e.g. an admin appending one document to an existing set. The entry can be added before its slot mounts — {@link entriesForSlotId$} picks it up when the slot renders.
   *
   * @param input - The blob or file, its target slot, and an optional name for a bare blob.
   * @returns The entry that was added, or `null` when the file is not a supported PDF/PNG/JPEG (in which case nothing was added).
   */
  async addFileToSlot(input: DbxPdfMergeEditorAddFileToSlotInput): Promise<Maybe<PdfMergeEntry>> {
    const { file, slotId, fileName, imageCompression } = input;
    const entry = await buildPdfMergeEntry(asPdfMergeFile(file, fileName), { slotId, imageCompression: imageCompression ?? this._imageCompression$.value });

    if (entry != null) {
      this.addFiles({ entries: [entry] });
    }

    return entry;
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
