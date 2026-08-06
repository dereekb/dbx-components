import { degrees, PDFDocument } from '@cantoo/pdf-lib';
import { JPEG_MIME_TYPE, JPEG_MIME_TYPES, makeValuesGroupMap, mimeTypeForFileExtension, PDF_ENCRYPT_MARKER, PDF_EOF_MARKER, PDF_HEADER, PDF_MIME_TYPE, PNG_MIME_TYPE, sequentialIncrementingNumberStringModelIdFactory, slashPathDetails, type Building, type FileSize, type Maybe, type MimeTypeWithoutParameters, type ModelIdFactory } from '@dereekb/util';
import { makePdfMergePageId, PDF_MERGE_RESULT_MIME_TYPE, pdfMergePageGroupKeyForSlotId, type PdfMergeEntry, type PdfMergeEntryKind, type PdfMergeEntryOriginal, type PdfMergeEntryValidationResult, type PdfMergeEntryView, type PdfMergePageMeta, type PdfMergePageOverride, type PdfMergePageView } from './pdf.merge';
import { attachPdfMergeSidecar, makePdfMergeSidecar, makePdfMergeSidecarPageTag, splitPdfMergeSidecarDocuments, writePdfMergePageTag, type PdfMergeSidecar, type PdfMergeSidecarPage } from './pdf.merge.sidecar';
import { compressImageFile, type CompressImageDimensions, type DbxImageCompressionConfig, type ImageCompressionStatus } from '../image';

const FULL_ROTATION_DEGREES = 360;

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
  readonly imageCompression?: Maybe<DbxImageCompressionConfig>;
}

interface BuildEntryFromFileInput {
  readonly file: File;
  readonly kind: PdfMergeEntryKind;
  readonly original: PdfMergeEntryOriginal;
  readonly compression: ImageCompressionStatus;
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
    compression,
    encrypted: false
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
 * Lightly inspects a file's bytes to confirm the entry can participate in a merge. PDFs are checked for the standard `%PDF-` header and the `%%EOF` marker. Encrypted PDFs (presence of `/Encrypt`) are still reported as `ok: true` with `encrypted: true` so the editor can decide whether to focus, ignore, or reject the entry — see {@link DbxPdfMergeEncryptedHandling}. Images are accepted as-is — the actual decode happens during merge.
 *
 * @param entry - Entry to validate.
 * @returns Result indicating whether the entry can be merged, optional error message when validation fails, and whether the entry is encrypted.
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
        result = { ok: true, encrypted: true };
      } else {
        result = { ok: true };
      }
    } catch (e) {
      result = { ok: false, errorMessage: (e as Error)?.message ?? 'Failed to read PDF.' };
    }
  }

  return result;
}

/**
 * Normalizes an arbitrary degree value into the `[0, 360)` range.
 *
 * @param angle - Angle in degrees, possibly negative or over a full turn.
 * @returns The equivalent angle in `[0, 360)`.
 * @__NO_SIDE_EFFECTS__
 */
function normalizeRotationDegrees(angle: number): number {
  return ((angle % FULL_ROTATION_DEGREES) + FULL_ROTATION_DEGREES) % FULL_ROTATION_DEGREES;
}

/**
 * Reads per-page metadata from an entry's source document so the editor can list its pages individually.
 *
 * Only called while page editing is enabled — the normal upload path never parses the document, it only scans for the PDF header and markers (see {@link validatePdfMergeEntry}).
 *
 * @param entry - Entry to inspect.
 * @returns One {@link PdfMergePageMeta} per source page, or `null` when the entry is encrypted or cannot be parsed. Image entries report a single synthetic page.
 */
export async function readPdfMergeEntryPageMetas(entry: PdfMergeEntry): Promise<Maybe<PdfMergePageMeta[]>> {
  let metas: Maybe<PdfMergePageMeta[]>;

  if (entry.encrypted) {
    // pdf-lib cannot open an encrypted document at all, so its pages can never be listed or edited.
    metas = null;
  } else if (entry.kind === 'image') {
    const dimensions = entry.original.dimensions;
    metas = [{ sourceIndex: 0, width: dimensions?.width ?? 0, height: dimensions?.height ?? 0, sourceRotation: 0 }];
  } else {
    try {
      const bytes = await entry.file.arrayBuffer();
      const source = await PDFDocument.load(bytes);

      metas = source.getPages().map((page, sourceIndex) => {
        const { width, height } = page.getSize();
        return { sourceIndex, width, height, sourceRotation: normalizeRotationDegrees(page.getRotation().angle) };
      });
    } catch {
      metas = null;
    }
  }

  return metas;
}

