import { InjectionToken, type Provider } from '@angular/core';
import { JPEG_MIME_TYPE, PDF_MIME_TYPE, PNG_MIME_TYPE, type FileSize, type Maybe, type MimeTypeWithoutParameters } from '@dereekb/util';
import { type Observable } from 'rxjs';
import { type DbxImageCompressionConfig, type ImageCompressionStatus } from '../image';
import { type FileArrayAcceptMatchConfig } from '../../interaction/upload/upload.accept';
import { type DbxButtonDisplayStylePair } from '../../button/button';

/**
 * Identifies which kind of source file a {@link PdfMergeEntry} represents.
 *
 * - `pdf` — an existing PDF document whose pages are copied into the merged output.
 * - `image` — a raster image (PNG/JPEG) embedded as a single page in the merged output.
 */
export type PdfMergeEntryKind = 'pdf' | 'image';

/**
 * Captured pre-compression metadata for a {@link PdfMergeEntry}. When no compression ran, the values match the post-compression entry fields.
 */
export interface PdfMergeEntryOriginal {
  readonly name: string;
  readonly mimeType: MimeTypeWithoutParameters;
  readonly size: FileSize;
  /**
   * Pixel dimensions of the source image. Only set for images that were decoded during compression.
   */
  readonly dimensions?: Maybe<{ readonly width: number; readonly height: number }>;
}

/**
 * Lifecycle status of a {@link PdfMergeEntry} as it is added, validated, and (potentially) merged.
 *
 * - `validating` — the entry has been added but its bytes have not yet been verified.
 * - `ready` — validation succeeded; the entry can participate in a merge.
 * - `error` — validation failed (corrupt, unsupported, password protected, etc.).
 */
export type PdfMergeEntryStatus = 'validating' | 'ready' | 'error';

/**
 * Validation result for a single {@link PdfMergeEntry}.
 */
export interface PdfMergeEntryValidationResult {
  readonly ok: boolean;
  readonly errorMessage?: Maybe<string>;
  /**
   * Whether the file appears to be encrypted (contains a `/Encrypt` dictionary). Reported as a fact independent of `ok` so consumers can decide whether to focus on, ignore, or reject the entry. Validation does not fail an entry purely because it is encrypted.
   */
  readonly encrypted?: Maybe<boolean>;
}

/**
 * Strategy for how the editor reacts when an encrypted PDF is added.
 *
 * - `focus` (default) — the encrypted entry stays `ready` and all non-encrypted entries are hidden from the merge (greyed out in the list). The merge output is the encrypted file's bytes passed through unchanged so downstream upload flows still receive a usable blob.
 * - `error` — encrypted entries are marked as `error` with a "Password-protected PDFs cannot be merged." message. Preserves the legacy hard-reject behavior.
 * - `allow` — encrypted entries stay `ready` and participate in the merge alongside other entries. The client-side `pdf-lib` merge will fail; useful only for consumers that bypass `mergeOutput$` and upload raw entries themselves.
 */
export type DbxPdfMergeEncryptedHandling = 'focus' | 'error' | 'allow';

/**
 * Default {@link DbxPdfMergeEncryptedHandling} when no consumer or token overrides it.
 */
export const DEFAULT_DBX_PDF_MERGE_ENCRYPTED_HANDLING: DbxPdfMergeEncryptedHandling = 'focus';

/**
 * Error message used when an encrypted entry is projected to the `error` status under {@link DbxPdfMergeEncryptedHandling} `'error'` mode.
 */
export const DBX_PDF_MERGE_ENCRYPTED_ERROR_MESSAGE = 'Password-protected PDFs cannot be merged.';

/**
 * MIME types accepted by the PDF merge editor by default: PDF documents and PNG/JPEG images.
 */
export const DEFAULT_PDF_MERGE_ACCEPT: readonly MimeTypeWithoutParameters[] = [PDF_MIME_TYPE, PNG_MIME_TYPE, JPEG_MIME_TYPE];

/**
 * MIME type emitted by the merged result blob.
 */
export const PDF_MERGE_RESULT_MIME_TYPE: MimeTypeWithoutParameters = PDF_MIME_TYPE;

/**
 * A single source file that has been added to the PDF merge editor.
 */
