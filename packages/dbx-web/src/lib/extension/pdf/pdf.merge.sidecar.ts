import { PDFDocument, PDFHexString, PDFName, PDFString, type PDFPage } from '@cantoo/pdf-lib';
import { JSON_MIME_TYPE, type ISO8601DateString, type Maybe } from '@dereekb/util';

/**
 * Name of the JSON manifest attached to a merged PDF that records which pages came from which slot.
 */
export const PDF_MERGE_SIDECAR_FILE_NAME = 'dbx-pdf-merge.json';

/**
 * Key set on each output page's dictionary holding that page's {@link PdfMergeSidecarPage.tag}.
 *
 * Custom page-dictionary keys travel with the page: they survive `copyPages` (including subsetting and reordering), a save/load round trip, and further edits. That is what makes tags — rather than the manifest's recorded indices — the authoritative record of which document a page belongs to.
 */
export const PDF_MERGE_PAGE_TAG_KEY = 'DbxPageTag';

/**
 * Schema version of the emitted {@link PdfMergeSidecar}.
 */
export const PDF_MERGE_SIDECAR_VERSION = 1;

/**
 * Description recorded on the attached manifest.
 */
export const PDF_MERGE_SIDECAR_DESCRIPTION = 'dbx-pdf-merge page manifest';

/**
 * Record of a single page in the merged output.
 */
export interface PdfMergeSidecarPage {
  /**
   * Identifier written onto the page's own dictionary. Unique within the output document.
   */
  readonly tag: string;
  /**
   * Slot the page's source file was uploaded into, or `null` when unslotted.
   */
  readonly slotId: Maybe<string>;
  /**
   * Name of the source file the page came from.
   */
  readonly sourceName: string;
  /**
   * Zero-based index of the page within its source document.
   */
  readonly sourceIndex: number;
  /**
   * Total rotation applied to the page in the output, in degrees.
   */
  readonly rotation: number;
  /**
   * Position of the page in the output at the time the manifest was written.
   *
   * A hint only. Anything that reorders the document afterwards leaves this stale, so {@link readPdfMergeSidecar} resolves positions from page tags and falls back to this value only when a tag is missing.
   */
  readonly outputIndex: number;
}

/**
 * One logical document within the merged output — in practice, one editor slot.
 */
export interface PdfMergeSidecarDocument {
  /**
   * Slot id, or `null` for the unslotted group.
   */
  readonly slotId: Maybe<string>;
  /**
   * Tags of the pages belonging to this document, in output order at write time. This membership list is authoritative and survives reordering; resolve each tag to a current page index rather than trusting positions.
   */
  readonly pageTags: readonly string[];
}

/**
 * Manifest embedded in a merged PDF describing which pages came from which document.
 */
export interface PdfMergeSidecar {
  readonly version: number;
  readonly createdAt: ISO8601DateString;
  readonly documents: readonly PdfMergeSidecarDocument[];
  readonly pages: readonly PdfMergeSidecarPage[];
}

/**
 * A manifest page resolved against the document actually being read.
 */
export interface PdfMergeSidecarResolvedPage extends PdfMergeSidecarPage {
  /**
   * Current zero-based index of the page in the document being read.
   */
  readonly pageIndex: number;
  /**
   * Whether {@link pageIndex} came from the page's own tag (`true`) or fell back to the manifest's recorded {@link PdfMergeSidecarPage.outputIndex} because the tag was missing (`false`). A `false` here means something stripped the page tags — treat the position as best-effort.
   */
  readonly resolvedByTag: boolean;
}

/**
 * A manifest document resolved against the document actually being read.
 */
export interface PdfMergeSidecarResolvedDocument {
  readonly slotId: Maybe<string>;
  readonly pages: readonly PdfMergeSidecarResolvedPage[];
}

/**
 * Result of reading a merged PDF's embedded manifest.
 */
export interface PdfMergeSidecarReadResult {
  /**
   * The manifest exactly as it was embedded.
   */
  readonly sidecar: PdfMergeSidecar;
  /**
   * Documents with each page resolved to its current index in the file that was read.
   */
  readonly documents: readonly PdfMergeSidecarResolvedDocument[];
  /**
   * Tags listed in the manifest that could not be resolved to any page — the page was removed after the manifest was written, or its tag was stripped and no fallback index was usable.
   */
  readonly missingTags: readonly string[];
  /**
   * Number of pages in the document that carry no tag. Non-zero means pages were added outside the merge editor, or a third-party tool dropped the tags.
   */
  readonly untaggedPageCount: number;
}

/**
 * Builds the tag written onto an output page.
 *
 * @param slotId - Slot the page's source entry belongs to, or `null` when unslotted.
 * @param ordinal - Zero-based position of the page within its own slot's pages.
 * @returns A tag unique within the output document.
 * @__NO_SIDE_EFFECTS__
 */
export function makePdfMergeSidecarPageTag(slotId: Maybe<string>, ordinal: number): string {
  return `${slotId ?? '_'}-${ordinal}`;
}

/**
 * Writes a page's tag onto its page dictionary so the association survives later reordering.
 *
 * @param page - Page in the output document.
 * @param tag - Tag to record.
 */
export function writePdfMergePageTag(page: PDFPage, tag: string): void {
  page.node.set(PDFName.of(PDF_MERGE_PAGE_TAG_KEY), PDFString.of(tag));
}

/**
 * Reads the tag previously written onto a page, if any.
 *
 * Uses `get` plus an instance check rather than a typed `lookup`, because `PDFDict.lookup(key, PDFString)` throws when the key is absent — which is the normal case for any PDF that did not come out of this editor.
 *
 * @param page - Page to inspect.
 * @returns The tag, or `null` when the page carries none.
 */
