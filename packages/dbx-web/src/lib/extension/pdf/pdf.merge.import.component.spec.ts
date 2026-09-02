import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { PDFDocument } from '@cantoo/pdf-lib';
import { beforeEach, describe, expect, it } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { type FileArrayAcceptMatchResult } from '../../interaction/upload/upload.accept';
import { type DbxFileUploadFilesChangedEvent } from '../../interaction/upload/abstract.upload.component';
import { provideDbxPdfMergeEditorPreserveEntriesOnSlotDestroy, type PdfMergeEntry } from './pdf.merge';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';
import { DbxPdfMergeEditorStoreDirective } from './pdf.merge.editor.store.directive';
import { DbxPdfMergeEditorFileUploadComponent } from './pdf.merge.editor.file.upload.component';
import { DbxPdfMergeImportComponent } from './pdf.merge.import.component';
import { mergePdfMergeEntries } from './pdf.merge.utility';

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

/**
 * Builds a merged PDF carrying an embedded manifest, the way the editor's download produces one — the only kind of file the import accepts.
 */
async function makeExportedFile(slotIds: readonly Maybe<string>[]): Promise<File> {
  const entries = await Promise.all(slotIds.map(async (slotId, i) => readyPdfEntry(`e${i}`, await makeRealPdfFile(`${slotId ?? 'loose'}.pdf`, 1), slotId)));
  const blob = await mergePdfMergeEntries(entries, { sidecar: true });
  return new File([blob], 'merged.pdf', { type: 'application/pdf' });
}

function filesChangedEvent(file: File): DbxFileUploadFilesChangedEvent {
  return {
    allFiles: [file],
    matchResult: { multiple: false, input: [file], accepted: [file], rejected: [] } as unknown as FileArrayAcceptMatchResult
  };
}

@Component({
  // The import deliberately renders ABOVE the slots: slots register in ngOnInit, which for a slot
  // declared later runs after the import's visibility binding is first evaluated. This is the
  // demo's layout, and the ordering guard below depends on it.
  template: `
    <div dbxPdfMergeEditorStore>
      <dbx-pdf-merge-import [expectedSlotIds]="expectedSlotIds()" [enforceExpectedSlots]="enforce()"></dbx-pdf-merge-import>
      @if (showLicense()) {
        <dbx-pdf-merge-editor-file-upload slotId="license"></dbx-pdf-merge-editor-file-upload>
      }
      @if (showCert()) {
        <dbx-pdf-merge-editor-file-upload slotId="cert"></dbx-pdf-merge-editor-file-upload>
      }
      @if (showSecondLicense()) {
        <dbx-pdf-merge-editor-file-upload slotId="license"></dbx-pdf-merge-editor-file-upload>
      }
    </div>
  `,
  imports: [DbxPdfMergeEditorStoreDirective, DbxPdfMergeEditorFileUploadComponent, DbxPdfMergeImportComponent]
})
class TestHostComponent {
  readonly showLicense = signal<boolean>(false);
  readonly showCert = signal<boolean>(false);
  readonly showSecondLicense = signal<boolean>(false);
  readonly expectedSlotIds = signal<Maybe<readonly string[]>>(undefined);
  readonly enforce = signal<boolean>(true);

  readonly storeDirective = viewChild.required(DbxPdfMergeEditorStoreDirective);
  readonly import = viewChild.required(DbxPdfMergeImportComponent);
}

/**
 * Mirrors the PDF merge upload dialog, which provides the preserve-entries token and is torn down on every close while the store lives on.
 */
@Component({
  selector: 'dbx-ephemeral-slot-host',
  template: `
    <dbx-pdf-merge-editor-file-upload slotId="receipts"></dbx-pdf-merge-editor-file-upload>
  `,
  imports: [DbxPdfMergeEditorFileUploadComponent],
  providers: [provideDbxPdfMergeEditorPreserveEntriesOnSlotDestroy(true)]
})
class PreservingSlotHostComponent {}