/**
 * Why a call to {@link buildPdfMergeEntriesFromSidecar} could not produce entries.
 *
 * - `unreadable` — the bytes are not a PDF this library can open (corrupt, or encrypted).
 * - `no_sidecar` — a readable PDF that carries no manifest, so there is nothing to attribute its pages to. This is the expected outcome for any PDF that did not come out of a merge with `sidecar: true`.
 * - `no_documents` — a manifest is present but resolved to no pages at all.
 */
export type PdfMergeSidecarImportErrorReason = 'unreadable' | 'no_sidecar' | 'no_documents';

/**
 * Outcome of importing a previously-exported merged PDF.
 */
export interface PdfMergeSidecarImportResult {
  /**
   * Entries reconstructed from the file, one per document, each tagged with the slot recorded in the manifest.
   */
  readonly entries: readonly PdfMergeEntry[];
  /**
   * The manifest that was read.
   */
  readonly sidecar: PdfMergeSidecar;
  /**
   * Slot ids present in the imported file, in manifest order. `null` represents the unslotted group.
   */
  readonly slotIds: readonly Maybe<string>[];
  /**
   * Manifest tags that no longer resolve to a page — pages removed from the file after it was exported.
   */
  readonly missingTags: readonly string[];
  /**
   * Pages in the file carrying no tag, i.e. added outside the editor after export.
   */
  readonly untaggedPageCount: number;
}

/**
 * Reconstructs editor entries from a PDF previously exported with an embedded manifest.
 *
 * Each document recorded in the manifest becomes one entry carrying its original slot id, so dropping the result into the store repopulates the same slots the file was built from. This is the re-import half of the sidecar: without it a completed document can only come back as a single opaque file.
 *
 * @param input - Bytes of a merged PDF, typically the file the user just chose.
 * @param config - Optional entry-building config (id factory override).
 * @returns The reconstructed entries and manifest, or a reason when the file cannot be imported.
 */
export async function buildPdfMergeEntriesFromSidecar(input: Blob, config?: Maybe<BuildPdfMergeEntryConfig>): Promise<PdfMergeSidecarImportResult | { readonly error: PdfMergeSidecarImportErrorReason }> {
  const split = await splitPdfMergeSidecarDocuments(input);
  let result: PdfMergeSidecarImportResult | { readonly error: PdfMergeSidecarImportErrorReason };

  if (split == null) {
    // A readable PDF without a manifest and an unreadable one are distinguished so the UI can
    // explain the difference — "not exported from here" reads very differently from "corrupt".
    const readable = await isReadablePdf(input);
    result = { error: readable ? 'no_sidecar' : 'unreadable' };
  } else if (split.documents.length === 0) {
    result = { error: 'no_documents' };
  } else {
    const entries = split.documents.map((document) => buildPdfMergeEntrySync(document.file, { ...config, slotId: document.slotId })).filter((entry): entry is PdfMergeEntry => entry != null);

    result = {
      entries,
      sidecar: split.sidecar,
      slotIds: split.documents.map((document) => document.slotId),
      missingTags: split.missingTags,
      untaggedPageCount: split.untaggedPageCount
    };
  }

  return result;
}

async function isReadablePdf(input: Blob): Promise<boolean> {
  let readable: boolean;

  try {
    await PDFDocument.load(await input.arrayBuffer());
    readable = true;
  } catch {
    readable = false;
  }

  return readable;
}

/**
 * Input for {@link buildPdfMergePagePlan}.
 */
export interface BuildPdfMergePagePlanInput {
  /**
   * Current entries, already projected by the store's encryption handling. Only `ready`, non-`ignored` entries contribute pages.
   */
  readonly entries: readonly PdfMergeEntryView[];
  /**
   * Hydrated page metadata keyed by entry id. A `null` value means the entry could not be expanded (encrypted, or unparseable) and contributes no pages.
   */
  readonly pageMetas: Record<string, Maybe<PdfMergePageMeta[]>>;
  /**
   * Sparse per-page edits keyed by page id.
   */
  readonly pageOverrides: Record<string, PdfMergePageOverride>;
  /**
   * Stored page ordering per group key.
   */
  readonly pageOrder: Record<string, string[]>;
}