export function readPdfMergePageTag(page: PDFPage): Maybe<string> {
  const value = page.node.get(PDFName.of(PDF_MERGE_PAGE_TAG_KEY));
  let tag: Maybe<string>;

  if (value instanceof PDFString || value instanceof PDFHexString) {
    tag = value.decodeText();
  } else {
    tag = null;
  }

  return tag;
}

/**
 * Attaches a manifest to the output document as an embedded JSON file.
 *
 * @param document - Output document being saved.
 * @param sidecar - Manifest to embed.
 */
export async function attachPdfMergeSidecar(document: PDFDocument, sidecar: PdfMergeSidecar): Promise<void> {
  // Re-wrap with this module's Uint8Array: pdf-lib validates its input with `instanceof`, and a
  // TextEncoder supplied by another realm (Node's, under jsdom) produces an array that fails that
  // check even though it is a genuine Uint8Array.
  const bytes = new Uint8Array(new TextEncoder().encode(JSON.stringify(sidecar)));
  await document.attach(bytes, PDF_MERGE_SIDECAR_FILE_NAME, {
    mimeType: JSON_MIME_TYPE,
    description: PDF_MERGE_SIDECAR_DESCRIPTION
  });
}

/**
 * Builds a {@link PdfMergeSidecar} from the pages written to an output document.
 *
 * @param pages - Page records in output order.
 * @returns The manifest, with one document per distinct slot in first-appearance order.
 * @__NO_SIDE_EFFECTS__
 */
export function makePdfMergeSidecar(pages: readonly PdfMergeSidecarPage[]): PdfMergeSidecar {
  const tagsBySlot = new Map<Maybe<string>, string[]>();

  pages.forEach((page) => {
    const existing = tagsBySlot.get(page.slotId);

    if (existing == null) {
      tagsBySlot.set(page.slotId, [page.tag]);
    } else {
      existing.push(page.tag);
    }
  });

  const documents: PdfMergeSidecarDocument[] = Array.from(tagsBySlot.entries()).map(([slotId, pageTags]) => ({ slotId, pageTags }));

  return {
    version: PDF_MERGE_SIDECAR_VERSION,
    createdAt: new Date().toISOString(),
    documents,
    pages
  };
}

/**
 * Source bytes accepted by {@link readPdfMergeSidecar}.
 */
export type PdfMergeSidecarReadInput = Blob | ArrayBuffer | Uint8Array;

async function bytesForSidecarReadInput(input: PdfMergeSidecarReadInput): Promise<ArrayBuffer | Uint8Array> {
  return input instanceof Blob ? input.arrayBuffer() : input;
}

function parseSidecarBytes(data: Uint8Array): Maybe<PdfMergeSidecar> {
  let sidecar: Maybe<PdfMergeSidecar>;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(data)) as PdfMergeSidecar;
    sidecar = Array.isArray(parsed?.documents) && Array.isArray(parsed?.pages) ? parsed : null;
  } catch {
    sidecar = null;
  }

  return sidecar;
}

/**
 * Reads the manifest embedded in a merged PDF and resolves each recorded page to its current position in that file.
 *
 * Resolution prefers each page's own tag, which follows the page through reordering. The manifest's {@link PdfMergeSidecarPage.outputIndex} is used only as a fallback for pages whose tag has been stripped, and any index that no longer exists is reported through {@link PdfMergeSidecarReadResult.missingTags} instead.
 *
 * @param input - The merged PDF's bytes.
 * @returns The manifest and its resolved documents, or `null` when the file carries no manifest, is unreadable, or is encrypted.
 */
export async function readPdfMergeSidecar(input: PdfMergeSidecarReadInput): Promise<Maybe<PdfMergeSidecarReadResult>> {
  let result: Maybe<PdfMergeSidecarReadResult>;

  try {
    const bytes = await bytesForSidecarReadInput(input);
    const document = await PDFDocument.load(bytes);
    const attachment = document.getAttachments().find((x) => x.name === PDF_MERGE_SIDECAR_FILE_NAME);
    const sidecar = attachment == null ? null : parseSidecarBytes(attachment.data);

    if (sidecar == null) {
      result = null;
    } else {
      const pageCount = document.getPageCount();
      const indexByTag = new Map<string, number>();
      let untaggedPageCount = 0;

      document.getPages().forEach((page, index) => {
        const tag = readPdfMergePageTag(page);

        if (tag == null) {
          untaggedPageCount += 1;
        } else {
          indexByTag.set(tag, index);
        }
      });

      const recordByTag = new Map(sidecar.pages.map((page) => [page.tag, page]));
      const missingTags: string[] = [];

      const documents = sidecar.documents.map((sidecarDocument) => {
        const pages: PdfMergeSidecarResolvedPage[] = [];

        sidecarDocument.pageTags.forEach((tag) => {
          const record = recordByTag.get(tag);
          const taggedIndex = indexByTag.get(tag);

          if (record == null) {
            missingTags.push(tag);
          } else if (taggedIndex != null) {
            pages.push({ ...record, pageIndex: taggedIndex, resolvedByTag: true });
          } else if (record.outputIndex >= 0 && record.outputIndex < pageCount) {
            pages.push({ ...record, pageIndex: record.outputIndex, resolvedByTag: false });
          } else {
            missingTags.push(tag);
          }
        });

        return { slotId: sidecarDocument.slotId, pages };
      });

      result = { sidecar, documents, missingTags, untaggedPageCount };
    }
  } catch {
    result = null;
  }

  return result;
}