@Component({
  template: `
    <div dbxPdfMergeEditorStore>
      @if (showDialog()) {
        <dbx-ephemeral-slot-host></dbx-ephemeral-slot-host>
      }
    </div>
  `,
  imports: [DbxPdfMergeEditorStoreDirective, PreservingSlotHostComponent]
})
class EphemeralHostComponent {
  readonly showDialog = signal<boolean>(false);
  readonly storeDirective = viewChild.required(DbxPdfMergeEditorStoreDirective);
}

describe('DbxPdfMergeEditorStore slot registry', () => {
  let store: DbxPdfMergeEditorStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DbxPdfMergeEditorStore] });
    store = TestBed.inject(DbxPdfMergeEditorStore);
  });

  it('starts with no registered slot ids', async () => {
    expect(await firstValueFrom(store.registeredSlotIds$)).toEqual([]);
  });

  it('registers ids and emits them sorted rather than in registration order', async () => {
    store.registerSlotId('license');
    store.registerSlotId('cert');

    expect(await firstValueFrom(store.registeredSlotIds$)).toEqual(['cert', 'license']);
  });

  it('drops an id once it is unregistered', async () => {
    store.registerSlotId('license');
    store.registerSlotId('cert');
    store.unregisterSlotId('license');

    expect(await firstValueFrom(store.registeredSlotIds$)).toEqual(['cert']);
  });

  it('reference counts, so unregistering one of two mounts keeps the id registered', async () => {
    store.registerSlotId('license');
    store.registerSlotId('license');
    store.unregisterSlotId('license');

    expect(await firstValueFrom(store.registeredSlotIds$)).toEqual(['license']);

    store.unregisterSlotId('license');

    expect(await firstValueFrom(store.registeredSlotIds$)).toEqual([]);
  });

  it('ignores unregistering an id that was never registered', async () => {
    store.registerSlotId('license');
    store.unregisterSlotId('nope');
    store.unregisterSlotId('nope');

    expect(await firstValueFrom(store.registeredSlotIds$)).toEqual(['license']);
  });

  it('does not re-emit when a duplicate registration leaves the id set unchanged', async () => {
    const emissions: string[][] = [];
    const subscription = store.registeredSlotIds$.subscribe((ids) => emissions.push([...ids]));

    store.registerSlotId('license');
    store.registerSlotId('license');
    store.unregisterSlotId('license');
    subscription.unsubscribe();

    expect(emissions).toEqual([[], ['license']]);
  });
});

describe('DbxPdfMergeEditorFileUploadComponent slot registration', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let store: DbxPdfMergeEditorStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    store = component.storeDirective().store;
  });

  it('registers each mounted slot with the store', async () => {
    component.showLicense.set(true);
    component.showCert.set(true);
    fixture.detectChanges();

    expect(await firstValueFrom(store.registeredSlotIds$)).toEqual(['cert', 'license']);
  });

  it('unregisters a slot removed from the view', async () => {
    component.showLicense.set(true);
    component.showCert.set(true);
    fixture.detectChanges();

    component.showCert.set(false);
    fixture.detectChanges();

    expect(await firstValueFrom(store.registeredSlotIds$)).toEqual(['license']);
  });

  it('keeps an id registered while a second slot still declares it', async () => {
    component.showLicense.set(true);
    component.showSecondLicense.set(true);
    fixture.detectChanges();

    expect(await firstValueFrom(store.registeredSlotIds$)).toEqual(['license']);

    component.showLicense.set(false);
    fixture.detectChanges();

    expect(await firstValueFrom(store.registeredSlotIds$)).toEqual(['license']);

    component.showSecondLicense.set(false);
    fixture.detectChanges();

    expect(await firstValueFrom(store.registeredSlotIds$)).toEqual([]);
  });
});

