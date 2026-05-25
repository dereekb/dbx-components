import { PDFDocument } from '@cantoo/pdf-lib';
import { JPEG_MIME_TYPE, JPEG_MIME_TYPES, mimeTypeForFileExtension, PDF_ENCRYPT_MARKER, PDF_EOF_MARKER, PDF_HEADER, PDF_MIME_TYPE, PNG_MIME_TYPE, sequentialIncrementingNumberStringModelIdFactory, slashPathDetails, type Building, type FileSize, type Maybe, type MimeTypeWithoutParameters, type ModelIdFactory } from '@dereekb/util';
import { PDF_MERGE_RESULT_MIME_TYPE, type DbxPdfMergeImageCompressionConfig, type PdfMergeEntry, type PdfMergeEntryCompressionStatus, type PdfMergeEntryKind, type PdfMergeEntryOriginal, type PdfMergeEntryValidationResult } from './pdf.merge';
import { compressImageFile, type CompressImageDimensions } from './pdf.merge.image.compression';

const TEXT_DECODER = new TextDecoder('latin1');

const FORMAT_KILOBYTE = 1024;
const FORMAT_MEGABYTE = FORMAT_KILOBYTE * 1024;

/**
 * Formats a byte count as a short human-readable string (`B` / `KB` / `MB`). Used by the merge editor banner and entry rows.
 *
 * @param size - Byte count to format.
 * @returns Human-readable string.
 * @__NO_SIDE_EFFECTS__
 */
export function formatPdfMergeEntrySize(size: FileSize): string {
  let result: string;

  if (size >= FORMAT_MEGABYTE) {
    result = `${(size / FORMAT_MEGABYTE).toFixed(1)} MB`;
  } else if (size >= FORMAT_KILOBYTE) {
    result = `${(size / FORMAT_KILOBYTE).toFixed(1)} KB`;
  } else {
    result = `${size} B`;
  }

  return result;
}

/**
 * Returns the {@link PdfMergeEntryKind} for a file based on its MIME type, with a small fallback to file-extension matching when the browser provided no MIME type.
 *
 * @param file - File picked from the upload component.
 * @returns The classified kind, or `null` if the file is not a supported PDF/PNG/JPEG.
 */
export function classifyPdfMergeFile(file: File): Maybe<PdfMergeEntryKind> {
  const mimeType = (file.type ?? '').toLowerCase();
  const lower = file.name.toLowerCase();
  let kind: Maybe<PdfMergeEntryKind>;

  if (mimeType === PDF_MIME_TYPE || lower.endsWith('.pdf')) {
    kind = 'pdf';
  } else if (mimeType === PNG_MIME_TYPE || JPEG_MIME_TYPES.includes(mimeType) || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    kind = 'image';
  } else {
    kind = null;
  }

  return kind;
}

/**
 * Returns the resolved MIME type for a file, falling back to a kind-derived default when the browser supplied no `type`.
 *
 * @param file - File whose MIME type should be resolved.
 * @param kind - Classification used as the basis for fallback resolution.
 * @returns The MIME type string the merge editor should use for this file.
 */
function resolvePdfMergeMimeType(file: File, kind: PdfMergeEntryKind): MimeTypeWithoutParameters {
  let mimeType: MimeTypeWithoutParameters;

  if (file.type) {
    mimeType = file.type;
  } else {
    const { typedFileExtension } = slashPathDetails(file.name.toLowerCase());
    mimeType = mimeTypeForFileExtension(typedFileExtension) ?? (kind === 'pdf' ? PDF_MIME_TYPE : JPEG_MIME_TYPE);
  }

  return mimeType;
}

/**
 * Default factory used to generate stable per-instance entry IDs.
 */
const DEFAULT_ENTRY_ID_FACTORY: ModelIdFactory = sequentialIncrementingNumberStringModelIdFactory();

/**
 * Optional input for {@link buildPdfMergeEntry} / {@link buildPdfMergeEntrySync}.
 */