export interface PdfMergeEntry extends Pick<PdfMergeEntryValidationResult, 'errorMessage'> {
  /**
   * Stable identifier for this entry, generated when the entry is created.
   */
  readonly id: string;
  /**
   * Original file selected by the user. Retained for both validation and merging.
   */
  readonly file: File;
  /**
   * Display name (the file's `name`).
   */
  readonly name: string;
  /**
   * Resolved MIME type. Falls back to extension-based inference when the file did not provide one.
   */
  readonly mimeType: MimeTypeWithoutParameters;
  /**
   * File size in bytes.
   */
  readonly size: FileSize;
  /**
   * Whether the entry contributes pages from a PDF or from an image.
   */
  readonly kind: PdfMergeEntryKind;
  /**
   * Current validation/merge readiness status.
   */
  readonly status: PdfMergeEntryStatus;
  /**
   * The validation promise.
   */
  readonly validation: Promise<PdfMergeEntryValidationResult>;
  /**
   * Optional slot identifier. Set when the entry was added through a {@link DbxPdfMergeEditorFileUploadComponent} slot, used by the store to filter entries per slot and clean them up when the slot component is destroyed. Entries added through the editor's default upload area have no slot id.
   */
  readonly slotId?: Maybe<string>;
  /**
   * Metadata captured from the user-supplied file before any client-side compression. When no compression ran, the values match {@link PdfMergeEntry.name}, {@link PdfMergeEntry.mimeType}, {@link PdfMergeEntry.size}.
   */
  readonly original: PdfMergeEntryOriginal;
  /**
   * Result of the client-side compression step on upload. `'unchanged'` when no compression ran.
   */
  readonly compression: ImageCompressionStatus;
  /**
   * Whether the entry's source file appears to be encrypted (contains a `/Encrypt` dictionary). Set during validation; defaults to `false`. The store decides how to react via {@link DbxPdfMergeEncryptedHandling}.
   */
  readonly encrypted: boolean;
}

/**
 * Read-only view of a {@link PdfMergeEntry} enriched with the `ignored` flag derived by the store from the active {@link DbxPdfMergeEncryptedHandling}. When `ignored` is `true`, the entry is still present in the list but is excluded from the merge output and rendered in a greyed-out state.
 */
export interface PdfMergeEntryView extends PdfMergeEntry {
  /**
   * Whether the editor is currently ignoring this entry for merge purposes. Only `true` under `focus` mode when at least one encrypted entry exists and this entry is not itself the encrypted focus target.
   */
  readonly ignored: boolean;
}

/**
 * Validation delegate registered on the {@link DbxPdfMergeEditorStore}. Receives the live {@link PdfMergeEntry} stream and returns a stream of `boolean` values controlling whether the store may emit a merge result. Emitting `false` causes {@link DbxPdfMergeEditorStore.currentMergeOutput$} to emit `undefined` and prevents {@link DbxPdfMergeEditorStore.mergeOutput$} from emitting.
 */
export type DbxPdfMergeEditorValidator = (entries$: Observable<PdfMergeEntry[]>) => Observable<boolean>;

/**
 * Minimal interface that a slot upload component exposes to {@link DbxPdfMergeEditorFileUploadValidatorDirective}. Implemented by {@link DbxPdfMergeEditorFileUploadComponent}.
 */
export interface DbxPdfMergeEditorFileUploadValidatorSlot {
  /**
   * Identifies the slot. Used by the validator directive only for diagnostics — the directive aggregates by reference, not by id.
   */
  readonly slotId: () => string;
  /**
   * Stream that emits `true` while this slot is satisfied (per its own config and the validator's required/optional rules) and `false` otherwise.
   */
  readonly isValid$: Observable<boolean>;
}

/**
 * State managed by the PDF merge editor's component store.
 */
export interface PdfMergeEditorState {
  /**
   * Ordered list of entries the user has added. Order determines page order in the merged output.
   */
  readonly rawEntries: PdfMergeEntry[];
}

/**
 * Index movement payload used by the editor's reorder updater.
 */
export interface PdfMergeEntryMove {
  readonly previousIndex: number;
  readonly currentIndex: number;
}

/**
 * Output size limits enforced by {@link DbxPdfMergeEditorComponent} on its merged blob.
 */
export interface DbxPdfMergeOutputSizeLimitsConfig {
  /**
   * Soft cap in bytes. Above this the editor surfaces a warning banner but Preview/Download stay enabled.
   */
  readonly warnBytes?: Maybe<FileSize>;
  /**
   * Hard cap in bytes. Above this the editor blocks Preview/Download via the store's validity pipeline.
   */
  readonly errorBytes?: Maybe<FileSize>;
}

/**
 * Top-level configuration object accepted by {@link DbxPdfMergeEditorComponent} (via input) and by {@link DBX_PDF_MERGE_EDITOR_CONFIG} (via dependency injection).
 */
