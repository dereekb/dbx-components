import { PDFDocument } from '@cantoo/pdf-lib';
import { type Maybe, sequentialIncrementingNumberStringModelIdFactory, type ModelIdFactory } from '@dereekb/util';
import { PDF_MERGE_RESULT_MIME_TYPE, type PdfMergeEntry, type PdfMergeEntryKind } from './pdf.merge';

const PDF_MIME_TYPE = 'application/pdf';
const PNG_MIME_TYPE = 'image/png';
const JPEG_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/jpg', 'image/pjpeg'];

const PDF_HEADER = '%PDF-';
const PDF_EOF_MARKER = '%%EOF';
const PDF_ENCRYPT_MARKER = '/Encrypt';

const TEXT_DECODER = new TextDecoder('latin1');

/**
 * Validation result for a single {@link PdfMergeEntry}.
 */
export interface PdfMergeEntryValidationResult {
  readonly ok: boolean;
  readonly error?: Maybe<string>;
}

/**
 * Returns the {@link PdfMergeEntryKind} for a file based on its MIME type, with a small fallback to file-extension matching when the browser provided no MIME type.
 *
 * @param file - File picked from the upload component.
 * @returns The classified kind, or `null` if the file is not a supported PDF/PNG/JPEG.
 */
export function classifyPdfMergeFile(file: File): PdfMergeEntryKind | null {
  const mimeType = (file.type ?? '').toLowerCase();
  const lower = file.name.toLowerCase();
  let kind: PdfMergeEntryKind | null;

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
function resolvePdfMergeMimeType(file: File, kind: PdfMergeEntryKind): string {
  let mimeType: string;

  if (file.type) {
    mimeType = file.type;
  } else if (kind === 'pdf') {
    mimeType = PDF_MIME_TYPE;
  } else if (file.name.toLowerCase().endsWith('.png')) {
    mimeType = PNG_MIME_TYPE;
  } else {
    mimeType = 'image/jpeg';
  }

  return mimeType;
}

/**
 * Default factory used to generate stable per-instance entry IDs.
 */
const DEFAULT_ENTRY_ID_FACTORY: ModelIdFactory = sequentialIncrementingNumberStringModelIdFactory();

/**
 * Builds a {@link PdfMergeEntry} from a user-provided file, classifying its kind and assigning a fresh id. Returns `null` for unsupported file types so the caller can drop them.
 *
 * @param file - File the user added.
 * @param idFactory - Optional id factory override (used by tests for deterministic ids).
 * @returns The new entry with `validating` status, or `null` when the file is not a supported PDF/PNG/JPEG.
 */
export function buildPdfMergeEntry(file: File, idFactory: ModelIdFactory = DEFAULT_ENTRY_ID_FACTORY): PdfMergeEntry | null {
  const kind = classifyPdfMergeFile(file);
  let entry: PdfMergeEntry | null;

  if (kind == null) {
    entry = null;
  } else {
    entry = {
      id: idFactory(),
      file,
      name: file.name,
      mimeType: resolvePdfMergeMimeType(file, kind),
      size: file.size,
      kind,
      status: 'validating'
    };
  }

  return entry;
}

/**
 * Lightly inspects a file's bytes to confirm the entry can participate in a merge. PDFs are checked for the standard `%PDF-` header, the `%%EOF` marker, and absence of an `/Encrypt` dictionary. Images are accepted as-is — the actual decode happens during merge.
 *
 * @param entry - Entry to validate.
 * @returns Result indicating whether the entry can be merged plus an error message when validation fails.
 */
export async function validatePdfMergeEntry(entry: PdfMergeEntry): Promise<PdfMergeEntryValidationResult> {
  let result: PdfMergeEntryValidationResult;

  if (entry.kind === 'image') {
    if (entry.file.size <= 0) {
      result = { ok: false, error: 'Image file is empty.' };
    } else {
      result = { ok: true };
    }
  } else {
    try {
      const buffer = await entry.file.arrayBuffer();
      const text = TEXT_DECODER.decode(buffer);

      if (!text.startsWith(PDF_HEADER) || !text.includes(PDF_EOF_MARKER)) {
        result = { ok: false, error: 'File does not appear to be a valid PDF.' };
      } else if (text.includes(PDF_ENCRYPT_MARKER)) {
        result = { ok: false, error: 'Password-protected PDFs cannot be merged.' };
      } else {
        result = { ok: true };
      }
    } catch (e) {
      result = { ok: false, error: (e as Error)?.message ?? 'Failed to read PDF.' };
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
