import { ChangeDetectionStrategy, Component, computed, inject, input, type OnDestroy, type OnInit } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { type CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { combineLatest, distinctUntilChanged, map, type Observable, shareReplay, switchMap } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { DbxActionButtonDirective, DbxActionDirective, DbxActionHandlerDirective } from '@dereekb/dbx-core';
import { type FileArrayAcceptMatchConfig } from '../../interaction/upload/upload.accept';
import { DbxFileUploadComponent, type DbxFileUploadMode } from '../../interaction/upload/upload.component';
import { DbxFileUploadButtonComponent } from '../../interaction/upload/upload.button.component';
import { type DbxFileUploadFilesChangedEvent } from '../../interaction/upload/abstract.upload.component';
import { DbxButtonComponent } from '../../button/button.component';
import { DbxActionConfirmDirective, type DbxActionConfirmConfig } from '../../action/action.confirm.directive';
import { DbxActionSnackbarErrorDirective } from '../../error/error.snackbar.action.directive';
import { DBX_PDF_MERGE_EDITOR_CONFIG, DBX_PDF_MERGE_EDITOR_PRESERVE_ENTRIES_ON_SLOT_DESTROY, DEFAULT_PDF_MERGE_ACCEPT, type DbxPdfMergeEditorFileUploadValidatorSlot, type PdfMergeEntry, type PdfMergeEntryView, type PdfMergePageView } from './pdf.merge';
import { type DbxImageCompressionConfig } from '../image';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';
import { DbxPdfMergeEditorFileUploadValidatorDirective } from './pdf.merge.editor.file.upload.validator.directive';
import { DbxPdfMergeEntryComponent } from './pdf.merge.entry.component';
import { DbxPdfMergePageListComponent } from './pdf.merge.page.list.component';
import { buildPdfMergeEntry } from './pdf.merge.utility';

/**
 * Possible high-level UI states for a {@link DbxPdfMergeEditorFileUploadComponent}.
 *
 * - `no_file` — the slot owns no entries.
 * - `valid` — the slot owns entries and they satisfy the slot's `minFiles`/`maxFiles` thresholds with no validation in flight.
 * - `invalid` — the slot owns entries but they fail validation, are still being checked, or violate the slot's thresholds.
 */
export type DbxPdfMergeEditorFileUploadState = 'no_file' | 'valid' | 'invalid';

/**
 * Configures a {@link DbxPdfMergeEditorFileUploadComponent} slot — accept filter, multiplicity, validation thresholds, and the appearance passed through to the underlying {@link DbxFileUploadComponent}.
 */
export interface DbxPdfMergeEditorFileUploadConfig {
  /**
   * Override for the accept filter. Defaults to {@link DEFAULT_PDF_MERGE_ACCEPT}.
   */
  readonly accept?: Maybe<FileArrayAcceptMatchConfig['accept']>;
  /**
   * Whether the slot accepts multiple files. Defaults to `false` — slots are usually single-file.
   */
  readonly multiple?: Maybe<boolean>;
  /**
   * Whether the slot must own a valid file for the validator delegate to report ready. Defaults to `true`. When `false`, the slot reports valid in the `no_file` state and only blocks the merge while `invalid`.
   */
  readonly required?: Maybe<boolean>;
  /**
   * Minimum number of `ready` entries required for the slot to report valid. Defaults to `1`.
   */
  readonly minFiles?: Maybe<number>;
  /**
   * Optional cap on the number of files this slot will accept. Drives both visibility of the uploader (hidden once the owned-entry count reaches `maxFiles`) and validity (the slot reports invalid if `readyCount > maxFiles`). For single-file slots (`multiple: false`) the implicit cap is `1` regardless of this value.
   */
  readonly maxFiles?: Maybe<number>;
  /**
   * Optional heading shown above the upload area.
   */
  readonly label?: Maybe<string>;
  /**
   * Optional hint passed through to the upload area.
   */
  readonly hint?: Maybe<string | boolean>;
  /**
   * Optional button text passed through to the upload component.
   */
  readonly text?: Maybe<string>;
  /**
   * Optional button icon passed through to the upload component.
   */
  readonly icon?: Maybe<string>;
  /**
   * Display mode for the underlying {@link DbxFileUploadComponent}. Defaults to `'default'` (area + button).
   */
  readonly mode?: Maybe<DbxFileUploadMode>;
  /**
   * Optional per-slot image compression override. When omitted, the slot falls back to the ancestor {@link DbxPdfMergeEditorComponent} input config and finally to the workspace-wide {@link DBX_PDF_MERGE_EDITOR_CONFIG} token.
   */
  readonly imageCompression?: Maybe<DbxImageCompressionConfig>;
  /**
   * Whether the slot header offers an Add button once the slot owns entries and still has room under its capacity. Defaults to `true`.
   *
   * While this is enabled the full drop area is the slot's *empty* state only: once the slot owns something, the area collapses and this compact button becomes the way to add more, so the section never shows two competing add affordances. Set `false` to keep the pre-existing behavior, where the drop area stays visible until the slot reaches capacity.
   */
  readonly showAddButton?: Maybe<boolean>;
  /**
   * Whether the slot header offers a Clear button while the slot owns entries. Defaults to `true`.
   *
   * Clearing is also the slot's replace path: a single-file slot at capacity has no Add button, so clearing is how its file is swapped.
   */
  readonly showClearButton?: Maybe<boolean>;
  /**
   * Overrides merged over the default confirmation dialog shown before the slot is cleared. Set `autoConfirm: true` to clear without prompting.
   */
  readonly clearConfirm?: Maybe<DbxActionConfirmConfig>;
  /**
   * Text for the header Add button. Defaults to `'Add'`.
   */
  readonly addButtonText?: Maybe<string>;
  /**
   * Text for the header Clear button. Defaults to `'Clear'`.
   */
  readonly clearButtonText?: Maybe<string>;
}

const DEFAULT_MIN_FILES = 1;
const DEFAULT_REQUIRED = true;
const DEFAULT_ADD_BUTTON_TEXT = 'Add';
const DEFAULT_CLEAR_BUTTON_TEXT = 'Clear';
const DEFAULT_CLEAR_CONFIRM_TITLE = 'Clear this section?';
const DEFAULT_CLEAR_CONFIRM_PROMPT = 'Every file in this section will be removed, along with any page edits made to them.';
const DEFAULT_CLEAR_CONFIRM_CONFIRM_TEXT = 'Clear';
const DEFAULT_CLEAR_CONFIRM_CANCEL_TEXT = 'Cancel';

/**
 * Slot-scoped uploader for use inside a {@link DbxPdfMergeEditorComponent}. Adds files to the shared {@link DbxPdfMergeEditorStore} tagged with this slot's `slotId`, displays the slot's owned entries inline using {@link DbxPdfMergeEntryComponent}, and reports its readiness to the optional ancestor {@link DbxPdfMergeEditorFileUploadValidatorDirective}. On destroy the slot removes its owned entries from the store.
 *
 * Projects an `<ng-content>` slot inside its header element so consumers can render state-aware indicators (e.g. via the `dbxPdfMergeEditorFileUploadHasState` structural directive) alongside the optional `label`.
 *
 * Once the slot owns entries its header gains an Add button (while the slot is under capacity) and a Clear button, so a section that already has content can still be extended, emptied, or replaced. Clearing runs as its own `dbxAction` behind a `dbxActionConfirm` prompt — a misclick costs a dialog, not the section's files.
 *
 * @example
 * ```html
 * <dbx-pdf-merge-editor-file-upload slotId="license" [config]="{ label: 'Driver’s License', accept: ['application/pdf'] }">
 *   <mat-icon *dbxPdfMergeEditorFileUploadHasState="'valid'">check_circle</mat-icon>
 * </dbx-pdf-merge-editor-file-upload>
 * ```
 */
@Component({
  selector: 'dbx-pdf-merge-editor-file-upload',
  template: `
    <div class="dbx-pdf-merge-editor-file-upload-header">
      @if (labelSignal(); as label) {
        <span class="dbx-pdf-merge-editor-file-upload-label">{{ label }}</span>
      }
      <ng-content></ng-content>
      @if (showAddButtonSignal() || showClearButtonSignal()) {
        <div class="dbx-pdf-merge-editor-file-upload-actions">
          @if (showAddButtonSignal()) {
            <dbx-file-upload-button [accept]="acceptSignal()" [multiple]="multipleSignal()" [text]="addButtonTextSignal()" icon="add" [ariaLabel]="addButtonAriaLabelSignal()" (filesChanged)="onFiles($event)"></dbx-file-upload-button>
          }
          @if (showClearButtonSignal()) {
            <div dbxAction dbxActionSnackbarError [dbxActionHandler]="handleClear" [dbxActionConfirm]="clearConfirmSignal()">
              <dbx-button dbxActionButton [text]="clearButtonTextSignal()" icon="delete" [ariaLabel]="clearButtonAriaLabelSignal()"></dbx-button>
            </div>
          }
        </div>
      }
    </div>
    @if (showUploadAreaSignal()) {
      <dbx-file-upload [accept]="acceptSignal()" [multiple]="multipleSignal()" [mode]="modeSignal()" [hint]="hintSignal()" [text]="textSignal()" [icon]="iconSignal()" (filesChanged)="onFiles($event)"></dbx-file-upload>
    }
    @if (ownedEntriesSignal(); as owned) {
      @if (owned.length > 0) {
        @if (pageEditingSignal()) {
          <dbx-pdf-merge-page-list class="dbx-pdf-merge-editor-file-upload-pages" [slotId]="slotId()"></dbx-pdf-merge-page-list>
        } @else {
          <div class="dbx-pdf-merge-editor-file-upload-entries" cdkDropList (cdkDropListDropped)="onDrop($event)">
            @for (entry of owned; track entry.id) {
              <dbx-pdf-merge-entry [entry]="entry"></dbx-pdf-merge-entry>
            }
          </div>
        }
      }
    }
  `,
  host: {
    class: 'dbx-pdf-merge-editor-file-upload d-block dbx-mb3',
    '[class.dbx-pdf-merge-editor-file-upload--invalid]': 'stateSignal() === "invalid"',
    '[class.dbx-pdf-merge-editor-file-upload--valid]': 'stateSignal() === "valid"',
    '[class.dbx-pdf-merge-editor-file-upload--no-file]': 'stateSignal() === "no_file"'
  },
  imports: [CdkDropList, DbxButtonComponent, DbxFileUploadComponent, DbxFileUploadButtonComponent, DbxActionDirective, DbxActionButtonDirective, DbxActionHandlerDirective, DbxActionConfirmDirective, DbxActionSnackbarErrorDirective, DbxPdfMergeEntryComponent, DbxPdfMergePageListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPdfMergeEditorFileUploadComponent implements OnInit, OnDestroy, DbxPdfMergeEditorFileUploadValidatorSlot {
  readonly store = inject(DbxPdfMergeEditorStore);
  private readonly _validator = inject(DbxPdfMergeEditorFileUploadValidatorDirective, { optional: true });
  private readonly _injectedConfig = inject(DBX_PDF_MERGE_EDITOR_CONFIG, { optional: true });
  private readonly _preserveEntriesOnDestroy = inject(DBX_PDF_MERGE_EDITOR_PRESERVE_ENTRIES_ON_SLOT_DESTROY, { optional: true }) ?? false;

  /**
   * The slot id this component registered with the store, captured at registration time so destroy deregisters the same key. `null` before {@link ngOnInit} and after teardown.
   */
  private _registeredSlotId: Maybe<string> = null;

  readonly slotId = input.required<string>();
  readonly config = input<Maybe<DbxPdfMergeEditorFileUploadConfig>>();

  readonly acceptSignal = computed<FileArrayAcceptMatchConfig['accept']>(() => this.config()?.accept ?? (DEFAULT_PDF_MERGE_ACCEPT as FileArrayAcceptMatchConfig['accept']));
  readonly multipleSignal = computed(() => this.config()?.multiple ?? false);
  readonly modeSignal = computed<DbxFileUploadMode>(() => this.config()?.mode ?? 'default');
  readonly labelSignal = computed(() => this.config()?.label);
  readonly hintSignal = computed(() => this.config()?.hint);
  readonly textSignal = computed(() => this.config()?.text ?? 'Add file');
  readonly iconSignal = computed(() => this.config()?.icon ?? 'upload_file');

  readonly requiredSignal = computed(() => this.config()?.required ?? DEFAULT_REQUIRED);
  readonly minFilesSignal = computed(() => this.config()?.minFiles ?? DEFAULT_MIN_FILES);
  readonly maxFilesSignal = computed(() => this.config()?.maxFiles);

  /**
   * Effective upper bound on the number of owned entries this slot will accept. Defaults to `maxFiles` when set, `1` for single-file slots (`multiple: false`), and {@link Number.POSITIVE_INFINITY} for multi-file slots without an explicit cap.
   */
  readonly capacitySignal = computed(() => {
    const maxFiles = this.maxFilesSignal();
    const multiple = this.multipleSignal();
    let capacity: number;

    if (maxFiles != null) {
      capacity = maxFiles;
    } else if (multiple) {
      capacity = Number.POSITIVE_INFINITY;
    } else {
      capacity = 1;
    }

    return capacity;
  });

  /**
   * Live entries owned by this slot, derived from {@link DbxPdfMergeEditorStore.entriesForSlotId$}. Each entry carries the `ignored` flag set by the store under the active {@link DbxPdfMergeEncryptedHandling}.
   */
  readonly ownedEntries$: Observable<PdfMergeEntryView[]> = toObservable(this.slotId).pipe(
    switchMap((slotId) => this.store.entriesForSlotId$(slotId)),
    shareReplay(1)
  );

  readonly ownedEntriesSignal = toSignal(this.ownedEntries$, { initialValue: [] as PdfMergeEntryView[] });

  /**
   * Whether the shared store has page editing enabled. Drives whether this slot lists its own pages or its own files.
   */
  readonly pageEditingSignal = toSignal(this.store.pageEditing$, { initialValue: false });

  /**
   * Pages contributed by this slot's entries. Empty while page editing is disabled.
   */
  readonly ownedPages$: Observable<PdfMergePageView[]> = toObservable(this.slotId).pipe(
    switchMap((slotId) => this.store.pagesForSlotId$(slotId)),
    shareReplay(1)
  );

  /**
   * Whether the slot still has room for more files. Gates every add affordance — once the slot is at capacity neither the drop area nor the header Add button is offered, and the user must clear the slot (or remove an entry) to add another.
   */
  readonly canAddFilesSignal = computed(() => this.ownedEntriesSignal().length < this.capacitySignal());

  readonly showAddButtonConfigSignal = computed(() => this.config()?.showAddButton ?? true);
  readonly showClearButtonConfigSignal = computed(() => this.config()?.showClearButton ?? true);

  /**
   * Whether the compact header Add button is rendered. Only meaningful once the slot owns something — while it is empty the drop area is already the add affordance.
   */
  readonly showAddButtonSignal = computed(() => {
    const ownedEntries = this.ownedEntriesSignal();
    const canAddFiles = this.canAddFilesSignal();
    return this.showAddButtonConfigSignal() && ownedEntries.length > 0 && canAddFiles;
  });

  readonly showClearButtonSignal = computed(() => {
    const ownedEntries = this.ownedEntriesSignal();
    return this.showClearButtonConfigSignal() && ownedEntries.length > 0;
  });

  /**
   * Whether the full drop area is rendered. It is the slot's empty state while the header Add button is enabled; with the button turned off it falls back to staying visible until the slot reaches capacity.
   */
  readonly showUploadAreaSignal = computed(() => {
    const showAddButtonConfig = this.showAddButtonConfigSignal();
    const canAddFiles = this.canAddFilesSignal();
    const isEmpty = this.ownedEntriesSignal().length === 0;
    return canAddFiles && (isEmpty || !showAddButtonConfig);
  });

  readonly addButtonTextSignal = computed(() => this.config()?.addButtonText ?? DEFAULT_ADD_BUTTON_TEXT);
  readonly clearButtonTextSignal = computed(() => this.config()?.clearButtonText ?? DEFAULT_CLEAR_BUTTON_TEXT);

  readonly addButtonAriaLabelSignal = computed(() => {
    const label = this.labelSignal();
    return label ? `Add files to ${label}` : 'Add files to this section';
  });

  readonly clearButtonAriaLabelSignal = computed(() => {
    const label = this.labelSignal();
    return label ? `Clear ${label}` : 'Clear this section';
  });

  /**
   * Config for the confirmation shown before the slot is cleared. The slot's `label` is folded into the default title so a page of sections says which one is about to be emptied; `clearConfirm` overrides any field of it.
   */
  readonly clearConfirmSignal = computed<DbxActionConfirmConfig>(() => {
    const label = this.labelSignal();
    const overrides = this.config()?.clearConfirm;

    return {
      title: label ? `Clear ${label}?` : DEFAULT_CLEAR_CONFIRM_TITLE,
      prompt: DEFAULT_CLEAR_CONFIRM_PROMPT,
      confirmText: DEFAULT_CLEAR_CONFIRM_CONFIRM_TEXT,
      cancelText: DEFAULT_CLEAR_CONFIRM_CANCEL_TEXT,
      ...overrides
    };
  });

  /**
   * Clears every entry this slot owns. Runs as the handler of the header's own `dbxAction`, so the `dbxActionConfirm` on that action is what stands between a misclick and the section's files.
   *
   * @param _value - Unused. The confirmation supplies no value, only the go-ahead.
   * @param context - Work context completed as soon as the store drops the entries.
   */
  readonly handleClear: WorkUsingContext<unknown, void> = (_value, context) => {
    this.store.removeEntriesBySlotId(this.slotId());
    context.success();
  };

  /**
   * High-level state of the slot — `no_file` when empty, `valid` when owned entries satisfy the slot's thresholds, `invalid` when owned entries fail or are still being validated.
   */
  readonly state$: Observable<DbxPdfMergeEditorFileUploadState> = combineLatest([this.ownedEntries$, this.store.pageEditing$, this.ownedPages$]).pipe(
    map(([entries, pageEditing, pages]) => {
      let state: DbxPdfMergeEditorFileUploadState;

      if (entries.length === 0) {
        state = 'no_file';
      } else {
        const validating = entries.some((entry) => entry.status === 'validating');
        const readyCount = entries.filter((entry) => entry.status === 'ready').length;
        const minFiles = this.minFilesSignal();
        const maxFiles = this.maxFilesSignal();
        // Only meaningful once the slot actually has pages: an empty list means editing is off, the
        // entry is still hydrating, or it could not be expanded (encrypted) — none of which are the
        // user deleting their own content.
        const allPagesRemoved = pageEditing && pages.length > 0 && pages.every((page) => page.removed);

        if (validating) {
          state = 'invalid';
        } else if (readyCount < minFiles) {
          state = 'invalid';
        } else if (maxFiles != null && readyCount > maxFiles) {
          state = 'invalid';
        } else if (allPagesRemoved) {
          state = 'invalid';
        } else {
          state = 'valid';
        }
      }

      return state;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly stateSignal = toSignal(this.state$, { initialValue: 'no_file' });

  /**
   * Per-slot validity stream consumed by {@link DbxPdfMergeEditorFileUploadValidatorDirective}. Reports `true` when the slot is `valid` or when the slot is `no_file` and not `required`. An `invalid` state always reports `false`, even on optional slots — bad files block the merge until the user removes them.
   */
  readonly isValid$: Observable<boolean> = this.state$.pipe(
    map((state) => {
      const required = this.requiredSignal();
      let valid: boolean;

      if (state === 'valid') {
        valid = true;
      } else if (state === 'no_file') {
        valid = !required;
      } else {
        valid = false;
      }

      return valid;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly isValidSignal = toSignal(this.isValid$, { initialValue: false });

  ngOnInit(): void {
    // Two registrations, deliberately: the store learns this slot's ID (so consumers like
    // <dbx-pdf-merge-import> can enumerate the sections this editor declares), while the optional
    // validator directive tracks the component itself to aggregate `isValid$`. They are separate
    // because the store is always present while the validator is not, and because the store's
    // `setValidator` seam exists precisely so it never has to hold slot component references.
    this._registeredSlotId = this.slotId();
    this.store.registerSlotId(this._registeredSlotId);
    this._validator?.registerSlot(this);
  }

  ngOnDestroy(): void {
    // Unconditional, and deliberately OUTSIDE the `_preserveEntriesOnDestroy` check below: that
    // token governs whether the slot's ENTRIES survive, not whether the slot is mounted. The
    // upload dialog sets it to `true` and is torn down on every close, so gating this on it would
    // leave the store permanently claiming a section that is no longer on screen. The captured id
    // (rather than a fresh `slotId()` read) guarantees this decrements the same key `ngOnInit`
    // incremented, and clearing it keeps a repeat destroy from evicting a still-mounted duplicate.
    if (this._registeredSlotId != null) {
      this.store.unregisterSlotId(this._registeredSlotId);
      this._registeredSlotId = null;
    }

    this._validator?.unregisterSlot(this);

    // Default behavior: removing a slot from a template (e.g. via `@if`) also drops the slot's
    // entries from the store. Opt out by providing `DBX_PDF_MERGE_EDITOR_PRESERVE_ENTRIES_ON_SLOT_DESTROY`
    // (the PDF merge upload dialog supplies it automatically so dialog-hosted slots preserve
    // entries when the dialog tears down, while the user's selection lives on the ancestor store).
    if (!this._preserveEntriesOnDestroy) {
      this.store.removeEntriesBySlotId(this.slotId());
    }
  }

  onDrop(event: CdkDragDrop<unknown>): void {
    this.store.moveEntryWithinSlot({
      slotId: this.slotId(),
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex
    });
  }

  /**
   * Store-level image-compression default pushed by {@link DbxPdfMergeEditorStoreDirective}. Resolved between the slot's own override and the workspace-wide token.
   */
  readonly storeImageCompressionSignal = toSignal(this.store.imageCompression$, { initialValue: undefined });

  /**
   * Resolves the active image compression config: per-slot override → store-level default → workspace-wide DI token. The store tier lets a {@link DbxPdfMergeEditorStoreDirective} `[config]` supply a shared default (e.g. through the upload dialog) while a slot's own `imageCompression` still wins.
   */
  readonly effectiveImageCompressionSignal = computed<Maybe<DbxImageCompressionConfig>>(() => {
    const storeImageCompression = this.storeImageCompressionSignal();
    return this.config()?.imageCompression ?? storeImageCompression ?? this._injectedConfig?.imageCompression ?? null;
  });

  async onFiles(event: DbxFileUploadFilesChangedEvent): Promise<void> {
    const accepted = event.matchResult.accepted;
    const ownedCount = this.ownedEntriesSignal().length;
    const capacity = this.capacitySignal();
    const remaining = capacity - ownedCount;
    let filesToAdd: readonly File[];

    if (accepted.length === 0 || remaining <= 0) {
      filesToAdd = [];
    } else if (Number.isFinite(remaining) && remaining < accepted.length) {
      filesToAdd = accepted.slice(0, remaining);
    } else {
      filesToAdd = accepted;
    }

    if (filesToAdd.length === 0) {
      return;
    }

    const slotId = this.slotId();
    const imageCompression = this.effectiveImageCompressionSignal();
    const entries = await Promise.all(filesToAdd.map((file) => buildPdfMergeEntry(file, { slotId, imageCompression })));
    const filtered = entries.filter((entry): entry is PdfMergeEntry => entry != null);

    if (filtered.length > 0) {
      this.store.addFiles({ entries: filtered });
    }
  }
}
