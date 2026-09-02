import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PDFDocument } from '@cantoo/pdf-lib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { filter, firstValueFrom } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { DEFAULT_PDF_MERGE_PAGE_GROUP_KEY, type DbxPdfMergeEditorConfig, type PdfMergeEntry } from './pdf.merge';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';
import { DbxPdfMergeEditorStoreDirective } from './pdf.merge.editor.store.directive';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

async function makeRealPdfFile(name: string, pageCount: number): Promise<File> {
  const document = await PDFDocument.create();

  for (let i = 0; i < pageCount; i += 1) {
    document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }

  const bytes = await document.save();
  return new File([bytes as BlobPart], name, { type: 'application/pdf' });
}

/**
 * Waits for a populated page plan.
 *
 * `pages$` replays its last value, so a subscriber that arrives right after page editing is re-enabled would otherwise observe the stale pre-hydration value — re-hydration resolves on a microtask.
 */
function hydratedPages(store: DbxPdfMergeEditorStore) {
  return firstValueFrom(store.pages$.pipe(filter((pages) => pages != null && pages.length > 0)));
}

function readyEntry(id: string, file: File, slotId?: Maybe<string>): PdfMergeEntry {
  return {
    id,
    file,
    name: file.name,
    mimeType: file.type,
    size: file.size,
    kind: 'pdf',
    status: 'ready',
    slotId,
    original: { name: file.name, mimeType: file.type, size: file.size },
    compression: 'unchanged',
    encrypted: false,
    validation: Promise.resolve({ ok: true })
  };
}