export interface BuildPdfMergeEntryConfig {
  /**
   * Optional slot identifier to attach to the entry. Used by the store to attribute the entry to a {@link DbxPdfMergeEditorFileUploadComponent} slot.
   */
  readonly slotId?: Maybe<string>;
  /**
   * Optional id factory override (used by tests for deterministic ids).
   */
  readonly idFactory?: ModelIdFactory;
  /**
   * Optional client-side image compression config to apply to image files before the entry is constructed. Ignored for PDFs.
   */
  readonly imageCompression?: Maybe<DbxPdfMergeImageCompressionConfig>;
}

interface BuildEntryFromFileInput {
  readonly file: File;
  readonly kind: PdfMergeEntryKind;
  readonly original: PdfMergeEntryOriginal;
  readonly compression: PdfMergeEntryCompressionStatus;
  readonly idFactory: ModelIdFactory;
  readonly slotId: Maybe<string>;
}

function buildEntryFromFile(input: BuildEntryFromFileInput): PdfMergeEntry {
  const { file, kind, original, compression, idFactory, slotId } = input;
  const nextEntry = {
    id: idFactory(),
    file,
    name: file.name,
    mimeType: resolvePdfMergeMimeType(file, kind),
    size: file.size,
    kind,
    status: 'validating' as const,
    slotId,
    original,
    compression
  };

  (nextEntry as Building<PdfMergeEntry>).validation = validatePdfMergeEntry(nextEntry);
  return nextEntry as PdfMergeEntry;
}

function originalFromFile(file: File, kind: PdfMergeEntryKind, dimensions?: Maybe<CompressImageDimensions>): PdfMergeEntryOriginal {
  return {
    name: file.name,
    mimeType: resolvePdfMergeMimeType(file, kind),
    size: file.size,
    dimensions
  };
}

/**
 * Builds a {@link PdfMergeEntry} synchronously from a user-provided file, classifying its kind and assigning a fresh id. Skips image compression — callers that need it must use the async {@link buildPdfMergeEntry}. Returns `null` for unsupported file types so the caller can drop them.
 *
 * @param file - File the user added.
 * @param config - Optional config for slot attribution and id factory override. `imageCompression` is ignored here.
 * @returns The new entry with `validating` status, or `null` when the file is not a supported PDF/PNG/JPEG.
 * @__NO_SIDE_EFFECTS__
 */
export function buildPdfMergeEntrySync(file: File, config?: Maybe<BuildPdfMergeEntryConfig>): Maybe<PdfMergeEntry> {
  const kind = classifyPdfMergeFile(file);
  const idFactory = config?.idFactory ?? DEFAULT_ENTRY_ID_FACTORY;
  const slotId = config?.slotId;
  let entry: Maybe<PdfMergeEntry>;

  if (kind == null) {
    entry = null;
  } else {
    const original = originalFromFile(file, kind);
    entry = buildEntryFromFile({ file, kind, original, compression: 'unchanged', idFactory, slotId });
  }

  return entry;
}

/**
 * Builds a {@link PdfMergeEntry} from a user-provided file, classifying its kind and assigning a fresh id. For image files with an `imageCompression` config the source is downscaled and/or PNG→JPEG converted before the entry is constructed; the original file metadata is captured under {@link PdfMergeEntry.original} regardless. Returns `null` for unsupported file types so the caller can drop them.
 *
 * @param file - File the user added.
 * @param config - Optional config for slot attribution, id factory override, and image compression.
 * @returns The new entry with `validating` status, or `null` when the file is not a supported PDF/PNG/JPEG.
 */