describe('DbxPdfMergeEditorFileUploadComponent slot registration under preserved entries', () => {
  let fixture: ComponentFixture<EphemeralHostComponent>;
  let component: EphemeralHostComponent;
  let store: DbxPdfMergeEditorStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EphemeralHostComponent] }).compileComponents();

    fixture = TestBed.createComponent(EphemeralHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    store = component.storeDirective().store;
  });

  it('unregisters the slot id on destroy even though the slot preserves its entries', async () => {
    component.showDialog.set(true);
    fixture.detectChanges();

    const file = await makeRealPdfFile('receipt.pdf', 1);
    store.addFiles({ entries: [readyPdfEntry('r1', file, 'receipts')] });

    expect(await firstValueFrom(store.registeredSlotIds$)).toEqual(['receipts']);

    component.showDialog.set(false);
    fixture.detectChanges();

    // The token governs the ENTRIES, which survive; the slot itself is gone, so its id must not be.
    expect(await firstValueFrom(store.registeredSlotIds$)).toEqual([]);
    expect(await firstValueFrom(store.entryCount$)).toBe(1);
  });

  it('leaves the registry at its starting state after repeated mount/unmount against a surviving store', async () => {
    for (let i = 0; i < 3; i += 1) {
      component.showDialog.set(true);
      fixture.detectChanges();
      component.showDialog.set(false);
      fixture.detectChanges();
    }

    expect(await firstValueFrom(store.registeredSlotIds$)).toEqual([]);
  });
});

describe('DbxPdfMergeImportComponent slot expectations', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders nothing when no slots are registered', () => {
    expect(component.import().activeSignal()).toBe(false);
    expect(component.import().effectiveExpectedSlotIdsSignal()).toBeNull();
    expect(fixture.nativeElement.querySelector('dbx-file-upload')).toBeNull();
  });

  it('is visible after a single change detection pass despite rendering above its slots', () => {
    const orderedFixture = TestBed.createComponent(TestHostComponent);
    orderedFixture.componentInstance.showLicense.set(true);
    orderedFixture.detectChanges();

    expect(orderedFixture.componentInstance.import().activeSignal()).toBe(true);
    expect(orderedFixture.nativeElement.querySelector('dbx-file-upload')).not.toBeNull();
  });

  it('derives its expected slots from the registered slots', () => {
    component.showLicense.set(true);
    component.showCert.set(true);
    fixture.detectChanges();

    expect(component.import().effectiveExpectedSlotIdsSignal()).toEqual(['cert', 'license']);
    expect(component.import().activeSignal()).toBe(true);
  });

  it('hides again once the last slot is removed', () => {
    component.showLicense.set(true);
    fixture.detectChanges();
    expect(component.import().activeSignal()).toBe(true);

    component.showLicense.set(false);
    fixture.detectChanges();

    expect(component.import().activeSignal()).toBe(false);
    expect(fixture.nativeElement.querySelector('dbx-file-upload')).toBeNull();
  });

  it('lets an explicit expectedSlotIds binding win over the registered slots', () => {
    component.showLicense.set(true);
    component.expectedSlotIds.set(['other']);
    fixture.detectChanges();

    expect(component.import().effectiveExpectedSlotIdsSignal()).toEqual(['other']);
  });

  it('stays visible on an explicit expectedSlotIds binding with no slots registered', () => {
    component.expectedSlotIds.set(['other']);
    fixture.detectChanges();

    expect(component.import().activeSignal()).toBe(true);
  });

  it('treats an explicitly empty expectedSlotIds as declaring no sections, and hides', () => {
    component.showLicense.set(true);
    component.expectedSlotIds.set([]);
    fixture.detectChanges();

    expect(component.import().activeSignal()).toBe(false);
  });

  it('stays visible and unchecked when enforcement is disabled with no slots registered', () => {
    component.enforce.set(false);
    fixture.detectChanges();

    expect(component.import().activeSignal()).toBe(true);
    expect(component.import().effectiveExpectedSlotIdsSignal()).toBeNull();
  });
});