function applyPdfMergePageGroupOrder(natural: readonly PdfMergePageView[], orderedIds: Maybe<readonly string[]>): PdfMergePageView[] {
  let ordered: PdfMergePageView[];

  if (orderedIds == null || orderedIds.length === 0) {
    ordered = [...natural];
  } else {
    const byId = new Map(natural.map((page) => [page.id, page]));
    const taken = new Set<string>();
    const result: PdfMergePageView[] = [];

    // Stored ids that still resolve keep their stored order; anything else is ignored.
    orderedIds.forEach((id) => {
      const page = byId.get(id);

      if (page != null && !taken.has(id)) {
        result.push(page);
        taken.add(id);
      }
    });

    // Pages the stored order does not mention are new since it was written — append them in natural order.
    natural.forEach((page) => {
      if (!taken.has(page.id)) {
        result.push(page);
      }
    });

    ordered = result;
  }

  return ordered;
}

/**
 * Builds the editor's page plan from the current entries plus the user's sparse edits.
 *
 * The result is self-healing: stored ordering ids that no longer resolve are dropped, pages the stored ordering does not mention are appended in natural order, and overrides for departed pages are ignored. That means entries can be added and removed without any page-level bookkeeping.
 *
 * Entries whose metadata is `null` contribute no pages — they are encrypted (which `pdf-lib` cannot open) or unparseable. Callers should surface those separately rather than letting them disappear silently.
 *
 * @param input - Entries, hydrated metadata, and the stored edits.
 * @returns The ordered page plan across every group.
 * @__NO_SIDE_EFFECTS__
 */
export function buildPdfMergePagePlan(input: BuildPdfMergePagePlanInput): PdfMergePageView[] {
  const { entries, pageMetas, pageOverrides, pageOrder } = input;
  const eligible = entries.filter((entry) => entry.status === 'ready' && !entry.ignored && pageMetas[entry.id] != null);
  const groups = makeValuesGroupMap(eligible, (entry) => pdfMergePageGroupKeyForSlotId(entry.slotId));
  const plan: PdfMergePageView[] = [];

  groups.forEach((groupEntries, groupKey) => {
    const natural: PdfMergePageView[] = [];

    groupEntries.forEach((entry) => {
      const metas = pageMetas[entry.id] as PdfMergePageMeta[];

      metas.forEach((meta) => {
        const id = makePdfMergePageId(entry.id, meta.sourceIndex);
        const override = pageOverrides[id];

        natural.push({
          id,
          entryId: entry.id,
          slotId: entry.slotId ?? null,
          groupKey: groupKey as string,
          sourceName: entry.name,
          kind: entry.kind,
          sourceIndex: meta.sourceIndex,
          sourcePageCount: metas.length,
          meta,
          rotation: override?.rotation ?? 0,
          removed: override?.removed ?? false
        });
      });
    });

    applyPdfMergePageGroupOrder(natural, pageOrder[groupKey as string]).forEach((page) => plan.push(page));
  });

  return plan;
}

/**
 * One page appended to the output, paired with where it came from. Positionally aligned with the output document's pages, so the sidecar writer can tag them without a second lookup.
 */
interface AppendedPageRecord {
  readonly entry: PdfMergeEntry;
  readonly sourceIndex: number;
  readonly rotation: number;
}

/**
 * Resolves an entry to its parsed source document, caching per merge.
 */
type PdfSourceDocumentLoader = (entry: PdfMergeEntry) => Promise<PDFDocument>;

/**
 * Returns a loader that parses each entry's source document at most once per merge. A page plan routinely pulls several non-adjacent pages from the same file, so without this the same bytes would be parsed repeatedly.
 *
 * @returns Loader that resolves an entry to its parsed source document.
 */
function makePdfSourceDocumentLoader(): PdfSourceDocumentLoader {
  const cache = new Map<string, Promise<PDFDocument>>();

  return (entry: PdfMergeEntry) => {
    let loaded = cache.get(entry.id);

    if (loaded == null) {
      loaded = entry.file.arrayBuffer().then((bytes) => PDFDocument.load(bytes));
      cache.set(entry.id, loaded);
    }

    return loaded;
  };
}

