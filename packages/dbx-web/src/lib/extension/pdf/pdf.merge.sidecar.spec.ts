import { PDFDocument, degrees, type Rotation } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';
import { makePdfMergePageId, pdfMergePageGroupKeyForSlotId, type PdfMergeEntry, type PdfMergePageRotation, type PdfMergePageView } from './pdf.merge';
import { buildPdfMergeEntriesFromSidecar, mergePdfMergeEntries, type PdfMergeSidecarImportResult } from './pdf.merge.utility';
import { PDF_MERGE_SIDECAR_FILE_NAME, makePdfMergeSidecarPageTag, readPdfMergePageTag, readPdfMergeSidecar, splitPdfMergeSidecarDocuments } from './pdf.merge.sidecar';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

/**
 * Builds a genuinely parseable PDF. The text fakes used elsewhere in these specs satisfy the header/EOF scan but cannot be opened by pdf-lib, so anything touching pages needs a real document.
 */
async function makeRealPdfFile(name: string, pageCount: number, rotation?: Rotation): Promise<File> {
  const document = await PDFDocument.create();

  for (let i = 0; i < pageCount; i += 1) {
    const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    if (rotation != null) {
      page.setRotation(rotation);
    }
  }

  const bytes = await document.save();
  return new File([bytes as BlobPart], name, { type: 'application/pdf' });
}

function readyPdfEntry(overrides: Partial<PdfMergeEntry> & Pick<PdfMergeEntry, 'id' | 'file'>): PdfMergeEntry {
  const file = overrides.file;
  return {
    name: file.name,
    mimeType: file.type,
    size: file.size,
    kind: 'pdf',
    status: 'ready',
    original: { name: file.name, mimeType: file.type, size: file.size },
    compression: 'unchanged',
    encrypted: false,
    validation: Promise.resolve({ ok: true }),
    ...overrides
  };
}

interface ViewOverrides {
  readonly rotation?: PdfMergePageRotation;
  readonly sourceRotation?: number;
  readonly removed?: boolean;
}

function viewForEntryPage(entry: PdfMergeEntry, sourceIndex: number, overrides?: ViewOverrides): PdfMergePageView {
  return {
    id: makePdfMergePageId(entry.id, sourceIndex),
    entryId: entry.id,
    slotId: entry.slotId ?? null,
    groupKey: pdfMergePageGroupKeyForSlotId(entry.slotId),
    sourceName: entry.name,
    kind: entry.kind,
    sourceIndex,
    sourcePageCount: 1,
    meta: { sourceIndex, width: PAGE_WIDTH, height: PAGE_HEIGHT, sourceRotation: overrides?.sourceRotation ?? 0 },
    rotation: overrides?.rotation ?? 0,
    removed: overrides?.removed ?? false
  };
}

