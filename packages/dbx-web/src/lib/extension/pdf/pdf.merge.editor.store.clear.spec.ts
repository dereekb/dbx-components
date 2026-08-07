import { TestBed } from '@angular/core/testing';
import { PDFDocument } from '@cantoo/pdf-lib';
import { beforeEach, describe, expect, it } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { PDF_MIME_TYPE, type Maybe } from '@dereekb/util';
import { type PdfMergeEntry } from './pdf.merge';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';
import { mergePdfMergeEntries } from './pdf.merge.utility';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

async function makeRealPdfFile(name: string, pageCount: number): Promise<File> {
  const document = await PDFDocument.create();

  for (let i = 0; i < pageCount; i += 1) {
    document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }

  const bytes = await document.save();
  return new File([bytes as BlobPart], name, { type: PDF_MIME_TYPE });
}

function readyPdfEntry(id: string, file: File, slotId: Maybe<string>): PdfMergeEntry {
  return {
    id,
    file,
    slotId,
    name: file.name,
    mimeType: file.type,
    size: file.size,
    kind: 'pdf',
    status: 'ready',
    original: { name: file.name, mimeType: file.type, size: file.size },
    compression: 'unchanged',
    encrypted: false,
    validation: Promise.resolve({ ok: true })
  };
}

/** A merged PDF carrying an embedded manifest — what the editor's download produces. */
async function makeExportedBlob(slotIds: readonly Maybe<string>[]): Promise<Blob> {
  const entries = await Promise.all(slotIds.map(async (slotId, i) => readyPdfEntry(`e${i}`, await makeRealPdfFile(`${slotId ?? 'loose'}.pdf`, 1), slotId)));
  return mergePdfMergeEntries(entries, { sidecar: true });
}

describe('DbxPdfMergeEditorStore.clearEntries()', () => {
  let store: DbxPdfMergeEditorStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DbxPdfMergeEditorStore] });
    store = TestBed.inject(DbxPdfMergeEditorStore);
  });

  it('empties the store and reports no restore when nothing was ever imported', async () => {
    store.addFiles({ entries: [readyPdfEntry('a', await makeRealPdfFile('a.pdf', 1), 'license')] });

    const result = await store.clearEntries();

    expect(result.restored).toBe(false);
    expect(store.hasRestorableImport()).toBe(false);
    expect(await firstValueFrom(store.entryCount$)).toBe(0);
  });

  describe('after a user import (the picker)', () => {
    beforeEach(async () => {
      await store.importMergedPdf({ source: await makeExportedBlob(['license', 'cert']), origin: 'user' });
    });

    it('does not treat the picked file as a restore point', () => {
      expect(store.hasRestorableImport()).toBe(false);
    });

    it('discards the entries AND the import state, so no notice outlives the content', async () => {
      expect((await firstValueFrom(store.importState$))?.status).toBe('imported');

      const result = await store.clearEntries();

      expect(result.restored).toBe(false);
      expect(await firstValueFrom(store.entryCount$)).toBe(0);
      expect(await firstValueFrom(store.importState$)).toBeUndefined();
      expect(await firstValueFrom(store.importResult$)).toBeNull();
    });
  });

  describe('after a programmatic import (the app-supplied baseline)', () => {
    beforeEach(async () => {
      await store.importMergedPdf({ source: await makeExportedBlob(['license', 'cert']) });
    });

    it('records the import as the restore point', () => {
      expect(store.hasRestorableImport()).toBe(true);
    });

    it('resets to the imported document rather than emptying', async () => {
      store.addFiles({ entries: [readyPdfEntry('extra', await makeRealPdfFile('extra.pdf', 1), 'license')] });
      expect(await firstValueFrom(store.entryCount$)).toBe(3);

      const result = await store.clearEntries();

      expect(result.restored).toBe(true);
      expect(result.importState?.status).toBe('imported');
      // Back to exactly the two sections the document arrived with.
      expect(await firstValueFrom(store.entryCount$)).toBe(2);
      expect((await firstValueFrom(store.importResult$))?.slotIds).toEqual(['license', 'cert']);
    });

    it('restores a section the user cleared out entirely', async () => {
      store.removeEntriesBySlotId('cert');
      expect(await firstValueFrom(store.entryCount$)).toBe(1);

      await store.clearEntries();

      expect(await firstValueFrom(store.entryCount$)).toBe(2);
    });

    it('empties instead when restoreImport is false', async () => {
      const result = await store.clearEntries({ restoreImport: false });

      expect(result.restored).toBe(false);
      expect(await firstValueFrom(store.entryCount$)).toBe(0);
      expect(await firstValueFrom(store.importState$)).toBeUndefined();
    });

    it("keeps the baseline when a user's pick replaces it, and returns to it on clear", async () => {
      await store.importMergedPdf({ source: await makeExportedBlob(['license']), origin: 'user' });
      expect(await firstValueFrom(store.entryCount$)).toBe(1);

      const result = await store.clearEntries();

      expect(result.restored).toBe(true);
      expect(await firstValueFrom(store.entryCount$)).toBe(2);
    });
  });

  it('does not record a failed programmatic import as a restore point', async () => {
    const state = await store.importMergedPdf({ source: new Blob(['not a pdf']) });

    expect(state.status).toBe('failed');
    expect(store.hasRestorableImport()).toBe(false);
  });
});