async function appendImagePage(target: PDFDocument, entry: PdfMergeEntry, rotation: number): Promise<AppendedPageRecord> {
  const bytes = await entry.file.arrayBuffer();
  const isPng = entry.mimeType === PNG_MIME_TYPE || entry.name.toLowerCase().endsWith('.png');
  const image = isPng ? await target.embedPng(bytes) : await target.embedJpg(bytes);
  const page = target.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });

  if (rotation !== 0) {
    page.setRotation(degrees(rotation));
  }

  return { entry, sourceIndex: 0, rotation };
}

/**
 * Shared input for the two page-appending strategies.
 */
interface AppendPagesInput {
  /**
   * Document being assembled.
   */
  readonly target: PDFDocument;
  /**
   * Ready entries participating in the merge.
   */
  readonly entries: readonly PdfMergeEntry[];
  /**
   * Per-merge cached source document loader.
   */
  readonly loadSource: PdfSourceDocumentLoader;
}

/**
 * Input for {@link appendPlannedPages}.
 */
interface AppendPlannedPagesInput extends AppendPagesInput {
  /**
   * Ordered page plan driving the output.
   */
  readonly plan: readonly PdfMergePageView[];
}

/**
 * Appends every page of every entry, in entry order — the behavior used when no page plan is supplied.
 *
 * @param input - Target document, entries, and source loader.
 * @returns One record per appended page, aligned with the target's pages.
 */
async function appendAllEntryPages(input: AppendPagesInput): Promise<AppendedPageRecord[]> {
  const { target, entries, loadSource } = input;
  const records: AppendedPageRecord[] = [];

  for (const entry of entries) {
    if (entry.kind === 'pdf') {
      const source = await loadSource(entry);
      const indices = source.getPageIndices();
      const copied = await target.copyPages(source, indices);

      copied.forEach((page, index) => {
        target.addPage(page);
        records.push({ entry, sourceIndex: indices[index], rotation: normalizeRotationDegrees(page.getRotation().angle) });
      });
    } else {
      records.push(await appendImagePage(target, entry, 0));
    }
  }

  return records;
}

/**
 * Appends pages according to an explicit plan — honoring subsetting, reordering, and per-page rotation.
 *
 * Consecutive pages from the same entry are batched into a single `copyPages` call. `copyPages` returns pages in the order of the indices it is given, which is what lets subsetting and reordering happen in one operation.
 *
 * @param input - Target document, entries, page plan, and source loader.
 * @returns One record per appended page, aligned with the target's pages.
 */
async function appendPlannedPages(input: AppendPlannedPagesInput): Promise<AppendedPageRecord[]> {
  const { target, entries, plan, loadSource } = input;
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const visible = plan.filter((page) => !page.removed && entriesById.has(page.entryId));
  const records: AppendedPageRecord[] = [];
  let index = 0;

  while (index < visible.length) {
    const first = visible[index];
    const entry = entriesById.get(first.entryId) as PdfMergeEntry;
    let end = index + 1;

    while (end < visible.length && visible[end].entryId === first.entryId) {
      end += 1;
    }

    const run = visible.slice(index, end);

    if (entry.kind === 'image') {
      for (const planned of run) {
        records.push(await appendImagePage(target, entry, normalizeRotationDegrees(planned.rotation)));
      }
    } else {
      const source = await loadSource(entry);
      const copied = await target.copyPages(
        source,
        run.map((planned) => planned.sourceIndex)
      );

      copied.forEach((page, runIndex) => {
        const planned = run[runIndex];
        // Compose rather than replace: a scan already stored at 90° that the user rotates by 90° must land at 180°.
        const rotation = normalizeRotationDegrees(planned.meta.sourceRotation + planned.rotation);

        target.addPage(page);
        page.setRotation(degrees(rotation));
        records.push({ entry, sourceIndex: planned.sourceIndex, rotation });
      });
    }

    index = end;
  }

  return records;
}

/**
 * Tags each output page and attaches the manifest describing which pages belong to which slot.
 *
 * @param target - Document being assembled, whose pages align with `records`.
 * @param records - One record per appended page, in output order.
 */