describe('DbxPdfMergeImportComponent import', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let store: DbxPdfMergeEditorStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    store = component.storeDirective().store;
  });

  it('rejects a file naming a section the registered slots do not declare, with nothing bound', async () => {
    component.showLicense.set(true);
    fixture.detectChanges();

    await component.import().onFiles(filesChangedEvent(await makeExportedFile(['license', 'cert'])));

    expect(component.import().errorSignal()).toContain('cert');
    expect(await firstValueFrom(store.entryCount$)).toBe(0);
  });

  it('imports that same file when enforcement is disabled', async () => {
    component.enforce.set(false);
    fixture.detectChanges();

    await component.import().onFiles(filesChangedEvent(await makeExportedFile(['license', 'cert'])));

    expect(component.import().errorSignal()).toBeNull();
    expect(await firstValueFrom(store.entryCount$)).toBe(2);
  });

  it('imports a file whose sections match the registered slots', async () => {
    component.showLicense.set(true);
    component.showCert.set(true);
    fixture.detectChanges();

    await component.import().onFiles(filesChangedEvent(await makeExportedFile(['license', 'cert'])));

    expect(component.import().errorSignal()).toBeNull();
    expect(component.import().missingSlotIdsSignal()).toEqual([]);
    expect(await firstValueFrom(store.entryCount$)).toBe(2);
  });

  it('reports an expected section the file did not fill, without failing the import', async () => {
    component.showLicense.set(true);
    component.showCert.set(true);
    fixture.detectChanges();

    const missing: string[][] = [];
    component.import().missingSlots.subscribe((slotIds) => missing.push([...slotIds]));

    await component.import().onFiles(filesChangedEvent(await makeExportedFile(['license'])));

    expect(component.import().errorSignal()).toBeNull();
    expect(component.import().missingSlotIdsSignal()).toEqual(['cert']);
    expect(component.import().missingLabelSignal()).toContain('cert');
    expect(missing).toEqual([['cert']]);
    expect(await firstValueFrom(store.entryCount$)).toBe(1);
  });

  it('rejects an unsectioned document while a check is active', async () => {
    component.showLicense.set(true);
    fixture.detectChanges();

    await component.import().onFiles(filesChangedEvent(await makeExportedFile(['license', null])));

    expect(component.import().errorSignal()).toContain('unsectioned');
    expect(await firstValueFrom(store.entryCount$)).toBe(0);
  });
});

describe('DbxPdfMergeImportComponent notice lifecycle', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let store: DbxPdfMergeEditorStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    component.showLicense.set(true);
    component.showCert.set(true);
    fixture.detectChanges();
    store = component.storeDirective().store;
  });

  it('drops the success notice when a clear discards the import outright', async () => {
    await component.import().onFiles(filesChangedEvent(await makeExportedFile(['license', 'cert'])));
    expect(component.import().successLabelSignal()).toContain('license');

    await store.clearEntries();

    expect(component.import().successLabelSignal()).toBeNull();
    expect(component.import().missingLabelSignal()).toBeNull();
  });

  it('drops the missing-section warning when a clear discards the import', async () => {
    await component.import().onFiles(filesChangedEvent(await makeExportedFile(['license'])));
    expect(component.import().missingLabelSignal()).toContain('cert');

    await store.clearEntries();

    expect(component.import().missingLabelSignal()).toBeNull();
  });

  describe('with a programmatic baseline, where a clear restores rather than empties', () => {
    beforeEach(async () => {
      const baseline = await makeExportedFile(['license', 'cert']);
      await store.importMergedPdf({ source: baseline });
    });

    it("drops the picker's error notice — the clear replaced what the error described", async () => {
      // The reported sequence: load a packet programmatically, then pick a file the editor rejects.
      await component.import().onFiles(filesChangedEvent(new File(['not a pdf'], 'bad.pdf', { type: 'application/pdf' })));
      expect(component.import().errorSignal()).not.toBeNull();

      const result = await store.clearEntries();

      expect(result.restored).toBe(true);
      expect(component.import().errorSignal()).toBeNull();
    });

    it("drops the picker's success notice when the baseline is restored over it", async () => {
      await component.import().onFiles(filesChangedEvent(await makeExportedFile(['license'])));
      expect(component.import().successLabelSignal()).not.toBeNull();
      expect(component.import().missingLabelSignal()).toContain('cert');

      await store.clearEntries();

      expect(component.import().successLabelSignal()).toBeNull();
      expect(component.import().missingLabelSignal()).toBeNull();
      expect(await firstValueFrom(store.entryCount$)).toBe(2);
    });

    it("leaves a freshly picked file's own notice alone", async () => {
      await component.import().onFiles(filesChangedEvent(await makeExportedFile(['license', 'cert'])));

      expect(component.import().successLabelSignal()).toContain('license');
      expect(component.import().errorSignal()).toBeNull();
    });
  });
});
