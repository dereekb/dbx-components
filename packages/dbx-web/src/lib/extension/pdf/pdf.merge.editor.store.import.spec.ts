import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { PDFDocument } from '@cantoo/pdf-lib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { filter, firstValueFrom } from 'rxjs';
import { PDF_MIME_TYPE, type Maybe } from '@dereekb/util';
import { type PdfMergeEntry } from './pdf.merge';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';
import { DbxPdfMergeEditorStoreDirective, type DbxPdfMergeEditorSourceConfig } from './pdf.merge.editor.store.directive';
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

/** A readable PDF with no manifest — a document stored before sidecar was enabled. */
async function makeSidecarlessBlob(): Promise<Blob> {
  const entry = readyPdfEntry('legacy', await makeRealPdfFile('legacy.pdf', 2), null);
  return mergePdfMergeEntries([entry]);
}

/**
 * Waits for the directive's fire-and-forget import to reach a terminal state.
 *
 * The effect calls `importMergedPdf` synchronously during change detection, so the state is already `importing` by the time this subscribes — but the parse itself resolves over several ticks that `fixture.whenStable()` does not cover.
 */
function settledImport(store: DbxPdfMergeEditorStore) {
  return firstValueFrom(store.importState$.pipe(filter((state) => state != null && state.status !== 'importing')));
}

describe('DbxPdfMergeEditorStore.importMergedPdf()', () => {
  let store: DbxPdfMergeEditorStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DbxPdfMergeEditorStore] });
    store = TestBed.inject(DbxPdfMergeEditorStore);
  });

  it('has no import state before the first import', async () => {
    expect(await firstValueFrom(store.importState$)).toBeUndefined();
    expect(await firstValueFrom(store.isImporting$)).toBe(false);
  });

  it('imports a merged PDF and repopulates the store from its manifest', async () => {
    const state = await store.importMergedPdf({ source: await makeExportedBlob(['license', 'cert']) });

    expect(state.status).toBe('imported');
    expect(state.result?.fromSidecar).toBe(true);
    expect(state.result?.sidecar).not.toBeNull();
    expect(state.result?.slotIds).toEqual(['license', 'cert']);
    expect(await firstValueFrom(store.entryCount$)).toBe(2);
  });

  it('publishes the outcome on importState$ / importResult$', async () => {
    await store.importMergedPdf({ source: await makeExportedBlob(['license']) });

    expect((await firstValueFrom(store.importState$))?.status).toBe('imported');
    expect((await firstValueFrom(store.importResult$))?.slotIds).toEqual(['license']);
    expect(await firstValueFrom(store.importError$)).toBeNull();
    expect(await firstValueFrom(store.isImporting$)).toBe(false);
  });

  it('replaces entries already in the store', async () => {
    store.addFiles({ entries: [readyPdfEntry('old', await makeRealPdfFile('old.pdf', 1), 'license')] });

    await store.importMergedPdf({ source: await makeExportedBlob(['license', 'cert']) });

    const entries = await firstValueFrom(store.entries$);
    expect(entries.length).toBe(2);
    expect(entries.some((entry) => entry.id === 'old')).toBe(false);
  });

  it('does NOT check slots when expectedSlotIds is omitted, even though none are registered', async () => {
    const state = await store.importMergedPdf({ source: await makeExportedBlob(['license', 'cert']) });

    expect(state.status).toBe('imported');
    expect(state.result?.missingSlotIds).toEqual([]);
    expect(await firstValueFrom(store.entryCount$)).toBe(2);
  });

  it('rejects a file naming a section outside an explicit expectedSlotIds, leaving entries untouched', async () => {
    const state = await store.importMergedPdf({ source: await makeExportedBlob(['license', 'cert']), expectedSlotIds: ['license'] });

    expect(state.status).toBe('failed');
    expect(state.error).toBe('unexpected_slots');
    expect(state.unexpectedSlotIds).toEqual(['cert']);
    expect(await firstValueFrom(store.entryCount$)).toBe(0);
    expect(await firstValueFrom(store.importError$)).toBe('unexpected_slots');
  });

  it('treats an unsectioned document as unexpected when a check is active', async () => {
    const state = await store.importMergedPdf({ source: await makeExportedBlob(['license', null]), expectedSlotIds: ['license'] });

    expect(state.status).toBe('failed');
    expect(state.unexpectedSlotIds).toEqual([null]);
  });

  it('imports and reports sections the file did not fill', async () => {
    const state = await store.importMergedPdf({ source: await makeExportedBlob(['license']), expectedSlotIds: ['license', 'cert'] });

    expect(state.status).toBe('imported');
    expect(state.result?.missingSlotIds).toEqual(['cert']);
    expect(await firstValueFrom(store.entryCount$)).toBe(1);
  });

  it('fails a manifest-free PDF by default', async () => {
    const state = await store.importMergedPdf({ source: await makeSidecarlessBlob() });

    expect(state.status).toBe('failed');
    expect(state.error).toBe('no_sidecar');
    expect(await firstValueFrom(store.entryCount$)).toBe(0);
  });

  it('loads a manifest-free PDF as one unslotted entry when allowWithoutSidecar is set', async () => {
    const state = await store.importMergedPdf({ source: await makeSidecarlessBlob(), allowWithoutSidecar: true, fileName: 'legacy-doc.pdf' });

    expect(state.status).toBe('imported');
    expect(state.result?.fromSidecar).toBe(false);
    expect(state.result?.sidecar).toBeNull();
    expect(state.result?.slotIds).toEqual([null]);
    expect(state.result?.entries[0].name).toBe('legacy-doc.pdf');
    expect(await firstValueFrom(store.entryCount$)).toBe(1);
  });

  it('names the fallback entry from the source File when it is one', async () => {
    const blob = await makeSidecarlessBlob();
    const file = new File([blob], 'stored.pdf', { type: PDF_MIME_TYPE });
    const state = await store.importMergedPdf({ source: file, allowWithoutSidecar: true });

    expect(state.result?.entries[0].name).toBe('stored.pdf');
  });

  it('still fails an unreadable file even with allowWithoutSidecar', async () => {
    const state = await store.importMergedPdf({ source: new Blob(['not a pdf']), allowWithoutSidecar: true });

    expect(state.status).toBe('failed');
    expect(state.error).toBe('unreadable');
    expect(await firstValueFrom(store.entryCount$)).toBe(0);
  });
});