describe('readPdfMergeSidecar()', () => {
  it('returns null for a PDF that carries no manifest', async () => {
    const entry = readyPdfEntry({ id: 'a', file: await makeRealPdfFile('plain.pdf', 2) });
    const blob = await mergePdfMergeEntries([entry]);

    expect(await readPdfMergeSidecar(blob)).toBeNull();
  });

  it('returns null for bytes that are not a PDF at all', async () => {
    expect(await readPdfMergeSidecar(new Blob(['not a pdf']))).toBeNull();
  });

  it('records which pages came from which slot', async () => {
    const license = readyPdfEntry({ id: 'a', slotId: 'license', file: await makeRealPdfFile('license.pdf', 2) });
    const cert = readyPdfEntry({ id: 'b', slotId: 'cert', file: await makeRealPdfFile('cert.pdf', 1) });
    const blob = await mergePdfMergeEntries([license, cert], { sidecar: true });

    const result = await readPdfMergeSidecar(blob);

    expect(result).not.toBeNull();
    expect(result?.documents.map((x) => x.slotId)).toEqual(['license', 'cert']);
    expect(result?.documents[0].pages.map((x) => x.pageIndex)).toEqual([0, 1]);
    expect(result?.documents[1].pages.map((x) => x.pageIndex)).toEqual([2]);
    expect(result?.documents[0].pages.map((x) => x.sourceName)).toEqual(['license.pdf', 'license.pdf']);
    expect(result?.untaggedPageCount).toBe(0);
  });

  it('uses null rather than undefined for unslotted pages so the slot survives JSON round-tripping', async () => {
    const entry = readyPdfEntry({ id: 'a', file: await makeRealPdfFile('loose.pdf', 1) });
    const blob = await mergePdfMergeEntries([entry], { sidecar: true });

    const result = await readPdfMergeSidecar(blob);

    expect(result?.documents).toHaveLength(1);
    expect(result?.documents[0].slotId).toBeNull();
    expect(result?.sidecar.pages[0].slotId).toBeNull();
  });

  it('resolves pages by tag after the document is reordered, ignoring the now-stale recorded indices', async () => {
    const license = readyPdfEntry({ id: 'a', slotId: 'license', file: await makeRealPdfFile('license.pdf', 2) });
    const cert = readyPdfEntry({ id: 'b', slotId: 'cert', file: await makeRealPdfFile('cert.pdf', 1) });
    const blob = await mergePdfMergeEntries([license, cert], { sidecar: true });

    // Move the last page to the front, as a third-party tool might.
    const document = await PDFDocument.load(await blob.arrayBuffer());
    const [moved] = await document.copyPages(document, [2]);
    document.removePage(2);
    document.insertPage(0, moved);
    const reordered = await document.save();

    const result = await readPdfMergeSidecar(reordered);
    const certPage = result?.documents.find((x) => x.slotId === 'cert')?.pages[0];
    const licensePages = result?.documents.find((x) => x.slotId === 'license')?.pages;

    // The manifest still records cert at output index 2; the tag says it now lives at 0.
    expect(result?.sidecar.pages.find((x) => x.slotId === 'cert')?.outputIndex).toBe(2);
    expect(certPage?.pageIndex).toBe(0);
    expect(certPage?.resolvedByTag).toBe(true);
    expect(licensePages?.map((x) => x.pageIndex)).toEqual([1, 2]);
  });

  it('reports pages whose tag no longer resolves as missing', async () => {
    const entry = readyPdfEntry({ id: 'a', slotId: 'license', file: await makeRealPdfFile('license.pdf', 3) });
    const blob = await mergePdfMergeEntries([entry], { sidecar: true });

    const document = await PDFDocument.load(await blob.arrayBuffer());
    document.removePage(2);
    const trimmed = await document.save();

    const result = await readPdfMergeSidecar(trimmed);

    expect(result?.documents[0].pages.map((x) => x.tag)).toEqual([makePdfMergeSidecarPageTag('license', 0), makePdfMergeSidecarPageTag('license', 1)]);
    expect(result?.missingTags).toEqual([makePdfMergeSidecarPageTag('license', 2)]);
  });

  it('reads back rotation applied through the page plan', async () => {
    const entry = readyPdfEntry({ id: 'a', slotId: 'scan', file: await makeRealPdfFile('scan.pdf', 1) });
    const pages: PdfMergePageView[] = [viewForEntryPage(entry, 0, { rotation: 90 })];
    const blob = await mergePdfMergeEntries([entry], { pages, sidecar: true });

    const result = await readPdfMergeSidecar(blob);

    expect(result?.sidecar.pages[0].rotation).toBe(90);
  });
});

describe('splitPdfMergeSidecarDocuments()', () => {
  it('splits a merged file back into one file per slot', async () => {
    const license = readyPdfEntry({ id: 'a', slotId: 'license', file: await makeRealPdfFile('license.pdf', 2) });
    const cert = readyPdfEntry({ id: 'b', slotId: 'cert', file: await makeRealPdfFile('cert.pdf', 1) });
    const blob = await mergePdfMergeEntries([license, cert], { sidecar: true });

    const split = await splitPdfMergeSidecarDocuments(blob);

    expect(split?.documents.map((x) => x.slotId)).toEqual(['license', 'cert']);
    expect(split?.documents.map((x) => x.pageCount)).toEqual([2, 1]);
    // The original file names are restored from the manifest.
    expect(split?.documents.map((x) => x.file.name)).toEqual(['license.pdf', 'cert.pdf']);
  });

  it('returns null for a PDF with no manifest', async () => {
    const entry = readyPdfEntry({ id: 'a', file: await makeRealPdfFile('plain.pdf', 2) });

    expect(await splitPdfMergeSidecarDocuments(await mergePdfMergeEntries([entry]))).toBeNull();
  });

  it('preserves rotation that was applied before export', async () => {
    const entry = readyPdfEntry({ id: 'a', slotId: 'scan', file: await makeRealPdfFile('scan.pdf', 2) });
    const pages: PdfMergePageView[] = [viewForEntryPage(entry, 0, { rotation: 90 }), viewForEntryPage(entry, 1)];
    const blob = await mergePdfMergeEntries([entry], { pages, sidecar: true });

    const split = await splitPdfMergeSidecarDocuments(blob);
    const restored = await PDFDocument.load(await split!.documents[0].file.arrayBuffer());

    expect(restored.getPages().map((page) => page.getRotation().angle)).toEqual([90, 0]);
  });

  it('splits correctly even after the exported file has been reordered', async () => {
    const license = readyPdfEntry({ id: 'a', slotId: 'license', file: await makeRealPdfFile('license.pdf', 2) });
    const cert = readyPdfEntry({ id: 'b', slotId: 'cert', file: await makeRealPdfFile('cert.pdf', 1) });
    const blob = await mergePdfMergeEntries([license, cert], { sidecar: true });

    // Someone moves the cert page to the front outside the editor.
    const document = await PDFDocument.load(await blob.arrayBuffer());
    const [moved] = await document.copyPages(document, [2]);
    document.removePage(2);
    document.insertPage(0, moved);

    const split = await splitPdfMergeSidecarDocuments(await document.save());

    // Membership still resolves by tag, so each slot gets its own pages back regardless of position.
    expect(split?.documents.map((x) => x.slotId)).toEqual(['license', 'cert']);
    expect(split?.documents.map((x) => x.pageCount)).toEqual([2, 1]);
  });
});