describe('DbxPdfMergeEditorStore page editing', () => {
  let store: DbxPdfMergeEditorStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DbxPdfMergeEditorStore] });
    store = TestBed.inject(DbxPdfMergeEditorStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('while page editing is disabled (the default)', () => {
    it('emits a null page plan', async () => {
      store.addFiles({ entries: [readyEntry('a', await makeRealPdfFile('a.pdf', 3))] });

      expect(await firstValueFrom(store.pages$)).toBeNull();
    });

    it('never parses a source document', async () => {
      const load = vi.spyOn(PDFDocument, 'load');
      store.addFiles({ entries: [readyEntry('a', await makeRealPdfFile('a.pdf', 3))] });

      expect(await firstValueFrom(store.pageMetas$)).toEqual({});
      expect(load).not.toHaveBeenCalled();
    });

    it('reports pages as mergeable so it never gates the default path', async () => {
      expect(await firstValueFrom(store.hasMergeablePages$)).toBe(true);
    });

    it('reports no unexpandable entries', async () => {
      store.addFiles({ entries: [readyEntry('a', await makeRealPdfFile('a.pdf', 1))] });

      expect(await firstValueFrom(store.unexpandableEntries$)).toEqual([]);
    });
  });

  describe('while page editing is enabled', () => {
    beforeEach(() => {
      store.setPageEditing(true);
    });

    it('expands each entry into its pages', async () => {
      store.addFiles({ entries: [readyEntry('a', await makeRealPdfFile('a.pdf', 3))] });

      const pages = await firstValueFrom(store.pages$);

      expect(pages?.map((page) => page.id)).toEqual(['a:0', 'a:1', 'a:2']);
      expect(pages?.[0].groupKey).toBe(DEFAULT_PDF_MERGE_PAGE_GROUP_KEY);
    });

    it('groups pages by slot', async () => {
      store.addFiles({
        entries: [readyEntry('a', await makeRealPdfFile('a.pdf', 2), 'license'), readyEntry('b', await makeRealPdfFile('b.pdf', 1), 'cert')]
      });

      const groups = await firstValueFrom(store.pageGroups$);

      expect(groups.map((group) => group.groupKey)).toEqual(['license', 'cert']);
      expect(groups[0].pages.map((page) => page.id)).toEqual(['a:0', 'a:1']);
      expect(groups[1].pages.map((page) => page.id)).toEqual(['b:0']);
    });

    it('parses each entry only once even as state changes', async () => {
      const load = vi.spyOn(PDFDocument, 'load');
      store.addFiles({ entries: [readyEntry('a', await makeRealPdfFile('a.pdf', 2))] });

      await firstValueFrom(store.pages$);
      store.setPageRotation({ pageId: 'a:0', rotation: 90 });
      await firstValueFrom(store.pages$);

      expect(load).toHaveBeenCalledTimes(1);
    });

    it('reorders pages within a group without disturbing another group', async () => {
      store.addFiles({
        entries: [readyEntry('a', await makeRealPdfFile('a.pdf', 2), 'license'), readyEntry('b', await makeRealPdfFile('b.pdf', 2), 'cert')]
      });
      await firstValueFrom(store.pages$);

      store.movePageWithinGroup({ groupKey: 'license', pageIds: ['a:0', 'a:1'], previousIndex: 0, currentIndex: 1 });

      const groups = await firstValueFrom(store.pageGroups$);

      expect(groups[0].pages.map((page) => page.id)).toEqual(['a:1', 'a:0']);
      expect(groups[1].pages.map((page) => page.id)).toEqual(['b:0', 'b:1']);
    });

    it('ignores a move whose indices are out of range', async () => {
      store.addFiles({ entries: [readyEntry('a', await makeRealPdfFile('a.pdf', 2))] });
      await firstValueFrom(store.pages$);

      store.movePageWithinGroup({ groupKey: DEFAULT_PDF_MERGE_PAGE_GROUP_KEY, pageIds: ['a:0', 'a:1'], previousIndex: 0, currentIndex: 5 });

      expect((await firstValueFrom(store.pages$))?.map((page) => page.id)).toEqual(['a:0', 'a:1']);
    });

    it('records rotation and removal independently per page', async () => {
      store.addFiles({ entries: [readyEntry('a', await makeRealPdfFile('a.pdf', 2))] });
      await firstValueFrom(store.pages$);

      store.setPageRotation({ pageId: 'a:0', rotation: 270 });
      store.setPageRemoved({ pageId: 'a:1', removed: true });

      const pages = await firstValueFrom(store.pages$);

      expect(pages?.[0]).toMatchObject({ rotation: 270, removed: false });
      expect(pages?.[1]).toMatchObject({ rotation: 0, removed: true });
    });

    it('preserves rotation when a page is later marked for removal', async () => {
      store.addFiles({ entries: [readyEntry('a', await makeRealPdfFile('a.pdf', 1))] });
      await firstValueFrom(store.pages$);

      store.setPageRotation({ pageId: 'a:0', rotation: 90 });
      store.setPageRemoved({ pageId: 'a:0', removed: true });

      expect((await firstValueFrom(store.pages$))?.[0]).toMatchObject({ rotation: 90, removed: true });
    });

    it('blocks the merge once every page is marked for removal', async () => {
      store.addFiles({ entries: [readyEntry('a', await makeRealPdfFile('a.pdf', 2))] });
      await firstValueFrom(store.pages$);

      store.setPageRemoved({ pageId: 'a:0', removed: true });
      expect(await firstValueFrom(store.hasMergeablePages$)).toBe(true);

      store.setPageRemoved({ pageId: 'a:1', removed: true });
      expect(await firstValueFrom(store.hasMergeablePages$)).toBe(false);
      expect(await firstValueFrom(store.isValid$)).toBe(false);
    });

    it('counts only the pages that will reach the output', async () => {
      store.addFiles({ entries: [readyEntry('a', await makeRealPdfFile('a.pdf', 3))] });
      await firstValueFrom(store.pages$);

      store.setPageRemoved({ pageId: 'a:1', removed: true });

      expect(await firstValueFrom(store.mergeablePageCount$)).toBe(2);
    });

    it('surfaces an encrypted entry as unexpandable rather than dropping it silently', async () => {
      const entry = { ...readyEntry('a', await makeRealPdfFile('a.pdf', 2)), encrypted: true };
      store.addFiles({ entries: [entry] });

      expect(await firstValueFrom(store.pages$)).toEqual([]);
      expect((await firstValueFrom(store.unexpandableEntries$)).map((x) => x.id)).toEqual(['a']);
    });

    it('keeps an encrypted entry mergeable even though it contributes no pages', async () => {
      store.addFiles({ entries: [{ ...readyEntry('a', await makeRealPdfFile('a.pdf', 2)), encrypted: true }] });

      expect(await firstValueFrom(store.encryptedPassthrough$)).toBe(true);
      expect(await firstValueFrom(store.hasMergeablePages$)).toBe(true);
      expect(await firstValueFrom(store.isValid$)).toBe(true);
    });

    it('passes the encrypted file through as the merge output', async () => {
      const file = await makeRealPdfFile('a.pdf', 2);
      store.addFiles({ entries: [{ ...readyEntry('a', file), encrypted: true }] });

      expect((await firstValueFrom(store.mergeOutput$)).size).toBe(file.size);
    });

    it('passes the encrypted file through when other entries are ignored around it', async () => {
      const file = await makeRealPdfFile('a.pdf', 2);
      store.addFiles({ entries: [{ ...readyEntry('a', file), encrypted: true }, readyEntry('b', await makeRealPdfFile('b.pdf', 1))] });

      expect(await firstValueFrom(store.encryptedPassthrough$)).toBe(true);
      expect((await firstValueFrom(store.mergeOutput$)).size).toBe(file.size);
    });

    it('lists an ignored entry as unexpandable so it does not vanish from the page list', async () => {
      store.addFiles({ entries: [{ ...readyEntry('a', await makeRealPdfFile('a.pdf', 2)), encrypted: true }, readyEntry('b', await makeRealPdfFile('b.pdf', 1))] });

      expect((await firstValueFrom(store.unexpandableEntries$)).map((x) => x.id)).toEqual(['a', 'b']);
    });

    it('reports no passthrough for an ordinary entry', async () => {
      store.addFiles({ entries: [readyEntry('a', await makeRealPdfFile('a.pdf', 2))] });

      expect(await firstValueFrom(store.encryptedPassthrough$)).toBe(false);
    });

    it('drops page state belonging to a removed entry', async () => {
      store.addFiles({ entries: [readyEntry('a', await makeRealPdfFile('a.pdf', 2)), readyEntry('b', await makeRealPdfFile('b.pdf', 1))] });
      await firstValueFrom(store.pages$);
      store.setPageRemoved({ pageId: 'a:0', removed: true });

      store.removeEntry('a');

      expect((await firstValueFrom(store.pages$))?.map((page) => page.id)).toEqual(['b:0']);
    });

    it('does not resurrect a stale override when an entry id is reused', async () => {
      store.addFiles({ entries: [readyEntry('a', await makeRealPdfFile('a.pdf', 2))] });
      await firstValueFrom(store.pages$);
      store.setPageRemoved({ pageId: 'a:0', removed: true });

      store.removeEntry('a');
      store.addFiles({ entries: [readyEntry('a', await makeRealPdfFile('a.pdf', 2))] });

      const pages = await hydratedPages(store);

      expect(pages?.map((page) => page.removed)).toEqual([false, false]);
    });

    it('keeps page edits when editing is toggled off and back on', async () => {
      store.addFiles({ entries: [readyEntry('a', await makeRealPdfFile('a.pdf', 2))] });
      await firstValueFrom(store.pages$);
      store.setPageRotation({ pageId: 'a:0', rotation: 180 });

      store.setPageEditing(false);
      expect(await firstValueFrom(store.pages$)).toBeNull();

      store.setPageEditing(true);
      expect((await hydratedPages(store))?.[0].rotation).toBe(180);
    });

    it('discards every page edit on clearPageEdits', async () => {
      store.addFiles({ entries: [readyEntry('a', await makeRealPdfFile('a.pdf', 2))] });
      await firstValueFrom(store.pages$);
      store.setPageRotation({ pageId: 'a:0', rotation: 90 });
      store.movePageWithinGroup({ groupKey: DEFAULT_PDF_MERGE_PAGE_GROUP_KEY, pageIds: ['a:0', 'a:1'], previousIndex: 0, currentIndex: 1 });

      store.clearPageEdits();

      const pages = await firstValueFrom(store.pages$);

      expect(pages?.map((page) => page.id)).toEqual(['a:0', 'a:1']);
      expect(pages?.[0].rotation).toBe(0);
    });
  });
});