describe('DbxPdfMergeEditorStore.addFileToSlot()', () => {
  let store: DbxPdfMergeEditorStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DbxPdfMergeEditorStore] });
    store = TestBed.inject(DbxPdfMergeEditorStore);
  });

  it('adds a File to the named slot', async () => {
    const entry = await store.addFileToSlot({ file: await makeRealPdfFile('license.pdf', 1), slotId: 'license' });

    expect(entry?.slotId).toBe('license');
    expect(entry?.name).toBe('license.pdf');
    expect((await firstValueFrom(store.entriesForSlotId$('license'))).length).toBe(1);
  });

  it('adds a bare Blob under the given file name', async () => {
    const source = await makeRealPdfFile('ignored.pdf', 1);
    const blob = new Blob([await source.arrayBuffer()], { type: PDF_MIME_TYPE });
    const entry = await store.addFileToSlot({ file: blob, slotId: 'cert', fileName: 'certificate.pdf' });

    expect(entry?.name).toBe('certificate.pdf');
    expect(entry?.slotId).toBe('cert');
  });

  it('falls back to a MIME-derived name for a bare Blob with no fileName', async () => {
    const source = await makeRealPdfFile('ignored.pdf', 1);
    const blob = new Blob([await source.arrayBuffer()], { type: PDF_MIME_TYPE });
    const entry = await store.addFileToSlot({ file: blob, slotId: 'cert' });

    expect(entry?.name).toBe('document.pdf');
  });

  it('appends rather than replacing, unlike an import', async () => {
    await store.addFileToSlot({ file: await makeRealPdfFile('a.pdf', 1), slotId: 'license' });
    await store.addFileToSlot({ file: await makeRealPdfFile('b.pdf', 1), slotId: 'cert' });

    expect(await firstValueFrom(store.entryCount$)).toBe(2);
  });

  it('adds nothing and returns null for an unsupported file type', async () => {
    const entry = await store.addFileToSlot({ file: new Blob(['hello'], { type: 'text/plain' }), slotId: 'license', fileName: 'notes.txt' });

    expect(entry).toBeNull();
    expect(await firstValueFrom(store.entryCount$)).toBe(0);
  });

  it('accepts an entry for a slot that has not mounted yet', async () => {
    await store.addFileToSlot({ file: await makeRealPdfFile('early.pdf', 1), slotId: 'not-yet-rendered' });

    expect(await firstValueFrom(store.registeredSlotIds$)).toEqual([]);
    expect((await firstValueFrom(store.entriesForSlotId$('not-yet-rendered'))).length).toBe(1);
  });
});