async function writePdfMergeSidecarForRecords(target: PDFDocument, records: readonly AppendedPageRecord[]): Promise<void> {
  const ordinalBySlotKey = new Map<string, number>();
  const outputPages = target.getPages();

  const sidecarPages: PdfMergeSidecarPage[] = records.map((record, outputIndex) => {
    // Normalize to null so the value survives JSON.stringify, which drops undefined.
    const slotId = record.entry.slotId ?? null;
    const slotKey = slotId ?? '';
    const ordinal = ordinalBySlotKey.get(slotKey) ?? 0;
    const tag = makePdfMergeSidecarPageTag(slotId, ordinal);

    ordinalBySlotKey.set(slotKey, ordinal + 1);
    writePdfMergePageTag(outputPages[outputIndex], tag);

    return { tag, slotId, sourceName: record.entry.name, sourceIndex: record.sourceIndex, rotation: record.rotation, outputIndex };
  });

  await attachPdfMergeSidecar(target, makePdfMergeSidecar(sidecarPages));
}

/**
 * Options for {@link mergePdfMergeEntries}. Both are optional, and omitting them reproduces the original every-page-of-every-entry merge byte for byte.
 */
export interface MergePdfMergeEntriesOptions {
  /**
   * Explicit page plan driving the output. When supplied, only the plan's non-removed pages are emitted, in plan order, with each page's rotation composed onto its source rotation. When omitted, every page of every entry is emitted in entry order.
   */
  readonly pages?: Maybe<readonly PdfMergePageView[]>;
  /**
   * Whether to tag each output page and embed a manifest recording which pages came from which slot. See `readPdfMergeSidecar`.
   */
  readonly sidecar?: Maybe<boolean>;
}

/**
 * Merges every `ready` entry in the provided array order into a single PDF and returns it as a `Blob`. PDF entries contribute their full set of pages in order; image entries contribute one page sized to the image.
 *
 * Supplying {@link MergePdfMergeEntriesOptions.pages} replaces that default with an explicit page plan, so pages can be subsetted, reordered, and rotated. Supplying {@link MergePdfMergeEntriesOptions.sidecar} additionally embeds a manifest of which pages came from which slot.
 *
 * Special case: when the only `ready` entry is a single encrypted PDF, returns a passthrough `Blob` of its original bytes — `pdf-lib` cannot read encrypted PDFs even with `ignoreEncryption: true`, and downstream upload flows still need a usable blob. Neither the page plan nor the sidecar applies on that path, since the document cannot be opened.
 *
 * Throws if no `ready` entries are provided, if multiple encrypted entries are passed in (the editor only routes here under focus mode where it has narrowed to one), or if the page plan leaves no pages to emit.
 *
 * @param entries - Ordered entries to merge.
 * @param options - Optional page plan and sidecar switch.
 * @returns A Blob with `application/pdf` MIME type.
 */
export async function mergePdfMergeEntries(entries: readonly PdfMergeEntry[], options?: Maybe<MergePdfMergeEntriesOptions>): Promise<Blob> {
  const ready = entries.filter((entry) => entry.status === 'ready');
  let result: Blob;

  if (ready.length === 0) {
    throw new Error('No ready entries to merge.');
  } else if (ready.length === 1 && ready[0].encrypted) {
    const bytes = await ready[0].file.arrayBuffer();
    result = new Blob([bytes], { type: PDF_MERGE_RESULT_MIME_TYPE });
  } else if (ready.some((entry) => entry.encrypted)) {
    throw new Error('Encrypted PDFs cannot be merged with other files.');
  } else {
    const target = await PDFDocument.create();
    const loadSource = makePdfSourceDocumentLoader();
    const plan = options?.pages;
    const records = plan == null ? await appendAllEntryPages({ target, entries: ready, loadSource }) : await appendPlannedPages({ target, entries: ready, plan, loadSource });

    if (records.length === 0) {
      throw new Error('No pages to merge.');
    }

    if (options?.sidecar) {
      await writePdfMergeSidecarForRecords(target, records);
    }

    const bytes = await target.save();
    result = new Blob([bytes as BlobPart], { type: PDF_MERGE_RESULT_MIME_TYPE });
  }

  return result;
}