@Component({
  selector: 'dbx-test-pdf-merge-store-config',
  template: `
    <div dbxPdfMergeEditorStore [config]="config()"></div>
  `,
  imports: [DbxPdfMergeEditorStoreDirective]
})
class TestHostComponent {
  readonly config = signal<Maybe<DbxPdfMergeEditorConfig>>(undefined);
  readonly directive = viewChild.required(DbxPdfMergeEditorStoreDirective);
}

describe('DbxPdfMergeEditorStoreDirective page editing config', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<TestHostComponent>>;
  let component: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('leaves both settings unset when no config is bound', async () => {
    const store = component.directive().store;

    expect(await firstValueFrom(store.pageEditingSetting$)).toBeUndefined();
    expect(await firstValueFrom(store.sidecarSetting$)).toBeUndefined();
    expect(await firstValueFrom(store.pageEditing$)).toBe(false);
    expect(await firstValueFrom(store.sidecar$)).toBe(false);
  });

  it('pushes pageEditing and sidecar from the bound config onto the store', async () => {
    component.config.set({ pageEditing: true, sidecar: true });
    fixture.detectChanges();

    const store = component.directive().store;

    expect(await firstValueFrom(store.pageEditing$)).toBe(true);
    expect(await firstValueFrom(store.sidecar$)).toBe(true);
  });

  it('gates the two settings independently', async () => {
    component.config.set({ sidecar: true });
    fixture.detectChanges();

    const store = component.directive().store;

    expect(await firstValueFrom(store.pageEditing$)).toBe(false);
    expect(await firstValueFrom(store.sidecar$)).toBe(true);
  });
});