@Component({
  template: `
    <div dbxPdfMergeEditorStore [source]="source()" [sourceConfig]="sourceConfig()"></div>
  `,
  imports: [DbxPdfMergeEditorStoreDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class SourceHostComponent {
  readonly source = signal<Maybe<Blob>>(undefined);
  readonly sourceConfig = signal<Maybe<DbxPdfMergeEditorSourceConfig>>(undefined);
  readonly storeDirective = viewChild.required(DbxPdfMergeEditorStoreDirective);
}

describe('DbxPdfMergeEditorStoreDirective [source]', () => {
  let fixture: ComponentFixture<SourceHostComponent>;
  let component: SourceHostComponent;
  let store: DbxPdfMergeEditorStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SourceHostComponent] }).compileComponents();

    fixture = TestBed.createComponent(SourceHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    store = component.storeDirective().store;
  });

  it('imports nothing while no source is bound', async () => {
    expect(await firstValueFrom(store.importState$)).toBeUndefined();
  });

  it('imports the bound blob', async () => {
    component.source.set(await makeExportedBlob(['license', 'cert']));
    fixture.detectChanges();

    expect((await settledImport(store))?.status).toBe('imported');
    expect(await firstValueFrom(store.entryCount$)).toBe(2);
  });

  it('does not re-import when the same blob instance is re-emitted', async () => {
    const spy = vi.spyOn(store, 'importMergedPdf');
    const blob = await makeExportedBlob(['license']);

    component.source.set(blob);
    fixture.detectChanges();
    await fixture.whenStable();

    component.source.set(blob);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not re-import when only sourceConfig changes', async () => {
    const spy = vi.spyOn(store, 'importMergedPdf');

    component.source.set(await makeExportedBlob(['license']));
    fixture.detectChanges();
    await fixture.whenStable();

    component.sourceConfig.set({ allowWithoutSidecar: true });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('re-imports when a different blob instance is bound', async () => {
    component.source.set(await makeExportedBlob(['license']));
    fixture.detectChanges();
    await settledImport(store);

    component.source.set(await makeExportedBlob(['license', 'cert']));
    fixture.detectChanges();
    await settledImport(store);

    expect(await firstValueFrom(store.entryCount$)).toBe(2);
  });

  it('forwards sourceConfig to the import, enabling the sidecar-less fallback', async () => {
    component.sourceConfig.set({ allowWithoutSidecar: true, fileName: 'legacy.pdf' });
    component.source.set(await makeSidecarlessBlob());
    fixture.detectChanges();

    const state = await settledImport(store);
    expect(state?.status).toBe('imported');
    expect(state?.result?.fromSidecar).toBe(false);
  });

  it('surfaces a failure on importState$ rather than throwing', async () => {
    component.source.set(new Blob(['not a pdf']));
    fixture.detectChanges();

    expect((await settledImport(store))?.status).toBe('failed');
    expect(await firstValueFrom(store.importError$)).toBe('unreadable');
  });
});
