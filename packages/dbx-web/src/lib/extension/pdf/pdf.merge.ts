import { JPEG_MIME_TYPE, PDF_MIME_TYPE, PNG_MIME_TYPE, type FileSize, type Maybe, type MimeTypeWithoutParameters } from '@dereekb/util';

/**
 * Identifies which kind of source file a {@link PdfMergeEntry} represents.
 *
 * - `pdf` — an existing PDF document whose pages are copied into the merged output.
 * - `image` — a raster image (PNG/JPEG) embedded as a single page in the merged output.
 */
export type PdfMergeEntryKind = 'pdf' | 'image';

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
}

/**
 * MIME types accepted by the PDF merge editor by default: PDF documents and PNG/JPEG images.
 */
export const PDF_MERGE_DEFAULT_ACCEPT: readonly MimeTypeWithoutParameters[] = [PDF_MIME_TYPE, PNG_MIME_TYPE, JPEG_MIME_TYPE];

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
