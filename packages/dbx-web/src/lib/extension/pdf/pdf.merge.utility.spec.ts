import { PDFDocument, degrees, type Rotation } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PDF_MERGE_PAGE_GROUP_KEY, makePdfMergePageId, pdfMergePageGroupKeyForSlotId, type PdfMergeEntry, type PdfMergeEntryView, type PdfMergePageMeta, type PdfMergePageRotation, type PdfMergePageView } from './pdf.merge';
import { readPdfMergePageTag } from './pdf.merge.sidecar';
import { buildPdfMergeEntry, buildPdfMergeEntrySync, buildPdfMergePagePlan, classifyPdfMergeFile, formatPdfMergeEntrySize, mergePdfMergeEntries, readPdfMergeEntryPageMetas, validatePdfMergeEntry } from './pdf.merge.utility';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

function makeFile(name: string, type: string, contents = 'placeholder'): File {
  return new File([contents], name, { type });
}

function makePdfFile(name: string, body: string): File {
  return new File([`%PDF-1.4\n${body}\n%%EOF\n`], name, { type: 'application/pdf' });
}

/**
 * Builds a genuinely parseable PDF. {@link makePdfFile} satisfies the header/EOF scan but cannot be opened by pdf-lib, so anything that touches pages needs a real document.
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

async function loadMergedDocument(blob: Blob): Promise<PDFDocument> {
  return PDFDocument.load(await blob.arrayBuffer());
}

function readyEntry(overrides: Partial<PdfMergeEntry>): PdfMergeEntry {
  const file = overrides.file ?? new File(['placeholder'], 'a.pdf', { type: 'application/pdf' });
  return {
    id: 'id',
    file,
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

interface PlanPageOverrides {
  readonly rotation?: PdfMergePageRotation;
  readonly sourceRotation?: number;
  readonly removed?: boolean;
}

function planPage(entry: PdfMergeEntry, sourceIndex: number, overrides?: PlanPageOverrides): PdfMergePageView {
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

function viewEntry(overrides: Partial<PdfMergeEntryView> & Pick<PdfMergeEntryView, 'id' | 'name'>): PdfMergeEntryView {
  const file = new File(['placeholder'], overrides.name, { type: 'application/pdf' });
  return {
    file,
    mimeType: file.type,
    size: file.size,
    kind: 'pdf',
    status: 'ready',
    original: { name: overrides.name, mimeType: file.type, size: file.size },
    compression: 'unchanged',
    encrypted: false,
    ignored: false,
    validation: Promise.resolve({ ok: true }),
    ...overrides
  };
}

function metasFor(pageCount: number): PdfMergePageMeta[] {
  return Array.from({ length: pageCount }, (_, sourceIndex) => ({ sourceIndex, width: PAGE_WIDTH, height: PAGE_HEIGHT, sourceRotation: 0 }));
}

describe('classifyPdfMergeFile()', () => {
  it('classifies a PDF mime type as pdf', () => {
    expect(classifyPdfMergeFile(makeFile('a.pdf', 'application/pdf'))).toBe('pdf');
  });

  it('classifies PNG and JPEG mime types as image', () => {
    expect(classifyPdfMergeFile(makeFile('a.png', 'image/png'))).toBe('image');
    expect(classifyPdfMergeFile(makeFile('a.jpg', 'image/jpeg'))).toBe('image');
  });

  it('falls back to file extension when no mime type is provided', () => {
    expect(classifyPdfMergeFile(makeFile('doc.pdf', ''))).toBe('pdf');
    expect(classifyPdfMergeFile(makeFile('photo.png', ''))).toBe('image');
    expect(classifyPdfMergeFile(makeFile('photo.jpeg', ''))).toBe('image');
  });

  it('returns null for unsupported types', () => {
    expect(classifyPdfMergeFile(makeFile('doc.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toBeNull();
    expect(classifyPdfMergeFile(makeFile('archive.zip', 'application/zip'))).toBeNull();
  });
});

describe('buildPdfMergeEntrySync()', () => {
  it('builds a validating entry for a supported file', () => {
    let counter = 0;
    const entry = buildPdfMergeEntrySync(makeFile('a.pdf', 'application/pdf'), { idFactory: () => `id-${++counter}` });
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe('id-1');
    expect(entry!.kind).toBe('pdf');
    expect(entry!.status).toBe('validating');
    expect(entry!.name).toBe('a.pdf');
    expect(entry!.compression).toBe('unchanged');
    expect(entry!.encrypted).toBe(false);
    expect(entry!.original.name).toBe('a.pdf');
    expect(entry!.original.size).toBe(entry!.size);
  });

  it('returns null for an unsupported file', () => {
    expect(buildPdfMergeEntrySync(makeFile('archive.zip', 'application/zip'))).toBeNull();
  });
});

describe('buildPdfMergeEntry()', () => {
  it('returns the same entry shape as the sync builder when no compression config is provided', async () => {
    const entry = await buildPdfMergeEntry(makeFile('a.pdf', 'application/pdf'), { idFactory: () => 'id-1' });
    expect(entry).not.toBeNull();
    expect(entry!.kind).toBe('pdf');
    expect(entry!.compression).toBe('unchanged');
    expect(entry!.original.name).toBe('a.pdf');
    expect(entry!.original.size).toBe(entry!.size);
  });

  it('skips compression for PDFs even when imageCompression is configured', async () => {
    const entry = await buildPdfMergeEntry(makeFile('a.pdf', 'application/pdf'), { imageCompression: { maxDimension: 256 } });
    expect(entry).not.toBeNull();
    expect(entry!.compression).toBe('unchanged');
  });

  it('returns null for an unsupported file', async () => {
    expect(await buildPdfMergeEntry(makeFile('archive.zip', 'application/zip'))).toBeNull();
  });
});

describe('formatPdfMergeEntrySize()', () => {
  it('formats bytes', () => {
    expect(formatPdfMergeEntrySize(900)).toBe('900 B');
  });

  it('formats kilobytes', () => {
    expect(formatPdfMergeEntrySize(2048)).toBe('2.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatPdfMergeEntrySize(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});

describe('validatePdfMergeEntry()', () => {
  type ValidatableEntry = Omit<PdfMergeEntry, 'validation'>;

  function pdfEntry(file: File): ValidatableEntry {
    return {
      id: 'id',
      file,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      kind: 'pdf',
      status: 'validating',
      original: { name: file.name, mimeType: file.type, size: file.size },
      compression: 'unchanged',
      encrypted: false
    };
  }

  function imageEntry(file: File): ValidatableEntry {
    return {
      id: 'id',
      file,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      kind: 'image',
      status: 'validating',
      original: { name: file.name, mimeType: file.type, size: file.size },
      compression: 'unchanged',
      encrypted: false
    };
  }

  it('marks a valid PDF as ready', async () => {
    const result = await validatePdfMergeEntry(pdfEntry(makePdfFile('valid.pdf', 'body')));
    expect(result.ok).toBe(true);
  });

  it('marks a corrupt PDF (no header) as error', async () => {
    const result = await validatePdfMergeEntry(pdfEntry(makeFile('corrupt.pdf', 'application/pdf', 'not a pdf')));
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain('valid PDF');
  });

  it('marks an encrypted PDF as ready with encrypted=true', async () => {
    const result = await validatePdfMergeEntry(pdfEntry(makePdfFile('locked.pdf', '/Encrypt 1 0 R')));
    expect(result.ok).toBe(true);
    expect(result.encrypted).toBe(true);
    expect(result.errorMessage).toBeUndefined();
  });

  it('does not flag a non-encrypted PDF as encrypted', async () => {
    const result = await validatePdfMergeEntry(pdfEntry(makePdfFile('plain.pdf', 'body')));
    expect(result.ok).toBe(true);
    expect(result.encrypted).toBeUndefined();
  });

  it('marks an empty image as error', async () => {
    const result = await validatePdfMergeEntry(imageEntry(new File([], 'empty.png', { type: 'image/png' })));
    expect(result.ok).toBe(false);
  });

  it('marks a non-empty image as ready', async () => {
    const result = await validatePdfMergeEntry(imageEntry(makeFile('a.png', 'image/png', 'imgdata')));
    expect(result.ok).toBe(true);
  });
});

describe('mergePdfMergeEntries()', () => {
  it('throws when no ready entries are provided', async () => {
    await expect(mergePdfMergeEntries([])).rejects.toThrow('No ready entries');
  });

  it('returns the original file bytes when the only ready entry is a single encrypted PDF', async () => {
    const file = new File(['ENCRYPTED-BYTES'], 'locked.pdf', { type: 'application/pdf' });
    const entry = readyEntry({ file, encrypted: true });
    const blob = await mergePdfMergeEntries([entry]);
    const text = await blob.text();

    expect(blob.type).toBe('application/pdf');
    expect(text).toBe('ENCRYPTED-BYTES');
    expect(blob.size).toBe(file.size);
  });

  it('throws when an encrypted entry is mixed with other ready entries', async () => {
    const encrypted = readyEntry({ file: new File(['x'], 'enc.pdf', { type: 'application/pdf' }), encrypted: true });
    const plain = readyEntry({ id: 'other', file: new File(['y'], 'plain.pdf', { type: 'application/pdf' }) });
    await expect(mergePdfMergeEntries([encrypted, plain])).rejects.toThrow('Encrypted PDFs cannot be merged with other files.');
  });

  it('emits every page of every entry, in entry order, when given no options', async () => {
    const first = readyEntry({ id: 'a', file: await makeRealPdfFile('a.pdf', 2) });
    const second = readyEntry({ id: 'b', file: await makeRealPdfFile('b.pdf', 1) });

    const document = await loadMergedDocument(await mergePdfMergeEntries([first, second]));

    expect(document.getPageCount()).toBe(3);
  });

  it('produces identical output whether options are omitted or empty', async () => {
    const entry = readyEntry({ id: 'a', file: await makeRealPdfFile('a.pdf', 2) });

    const [withoutOptions, withEmptyOptions] = await Promise.all([mergePdfMergeEntries([entry]), mergePdfMergeEntries([entry], {})]);

    expect(withEmptyOptions.size).toBe(withoutOptions.size);
  });

  it('writes no attachment or page tags when the sidecar is not requested', async () => {
    const entry = readyEntry({ id: 'a', slotId: 'license', file: await makeRealPdfFile('a.pdf', 2) });

    const document = await loadMergedDocument(await mergePdfMergeEntries([entry], { sidecar: false }));

    expect(document.getAttachments()).toHaveLength(0);
    expect(document.getPages().map((page) => readPdfMergePageTag(page))).toEqual([null, null]);
  });
});

describe('mergePdfMergeEntries() with a page plan', () => {
  it('emits only the planned pages, in plan order', async () => {
    const entry = readyEntry({ id: 'a', file: await makeRealPdfFile('a.pdf', 3) });
    const pages = [planPage(entry, 2), planPage(entry, 0)];

    const document = await loadMergedDocument(await mergePdfMergeEntries([entry], { pages }));

    expect(document.getPageCount()).toBe(2);
  });

  it('excludes pages marked for removal', async () => {
    const entry = readyEntry({ id: 'a', file: await makeRealPdfFile('a.pdf', 3) });
    const pages = [planPage(entry, 0), planPage(entry, 1, { removed: true }), planPage(entry, 2)];

    const document = await loadMergedDocument(await mergePdfMergeEntries([entry], { pages }));

    expect(document.getPageCount()).toBe(2);
  });

  it('throws when the plan leaves no pages at all', async () => {
    const entry = readyEntry({ id: 'a', file: await makeRealPdfFile('a.pdf', 2) });
    const pages = [planPage(entry, 0, { removed: true }), planPage(entry, 1, { removed: true })];

    await expect(mergePdfMergeEntries([entry], { pages })).rejects.toThrow('No pages to merge.');
  });

  it('interleaves pages from two entries', async () => {
    const first = readyEntry({ id: 'a', file: await makeRealPdfFile('a.pdf', 2) });
    const second = readyEntry({ id: 'b', file: await makeRealPdfFile('b.pdf', 2) });
    const pages = [planPage(first, 0), planPage(second, 1), planPage(first, 1), planPage(second, 0)];

    const document = await loadMergedDocument(await mergePdfMergeEntries([first, second], { pages }));

    expect(document.getPageCount()).toBe(4);
  });

  it('applies rotation composed onto the page source rotation', async () => {
    const entry = readyEntry({ id: 'a', file: await makeRealPdfFile('a.pdf', 2, degrees(270)) });
    const pages = [planPage(entry, 0, { rotation: 90, sourceRotation: 270 }), planPage(entry, 1, { rotation: 0, sourceRotation: 270 })];

    const document = await loadMergedDocument(await mergePdfMergeEntries([entry], { pages }));

    // 270 + 90 wraps to 0; the untouched page keeps the source's 270.
    expect(document.getPages().map((page) => page.getRotation().angle)).toEqual([0, 270]);
  });

  it('ignores planned pages whose entry is no longer present', async () => {
    const present = readyEntry({ id: 'a', file: await makeRealPdfFile('a.pdf', 1) });
    const departed = readyEntry({ id: 'gone', file: await makeRealPdfFile('gone.pdf', 1) });
    const pages = [planPage(departed, 0), planPage(present, 0)];

    const document = await loadMergedDocument(await mergePdfMergeEntries([present], { pages }));

    expect(document.getPageCount()).toBe(1);
  });
});

describe('readPdfMergeEntryPageMetas()', () => {
  it('reads one meta per page with its size and rotation', async () => {
    const entry = readyEntry({ id: 'a', file: await makeRealPdfFile('a.pdf', 3, degrees(90)) });

    const metas = await readPdfMergeEntryPageMetas(entry);

    expect(metas).toHaveLength(3);
    expect(metas?.map((meta) => meta.sourceIndex)).toEqual([0, 1, 2]);
    expect(metas?.[0].sourceRotation).toBe(90);
    expect(metas?.[0].width).toBeGreaterThan(0);
  });

  it('returns null for an encrypted entry, which pdf-lib cannot open', async () => {
    const entry = readyEntry({ id: 'a', encrypted: true, file: await makeRealPdfFile('a.pdf', 2) });

    expect(await readPdfMergeEntryPageMetas(entry)).toBeNull();
  });

  it('returns null for a PDF that cannot be parsed', async () => {
    const entry = readyEntry({ id: 'a', file: makePdfFile('fake.pdf', 'body') });

    expect(await readPdfMergeEntryPageMetas(entry)).toBeNull();
  });

  it('reports a single synthetic page for an image entry', async () => {
    const entry = readyEntry({ id: 'a', kind: 'image', file: makeFile('a.png', 'image/png', 'imgdata') });

    const metas = await readPdfMergeEntryPageMetas(entry);

    expect(metas).toHaveLength(1);
    expect(metas?.[0].sourceIndex).toBe(0);
  });
});

describe('buildPdfMergePagePlan()', () => {
  const licenseEntry = viewEntry({ id: 'a', slotId: 'license', name: 'license.pdf' });
  const certEntry = viewEntry({ id: 'b', slotId: 'cert', name: 'cert.pdf' });
  const pageMetas = { a: metasFor(2), b: metasFor(1) };

  it('expands each entry into its pages, grouped by slot in entry order', () => {
    const plan = buildPdfMergePagePlan({ entries: [licenseEntry, certEntry], pageMetas, pageOverrides: {}, pageOrder: {} });

    expect(plan.map((page) => page.id)).toEqual(['a:0', 'a:1', 'b:0']);
    expect(plan.map((page) => page.groupKey)).toEqual(['license', 'license', 'cert']);
    expect(plan[0].sourcePageCount).toBe(2);
  });

  it('applies a stored order within a group', () => {
    const plan = buildPdfMergePagePlan({ entries: [licenseEntry, certEntry], pageMetas, pageOverrides: {}, pageOrder: { license: ['a:1', 'a:0'] } });

    expect(plan.map((page) => page.id)).toEqual(['a:1', 'a:0', 'b:0']);
  });

  it('ignores stored order ids that no longer resolve and appends unknown pages in natural order', () => {
    const plan = buildPdfMergePagePlan({ entries: [licenseEntry], pageMetas, pageOverrides: {}, pageOrder: { license: ['gone:4', 'a:1'] } });

    expect(plan.map((page) => page.id)).toEqual(['a:1', 'a:0']);
  });

  it('applies rotation and removal overrides', () => {
    const plan = buildPdfMergePagePlan({ entries: [licenseEntry], pageMetas, pageOverrides: { 'a:0': { rotation: 180, removed: true } }, pageOrder: {} });

    expect(plan[0].rotation).toBe(180);
    expect(plan[0].removed).toBe(true);
    expect(plan[1].rotation).toBe(0);
    expect(plan[1].removed).toBe(false);
  });

  it('omits entries whose pages could not be read', () => {
    const plan = buildPdfMergePagePlan({ entries: [licenseEntry, certEntry], pageMetas: { a: metasFor(2), b: null }, pageOverrides: {}, pageOrder: {} });

    expect(plan.map((page) => page.entryId)).toEqual(['a', 'a']);
  });

  it('omits entries that are not ready or are ignored', () => {
    const validating = viewEntry({ id: 'c', slotId: 'x', name: 'c.pdf', status: 'validating' });
    const ignored = viewEntry({ id: 'd', slotId: 'y', name: 'd.pdf', ignored: true });
    const metas = { ...pageMetas, c: metasFor(1), d: metasFor(1) };

    const plan = buildPdfMergePagePlan({ entries: [licenseEntry, validating, ignored], pageMetas: metas, pageOverrides: {}, pageOrder: {} });

    expect(plan.map((page) => page.entryId)).toEqual(['a', 'a']);
  });

  it('groups unslotted entries together under the default group key', () => {
    const loose = viewEntry({ id: 'e', name: 'e.pdf' });
    const plan = buildPdfMergePagePlan({ entries: [loose], pageMetas: { e: metasFor(1) }, pageOverrides: {}, pageOrder: {} });

    expect(plan[0].groupKey).toBe(DEFAULT_PDF_MERGE_PAGE_GROUP_KEY);
    expect(plan[0].slotId).toBeNull();
  });
});