export async function buildPdfMergeEntry(file: File, config?: Maybe<BuildPdfMergeEntryConfig>): Promise<Maybe<PdfMergeEntry>> {
  const kind = classifyPdfMergeFile(file);
  const idFactory = config?.idFactory ?? DEFAULT_ENTRY_ID_FACTORY;
  const slotId = config?.slotId;
  const imageCompression = config?.imageCompression;
  let entry: Maybe<PdfMergeEntry>;

  if (kind == null) {
    entry = null;
  } else if (kind === 'image' && imageCompression != null) {
    const compressionResult = await compressImageFile(file, imageCompression);
    const original = originalFromFile(file, kind, compressionResult.originalDimensions);
    entry = buildEntryFromFile({ file: compressionResult.file, kind, original, compression: compressionResult.compression, idFactory, slotId });
  } else {
    const original = originalFromFile(file, kind);
    entry = buildEntryFromFile({ file, kind, original, compression: 'unchanged', idFactory, slotId });
  }

  return entry;
}

/**
 * Lightly inspects a file's bytes to confirm the entry can participate in a merge. PDFs are checked for the standard `%PDF-` header, the `%%EOF` marker, and absence of an `/Encrypt` dictionary. Images are accepted as-is — the actual decode happens during merge.
 *
 * @param entry - Entry to validate.
 * @returns Result indicating whether the entry can be merged plus an error message when validation fails.
 */
export async function validatePdfMergeEntry(entry: Omit<PdfMergeEntry, 'validation'>): Promise<PdfMergeEntryValidationResult> {
  let result: PdfMergeEntryValidationResult;

  if (entry.kind === 'image') {
    if (entry.file.size <= 0) {
      result = { ok: false, errorMessage: 'Image file is empty.' };
    } else {
      result = { ok: true };
    }
  } else {
    try {
      const buffer = await entry.file.arrayBuffer();
      const text = TEXT_DECODER.decode(buffer);

      if (!text.startsWith(PDF_HEADER) || !text.includes(PDF_EOF_MARKER)) {
        result = { ok: false, errorMessage: 'File does not appear to be a valid PDF.' };
      } else if (text.includes(PDF_ENCRYPT_MARKER)) {
        result = { ok: false, errorMessage: 'Password-protected PDFs cannot be merged.' };
      } else {
        result = { ok: true };
      }
    } catch (e) {
      result = { ok: false, errorMessage: (e as Error)?.message ?? 'Failed to read PDF.' };
    }
  }

  return result;
}

async function appendPdfPages(target: PDFDocument, entry: PdfMergeEntry): Promise<void> {
  const bytes = await entry.file.arrayBuffer();
  const source = await PDFDocument.load(bytes);
  const pages = await target.copyPages(source, source.getPageIndices());
  pages.forEach((page) => target.addPage(page));
}

async function appendImagePage(target: PDFDocument, entry: PdfMergeEntry): Promise<void> {
  const bytes = await entry.file.arrayBuffer();
  const isPng = entry.mimeType === PNG_MIME_TYPE || entry.name.toLowerCase().endsWith('.png');
  const image = isPng ? await target.embedPng(bytes) : await target.embedJpg(bytes);
  const page = target.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
}

/**
 * Merges every `ready` entry in the provided array order into a single PDF and returns it as a `Blob`. PDF entries contribute their full set of pages in order; image entries contribute one page sized to the image. Throws if no `ready` entries are provided.
 *
 * @param entries - Ordered entries to merge.
 * @returns A Blob with `application/pdf` MIME type.
 */
export async function mergePdfMergeEntries(entries: readonly PdfMergeEntry[]): Promise<Blob> {
  const ready = entries.filter((entry) => entry.status === 'ready');

  if (ready.length === 0) {
    throw new Error('No ready entries to merge.');
  }

  const target = await PDFDocument.create();

  for (const entry of ready) {
    if (entry.kind === 'pdf') {
      await appendPdfPages(target, entry);
    } else {
      await appendImagePage(target, entry);
    }
  }

  const bytes = await target.save();
  return new Blob([bytes as BlobPart], { type: PDF_MERGE_RESULT_MIME_TYPE });
}
