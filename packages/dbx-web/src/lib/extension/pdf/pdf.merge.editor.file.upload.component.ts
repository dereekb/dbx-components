import { ChangeDetectionStrategy, Component, computed, inject, input, type OnDestroy, type OnInit } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { type CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { distinctUntilChanged, map, type Observable, shareReplay, switchMap } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { type FileArrayAcceptMatchConfig } from '../../interaction/upload/upload.accept';
import { DbxFileUploadComponent, type DbxFileUploadMode } from '../../interaction/upload/upload.component';
import { type DbxFileUploadFilesChangedEvent } from '../../interaction/upload/abstract.upload.component';
import { DBX_PDF_MERGE_EDITOR_CONFIG, DEFAULT_PDF_MERGE_ACCEPT, type DbxPdfMergeEditorFileUploadValidatorSlot, type PdfMergeEntry } from './pdf.merge';
import { type DbxImageCompressionConfig } from '../image';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';
import { DbxPdfMergeEditorFileUploadValidatorDirective } from './pdf.merge.editor.file.upload.validator.directive';
import { DbxPdfMergeEntryComponent } from './pdf.merge.entry.component';
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
}

const DEFAULT_MIN_FILES = 1;
const DEFAULT_REQUIRED = true;

/**
 * Slot-scoped uploader for use inside a {@link DbxPdfMergeEditorComponent}. Adds files to the shared {@link DbxPdfMergeEditorStore} tagged with this slot's `slotId`, displays the slot's owned entries inline using {@link DbxPdfMergeEntryComponent}, and reports its readiness to the optional ancestor {@link DbxPdfMergeEditorFileUploadValidatorDirective}. On destroy the slot removes its owned entries from the store.
 *
 * Projects an `<ng-content>` slot inside its header element so consumers can render state-aware indicators (e.g. via the `dbxPdfMergeEditorFileUploadHasState` structural directive) alongside the optional `label`.
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
    </div>
    @if (canAddFilesSignal()) {
      <dbx-file-upload [accept]="acceptSignal()" [multiple]="multipleSignal()" [mode]="modeSignal()" [hint]="hintSignal()" [text]="textSignal()" [icon]="iconSignal()" (filesChanged)="onFiles($event)"></dbx-file-upload>
    }
    @if (ownedEntriesSignal(); as owned) {
      @if (owned.length > 0) {
        <div class="dbx-pdf-merge-editor-file-upload-entries" cdkDropList (cdkDropListDropped)="onDrop($event)">
          @for (entry of owned; track entry.id) {
            <dbx-pdf-merge-entry [entry]="entry"></dbx-pdf-merge-entry>
          }
        </div>
      }
    }
  `,
  host: {
    class: 'dbx-pdf-merge-editor-file-upload d-block dbx-mb3',
    '[class.dbx-pdf-merge-editor-file-upload--invalid]': 'stateSignal() === "invalid"',
    '[class.dbx-pdf-merge-editor-file-upload--valid]': 'stateSignal() === "valid"',
    '[class.dbx-pdf-merge-editor-file-upload--no-file]': 'stateSignal() === "no_file"'
  },
  imports: [CdkDropList, DbxFileUploadComponent, DbxPdfMergeEntryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPdfMergeEditorFileUploadComponent implements OnInit, OnDestroy, DbxPdfMergeEditorFileUploadValidatorSlot {
  readonly store = inject(DbxPdfMergeEditorStore);
  private readonly _validator = inject(DbxPdfMergeEditorFileUploadValidatorDirective, { optional: true });
  private readonly _injectedConfig = inject(DBX_PDF_MERGE_EDITOR_CONFIG, { optional: true });

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
   * Live entries owned by this slot, derived from {@link DbxPdfMergeEditorStore.entriesForSlotId$}.
   */
  readonly ownedEntries$: Observable<PdfMergeEntry[]> = toObservable(this.slotId).pipe(
    switchMap((slotId) => this.store.entriesForSlotId$(slotId)),
    shareReplay(1)
  );

  readonly ownedEntriesSignal = toSignal(this.ownedEntries$, { initialValue: [] as PdfMergeEntry[] });

  /**
   * Whether the slot still has room for more files. Drives visibility of the upload UI — once the slot is at capacity, the uploader is hidden and the user must remove an existing entry to add another.
   */
  readonly canAddFilesSignal = computed(() => this.ownedEntriesSignal().length < this.capacitySignal());

  /**
   * High-level state of the slot — `no_file` when empty, `valid` when owned entries satisfy the slot's thresholds, `invalid` when owned entries fail or are still being validated.
   */
  readonly state$: Observable<DbxPdfMergeEditorFileUploadState> = this.ownedEntries$.pipe(
    map((entries) => {
      let state: DbxPdfMergeEditorFileUploadState;

      if (entries.length === 0) {
        state = 'no_file';
      } else {
        const validating = entries.some((entry) => entry.status === 'validating');
        const readyCount = entries.filter((entry) => entry.status === 'ready').length;
        const minFiles = this.minFilesSignal();
        const maxFiles = this.maxFilesSignal();

        if (validating) {
          state = 'invalid';
        } else if (readyCount < minFiles) {
          state = 'invalid';
        } else if (maxFiles != null && readyCount > maxFiles) {
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
    this._validator?.registerSlot(this);
  }

  ngOnDestroy(): void {
    this._validator?.unregisterSlot(this);
    this.store.removeEntriesBySlotId(this.slotId());
  }

  onDrop(event: CdkDragDrop<unknown>): void {
    this.store.moveEntryWithinSlot({
      slotId: this.slotId(),
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex
    });
  }

  /**
   * Resolves the active image compression config: per-slot override → workspace-wide DI token. The intermediate ancestor {@link DbxPdfMergeEditorComponent} config is not visible from a slot, so consumers needing per-editor compression should either set the slot's `imageCompression` directly or rely on the injection token.
   */
  readonly effectiveImageCompressionSignal = computed<Maybe<DbxImageCompressionConfig>>(() => this.config()?.imageCompression ?? this._injectedConfig?.imageCompression ?? null);

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