describe('buildPdfMergeEntriesFromSidecar()', () => {
  it('round-trips an exported file back into slot-tagged entries', async () => {
    const license = readyPdfEntry({ id: 'a', slotId: 'license', file: await makeRealPdfFile('license.pdf', 3) });
    const cert = readyPdfEntry({ id: 'b', slotId: 'cert', file: await makeRealPdfFile('cert.pdf', 1) });
    const blob = await mergePdfMergeEntries([license, cert], { sidecar: true });

    const outcome = await buildPdfMergeEntriesFromSidecar(blob);

    expect('error' in outcome).toBe(false);
    const result = outcome as PdfMergeSidecarImportResult;
    expect(result.entries.map((entry) => entry.slotId)).toEqual(['license', 'cert']);
    expect(result.entries.map((entry) => entry.name)).toEqual(['license.pdf', 'cert.pdf']);
    expect(result.slotIds).toEqual(['license', 'cert']);
  });

  it('survives a full export → import → re-export cycle with membership intact', async () => {
    const license = readyPdfEntry({ id: 'a', slotId: 'license', file: await makeRealPdfFile('license.pdf', 2) });
    const cert = readyPdfEntry({ id: 'b', slotId: 'cert', file: await makeRealPdfFile('cert.pdf', 1) });
    const exported = await mergePdfMergeEntries([license, cert], { sidecar: true });

    const outcome = (await buildPdfMergeEntriesFromSidecar(exported)) as PdfMergeSidecarImportResult;
    const reExported = await mergePdfMergeEntries(
      outcome.entries.map((entry) => ({ ...entry, status: 'ready' as const })),
      { sidecar: true }
    );

    const result = await readPdfMergeSidecar(reExported);

    expect(result?.documents.map((x) => x.slotId)).toEqual(['license', 'cert']);
    expect(result?.documents[0].pages.map((x) => x.pageIndex)).toEqual([0, 1]);
    expect(result?.documents[1].pages.map((x) => x.pageIndex)).toEqual([2]);
  });

  it('reports no_sidecar for a readable PDF that was not exported from the editor', async () => {
    const entry = readyPdfEntry({ id: 'a', file: await makeRealPdfFile('plain.pdf', 1) });
    const blob = await mergePdfMergeEntries([entry]);

    expect(await buildPdfMergeEntriesFromSidecar(blob)).toEqual({ error: 'no_sidecar' });
  });

  it('reports unreadable for bytes that are not a PDF', async () => {
    expect(await buildPdfMergeEntriesFromSidecar(new Blob(['not a pdf']))).toEqual({ error: 'unreadable' });
  });
});

describe('page tags', () => {
  it('are absent on a document produced without the sidecar option', async () => {
    const entry: PdfMergeEntry = readyPdfEntry({ id: 'a', file: await makeRealPdfFile('plain.pdf', 2) });
    const blob = await mergePdfMergeEntries([entry]);

    const document = await PDFDocument.load(await blob.arrayBuffer());

    expect(document.getPages().map((page) => readPdfMergePageTag(page))).toEqual([null, null]);
    expect(document.getAttachments().some((x) => x.name === PDF_MERGE_SIDECAR_FILE_NAME)).toBe(false);
  });

  it('survive a save/load round trip with their rotation', async () => {
    const entry = readyPdfEntry({ id: 'a', slotId: 'doc', file: await makeRealPdfFile('doc.pdf', 2) });
    const pages: PdfMergePageView[] = [viewForEntryPage(entry, 1, { rotation: 180 }), viewForEntryPage(entry, 0)];
    const blob = await mergePdfMergeEntries([entry], { pages, sidecar: true });

    const document = await PDFDocument.load(await blob.arrayBuffer());

    expect(document.getPages().map((page) => readPdfMergePageTag(page))).toEqual([makePdfMergeSidecarPageTag('doc', 0), makePdfMergeSidecarPageTag('doc', 1)]);
    expect(document.getPages().map((page) => page.getRotation().angle)).toEqual([180, 0]);
  });

  it('compose the user rotation onto a page that is already rotated in the source', async () => {
    const entry = readyPdfEntry({ id: 'a', file: await makeRealPdfFile('sideways.pdf', 1, degrees(90)) });
    const pages: PdfMergePageView[] = [viewForEntryPage(entry, 0, { rotation: 90, sourceRotation: 90 })];
    const blob = await mergePdfMergeEntries([entry], { pages });

    const document = await PDFDocument.load(await blob.arrayBuffer());

    expect(document.getPages()[0].getRotation().angle).toBe(180);
  });
});