export interface DbxPdfMergeEditorConfig {
  /**
   * Image compression to run on uploads. When omitted, files enter the entry list unchanged.
   */
  readonly imageCompression?: Maybe<DbxImageCompressionConfig>;
  /**
   * Soft/hard output-size limits surfaced via warning/error banners and (for `errorBytes`) the store's validity gate.
   */
  readonly outputSizeLimits?: Maybe<DbxPdfMergeOutputSizeLimitsConfig>;
  /**
   * Accept filter for the editor's default "Add files" upload area. Defaults to {@link DEFAULT_PDF_MERGE_ACCEPT}.
   */
  readonly accept?: Maybe<FileArrayAcceptMatchConfig['accept']>;
  /**
   * Whether the default upload area accepts multiple files. Defaults to `true`.
   */
  readonly multiple?: Maybe<boolean>;
  /**
   * File name used for the merged output (download + preview). Defaults to `merged.pdf`.
   */
  readonly fileName?: Maybe<string>;
  /**
   * Whether to show the embedded download button. Defaults to `false`.
   */
  readonly showDownloadButton?: Maybe<boolean>;
  /**
   * Whether to show the Preview button. Defaults to `true`.
   */
  readonly showPreviewButton?: Maybe<boolean>;
  /**
   * Display/style pair for the embedded download button.
   */
  readonly downloadButton?: Maybe<DbxButtonDisplayStylePair>;
  /**
   * When `false`, hides the default "Add files" upload area. Use when projecting {@link DbxPdfMergeEditorFileUploadComponent} slots through `<ng-content>` instead of the unscoped uploader. Defaults to `true`.
   */
  readonly showAddFiles?: Maybe<boolean>;
  /**
   * When `false`, hides the shared file list below the slot content. Useful when each slot displays its owned files inline. Defaults to `true`.
   */
  readonly showFileList?: Maybe<boolean>;
  /**
   * Strategy for how encrypted PDFs are handled — see {@link DbxPdfMergeEncryptedHandling}. Defaults to {@link DEFAULT_DBX_PDF_MERGE_ENCRYPTED_HANDLING} (`'focus'`).
   */
  readonly encryptedHandling?: Maybe<DbxPdfMergeEncryptedHandling>;
}

/**
 * Injection token for a workspace-wide default {@link DbxPdfMergeEditorConfig}. Use {@link provideDbxPdfMergeEditorConfig} to register a value.
 */
export const DBX_PDF_MERGE_EDITOR_CONFIG = new InjectionToken<DbxPdfMergeEditorConfig>('DBX_PDF_MERGE_EDITOR_CONFIG');

/**
 * Helper that returns a {@link Provider} binding {@link DBX_PDF_MERGE_EDITOR_CONFIG} to the given config value.
 *
 * @param config - Configuration to register.
 * @returns Provider entry suitable for inclusion in `providers`.
 */
export function provideDbxPdfMergeEditorConfig(config: DbxPdfMergeEditorConfig): Provider {
  return { provide: DBX_PDF_MERGE_EDITOR_CONFIG, useValue: config };
}

/**
 * Injection token that, when bound to `true`, makes `<dbx-pdf-merge-editor-file-upload>` slots skip their default `ngOnDestroy` cleanup (which removes the slot's entries from the shared store). Use when slots are hosted inside an ephemeral container — for example, the PDF merge upload dialog — and the store outlives that container, so the user's selection should survive when the container is torn down. Defaults to `false` (slot destroy removes its entries) which keeps the in-page editor's behavior for the common case where adding/removing a slot via `@if` should drop its entries with it.
 */
export const DBX_PDF_MERGE_EDITOR_PRESERVE_ENTRIES_ON_SLOT_DESTROY = new InjectionToken<boolean>('DBX_PDF_MERGE_EDITOR_PRESERVE_ENTRIES_ON_SLOT_DESTROY');

/**
 * Helper that returns a {@link Provider} binding {@link DBX_PDF_MERGE_EDITOR_PRESERVE_ENTRIES_ON_SLOT_DESTROY}.
 *
 * @param preserve - When `true`, descendant `<dbx-pdf-merge-editor-file-upload>` slots skip the destroy-time entry removal. Defaults to `true` because that is the value callers typically want when they bother to reach for the helper.
 * @returns Provider entry suitable for inclusion in `providers`.
 */
export function provideDbxPdfMergeEditorPreserveEntriesOnSlotDestroy(preserve: boolean = true): Provider {
  return { provide: DBX_PDF_MERGE_EDITOR_PRESERVE_ENTRIES_ON_SLOT_DESTROY, useValue: preserve };
}
