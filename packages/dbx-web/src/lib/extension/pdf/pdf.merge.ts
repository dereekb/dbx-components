import { InjectionToken, type Provider } from '@angular/core';
import { JPEG_MIME_TYPE, PDF_MIME_TYPE, PNG_MIME_TYPE, type FileSize, type Maybe, type MimeTypeWithoutParameters } from '@dereekb/util';
import { type Observable } from 'rxjs';
import { type DbxImageCompressionConfig, type ImageCompressionStatus } from '../image';
import { type FileArrayAcceptMatchConfig } from '../../interaction/upload/upload.accept';
import { type DbxButtonDisplayStylePair } from '../../button/button';
import { type DbxActionConfirmConfig } from '../../action/action.confirm.directive';

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
 * - `focus` (default) — the encrypted entry stays `ready` and all non-encrypted entries are hidden from the merge (greyed out in the list). The merge output is the encrypted file's bytes passed through unchanged so downstream upload flows still receive a usable blob. This holds with page editing enabled: an encrypted document cannot be opened, so it lists no editable pages and the empty page plan does not gate the output (see `pdfMergeEntriesUseEncryptedPassthrough`). Every {@link DbxPdfMergeEditorFileUploadComponent} slot other than the one holding the encrypted file withdraws its add affordances and waives its `required` check, since nothing put there could reach the output.
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
 * Default value for {@link DbxPdfMergeEditorConfig.pageEditing}. Off, so the editor's default behavior is unchanged.
 */
export const DEFAULT_DBX_PDF_MERGE_PAGE_EDITING = false;

/**
 * Default value for {@link DbxPdfMergeEditorConfig.sidecar}. Off, so merged output bytes are unchanged.
 */
export const DEFAULT_DBX_PDF_MERGE_SIDECAR = false;

/**
 * Default value for {@link DbxPdfMergeEditorConfig.restoreImportOnClear}. On, so an editor the app populated programmatically is reset to that document by Clear rather than left empty.
 */
export const DEFAULT_DBX_PDF_MERGE_RESTORE_IMPORT_ON_CLEAR = true;

/**
 * Message shown on an encrypted entry's row while page editing is enabled. Encrypted documents cannot be opened by `pdf-lib`, so their pages cannot be listed or edited — the entry stays a single opaque row, and the merge emits the file unchanged.
 */
export const DBX_PDF_MERGE_ENCRYPTED_NOT_EDITABLE_MESSAGE = 'This file cannot be edited; it will be used as-is.';

/**
 * Message shown on a row the active {@link DbxPdfMergeEncryptedHandling} is ignoring, i.e. a non-focused entry under `focus` mode. Kept in the list (rather than dropped) so a file the user added never disappears without an explanation.
 */
export const DBX_PDF_MERGE_IGNORED_ENTRY_MESSAGE = 'Ignored since an encrypted file is used instead.';

/**
 * Message shown on a {@link DbxPdfMergeEditorFileUploadComponent} slot whose section cannot contribute to the document because an encrypted PDF elsewhere in the editor is being used as the whole output under `focus` handling.
 */
export const DBX_PDF_MERGE_SUPERSEDED_SLOT_MESSAGE = 'An encrypted PDF is being used as the whole document.';

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
 * Rotation the user has applied to a page, in degrees clockwise.
 */
export type PdfMergePageRotation = 0 | 90 | 180 | 270;

/**
 * Group key used for pages whose source entry has no slot id.
 */
export const DEFAULT_PDF_MERGE_PAGE_GROUP_KEY = '_';

/**
 * Returns the group key a page reorders within — its entry's slot id, or {@link DEFAULT_PDF_MERGE_PAGE_GROUP_KEY} when the entry is unslotted.
 *
 * @param slotId - Slot id of the owning entry, if any.
 * @returns The group key.
 * @__NO_SIDE_EFFECTS__
 */
export function pdfMergePageGroupKeyForSlotId(slotId: Maybe<string>): string {
  return slotId ?? DEFAULT_PDF_MERGE_PAGE_GROUP_KEY;
}

/**
 * Separator between the entry id and the page index inside a page id.
 */
export const PDF_MERGE_PAGE_ID_SEPARATOR = ':';

/**
 * Builds the stable identifier for a page within the editor.
 *
 * @param entryId - Id of the owning {@link PdfMergeEntry}.
 * @param sourceIndex - Zero-based page index within that entry's source document.
 * @returns The page id.
 * @__NO_SIDE_EFFECTS__
 */
export function makePdfMergePageId(entryId: string, sourceIndex: number): string {
  return `${entryId}${PDF_MERGE_PAGE_ID_SEPARATOR}${sourceIndex}`;
}

/**
 * Returns the id of the entry a page id belongs to. Used to prune page state when an entry leaves the list.
 *
 * @param pageId - Page id produced by {@link makePdfMergePageId}.
 * @returns The owning entry's id.
 * @__NO_SIDE_EFFECTS__
 */
export function entryIdForPdfMergePageId(pageId: string): string {
  return pageId.slice(0, pageId.indexOf(PDF_MERGE_PAGE_ID_SEPARATOR));
}

/**
 * Per-page metadata captured when a {@link PdfMergeEntry} is expanded for page editing. Read once per entry by the store's hydration pass and cached for as long as the entry stays in the list.
 */
export interface PdfMergePageMeta {
  /**
   * Zero-based index of this page within its source document.
   */
  readonly sourceIndex: number;
  /**
   * Page width in PDF points.
   */
  readonly width: number;
  /**
   * Page height in PDF points.
   */
  readonly height: number;
  /**
   * Rotation already baked into the source page, in degrees. User rotation composes on top of this at merge time rather than replacing it, so rotating an already-sideways scan behaves as the user expects.
   */
  readonly sourceRotation: number;
}

/**
 * A user's edits to a single page, held sparsely in {@link PdfMergeEditorState.pageOverrides}. Only pages the user has actually touched appear, so adding or removing an entry needs no page bookkeeping.
 */
export interface PdfMergePageOverride {
  readonly rotation: PdfMergePageRotation;
  readonly removed: boolean;
}

/**
 * A single page in the editor's page plan, derived by the store from the current entries plus any {@link PdfMergePageOverride}. Only produced while page editing is enabled.
 */
export interface PdfMergePageView {
  /**
   * Stable identifier — see {@link makePdfMergePageId}.
   */
  readonly id: string;
  /**
   * Id of the {@link PdfMergeEntry} this page came from.
   */
  readonly entryId: string;
  /**
   * Slot that owns the source entry, or `null` when unslotted.
   */
  readonly slotId: Maybe<string>;
  /**
   * Key of the group this page reorders within — see {@link pdfMergePageGroupKeyForSlotId}.
   */
  readonly groupKey: string;
  /**
   * Name of the source file the page came from.
   */
  readonly sourceName: string;
  /**
   * Whether the page came from a PDF or from an embedded image. Also determines how {@link PdfMergePageMeta} dimensions should be read — PDF pages are measured in points, image pages in pixels.
   */
  readonly kind: PdfMergeEntryKind;
  /**
   * Zero-based index of this page within its source document.
   */
  readonly sourceIndex: number;
  /**
   * Total page count of the source document. Drives the "page 2 of 3" label.
   */
  readonly sourcePageCount: number;
  /**
   * Metadata read from the source page.
   */
  readonly meta: PdfMergePageMeta;
  /**
   * User-applied rotation, composed with {@link PdfMergePageMeta.sourceRotation} at merge time.
   */
  readonly rotation: PdfMergePageRotation;
  /**
   * Whether the user marked this page for deletion. Marked pages stay visible in the list (struck through, restorable) but are excluded from the merge output.
   */
  readonly removed: boolean;
}

/**
 * A set of pages that reorder together — every page contributed by one slot's entries, or every unslotted page. Pages never move between groups: the page list renders one CDK drop list per group, and unconnected drop lists cannot accept each other's drags, so the rule is enforced by construction rather than by a guard.
 */
export interface PdfMergePageGroup {
  readonly groupKey: string;
  /**
   * Slot the group belongs to, or `null` for the unslotted group.
   */
  readonly slotId: Maybe<string>;
  readonly pages: readonly PdfMergePageView[];
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
  /**
   * Sparse per-page edit overrides keyed by {@link PdfMergePageView.id}. Only pages the user has touched appear here. Overrides for pages that no longer resolve are ignored by the derived page stream and pruned when their owning entry leaves the list. Stays empty while page editing is disabled.
   */
  readonly pageOverrides: Record<string, PdfMergePageOverride>;
  /**
   * Explicit page ordering per group key, holding {@link PdfMergePageView.id} values. A group absent from this record uses natural order. Ids that no longer resolve are ignored, and pages missing from a stored list are appended in natural order — so the ordering self-heals as entries come and go. Stays empty while page editing is disabled.
   */
  readonly pageOrder: Record<string, string[]>;
}

/**
 * Index movement payload used by the editor's reorder updater.
 */
export interface PdfMergeEntryMove {
  readonly previousIndex: number;
  readonly currentIndex: number;
}

/**
 * Index movement payload used by the editor's page reorder updater. Indices are group-local — the positions the group's CDK drop list sees, not positions in the overall page plan.
 */
export interface PdfMergePageMove {
  readonly groupKey: string;
  /**
   * The group's page ids in the order they were rendered when the drag started.
   *
   * Supplied by the caller rather than recomputed by the store: the plan is derived state, so the store cannot see the exact order the user was looking at. Rewriting the array the component rendered keeps the stored order and the visible order in step.
   */
  readonly pageIds: readonly string[];
  readonly previousIndex: number;
  readonly currentIndex: number;
}

/**
 * Payload for setting a page's rotation.
 */
export interface PdfMergePageRotationChange {
  readonly pageId: string;
  readonly rotation: PdfMergePageRotation;
}

/**
 * Payload for marking a page as removed or restoring it.
 */
export interface PdfMergePageRemovedChange {
  readonly pageId: string;
  readonly removed: boolean;
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
  /**
   * Enables page editing mode. When `true`, the editor's list shows the individual pages of each uploaded PDF instead of one row per file, letting the user reorder, rotate, and mark pages for deletion with the merged output updating live.
   *
   * Pages reorder only within their own slot — a slot is one logical document, so letting a page cross slots would silently move content between documents.
   *
   * Defaults to {@link DEFAULT_DBX_PDF_MERGE_PAGE_EDITING} (`false`), in which case the editor behaves exactly as it does without this option: the page list is never instantiated and no source document is parsed.
   */
  readonly pageEditing?: Maybe<boolean>;
  /**
   * Embeds a sidecar manifest and per-page tags into the merged output, recording which pages came from which slot so downstream code can target them later via `readPdfMergeSidecar`. Independent of {@link pageEditing} — a plain slot merge benefits from the record too.
   *
   * Defaults to {@link DEFAULT_DBX_PDF_MERGE_SIDECAR} (`false`), in which case the output bytes are unchanged.
   */
  readonly sidecar?: Maybe<boolean>;
  /**
   * Overrides merged over the default confirmation shown before the editor's footer Clear button empties every entry. Set `autoConfirm: true` to clear without prompting, restoring the pre-confirmation behavior.
   */
  readonly clearConfirm?: Maybe<DbxActionConfirmConfig>;
  /**
   * Whether the footer Clear button resets a programmatically-supplied document to that document rather than discarding it. Defaults to `true`.
   *
   * See {@link DbxPdfMergeEditorStore.clearEntries} — the point is that an app that populated the editor via `importMergedPdf` (or `[source]`) never ends up looking at an empty editor it did not ask for. Set `false` for an editor whose Clear should empty everything, baseline included.
   */
  readonly restoreImportOnClear?: Maybe<boolean>;
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
