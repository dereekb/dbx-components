import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { type DbxImageCompressionConfig } from '../image';
import { type DbxFileUploadFilesChangedEvent } from '../../interaction/upload/abstract.upload.component';
import { type PdfMergeEntry } from './pdf.merge';
import { type DbxPdfMergeEditorStore } from './pdf.merge.editor.store';
import { DbxPdfMergeEditorStoreDirective } from './pdf.merge.editor.store.directive';
import { DbxPdfMergeEditorFileUploadComponent, type DbxPdfMergeEditorFileUploadConfig } from './pdf.merge.editor.file.upload.component';

const STORE_COMPRESSION: DbxImageCompressionConfig = { maxDimension: 1024, jpegQuality: 0.7 };
const SLOT_COMPRESSION: DbxImageCompressionConfig = { maxDimension: 512, jpegQuality: 0.5 };

const SLOT_ID = 'license';

/**
 * Ready entry built by hand rather than through `buildPdfMergeEntry`, so no validation ever runs — the header controls key off entry ownership and count alone.
 */
function readyEntry(id: string, slotId?: Maybe<string>): PdfMergeEntry {
  const file = new File([new Uint8Array([1])], `${id}.pdf`, { type: 'application/pdf' });

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

/**
 * Ready entry flagged as encrypted, i.e. what validation produces for a password-protected PDF.
 */
function encryptedEntry(id: string, slotId?: Maybe<string>): PdfMergeEntry {
  return { ...readyEntry(id, slotId), encrypted: true, validation: Promise.resolve({ ok: true, encrypted: true }) };
}

/**
 * The event a {@link DbxFileUploadComponent} emits for one accepted file.
 */
function filesChangedEvent(file: File): DbxFileUploadFilesChangedEvent {
  return { allFiles: [file], matchResult: { multiple: false, input: [file], accepted: [file], rejected: [], acceptedType: [file], rejectedType: [] } };
}

@Component({
  template: `
    <div dbxPdfMergeEditorStore>
      <dbx-pdf-merge-editor-file-upload slotId="license" [config]="slotConfig()"></dbx-pdf-merge-editor-file-upload>
    </div>
  `,
  standalone: true,
  imports: [DbxPdfMergeEditorStoreDirective, DbxPdfMergeEditorFileUploadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestHostComponent {
  readonly slotConfig = signal<Maybe<DbxPdfMergeEditorFileUploadConfig>>(undefined);
  readonly slot = viewChild.required(DbxPdfMergeEditorFileUploadComponent);
}

describe('DbxPdfMergeEditorFileUploadComponent image compression resolution', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let store: DbxPdfMergeEditorStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: []
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // The store is provided by the directive, so resolve it from the slot component's injector.
    store = component.slot().store;
  });

  it('falls back to the store-level image compression set on the store (the channel the store directive uses) when the slot has no own imageCompression', () => {
    store.setImageCompression(STORE_COMPRESSION);
    fixture.detectChanges();

    expect(component.slot().effectiveImageCompressionSignal()).toBe(STORE_COMPRESSION);
  });

  it("uses the slot's own imageCompression over the store-level default when both are set", () => {
    store.setImageCompression(STORE_COMPRESSION);
    component.slotConfig.set({ imageCompression: SLOT_COMPRESSION });
    fixture.detectChanges();

    expect(component.slot().effectiveImageCompressionSignal()).toBe(SLOT_COMPRESSION);
  });

  it('resolves to null when neither the slot nor the store provides image compression', () => {
    fixture.detectChanges();
    expect(component.slot().effectiveImageCompressionSignal()).toBeNull();
  });
});

describe('DbxPdfMergeEditorFileUploadComponent header add/clear controls', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let store: DbxPdfMergeEditorStore;

  function fillSlot(...ids: readonly string[]): void {
    store.addFiles({ entries: ids.map((id) => readyEntry(id, SLOT_ID)) });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: []
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    store = component.slot().store;
  });

  it('offers the drop area and no header controls while the slot is empty', () => {
    const slot = component.slot();

    expect(slot.showUploadAreaSignal()).toBe(true);
    expect(slot.showAddButtonSignal()).toBe(false);
    expect(slot.showClearButtonSignal()).toBe(false);
  });

  it('replaces the drop area with the header Add button once a multi-file slot owns an entry', () => {
    component.slotConfig.set({ multiple: true });
    fillSlot('a');

    const slot = component.slot();

    expect(slot.showUploadAreaSignal()).toBe(false);
    expect(slot.showAddButtonSignal()).toBe(true);
    expect(slot.showClearButtonSignal()).toBe(true);
  });

  it('withholds the Add button once the slot reaches capacity, leaving Clear as the way to replace the file', () => {
    // Default capacity for a single-file slot is 1, so one entry fills it.
    fillSlot('a');

    const slot = component.slot();

    expect(slot.showUploadAreaSignal()).toBe(false);
    expect(slot.showAddButtonSignal()).toBe(false);
    expect(slot.showClearButtonSignal()).toBe(true);
  });

  it('withholds the Add button once a capped multi-file slot reaches maxFiles', () => {
    component.slotConfig.set({ multiple: true, maxFiles: 2 });
    fillSlot('a');

    expect(component.slot().showAddButtonSignal()).toBe(true);

    fillSlot('b');

    expect(component.slot().showAddButtonSignal()).toBe(false);
  });

  it('keeps the drop area visible until capacity when the header Add button is turned off', () => {
    component.slotConfig.set({ multiple: true, maxFiles: 2, showAddButton: false });
    fillSlot('a');

    const slot = component.slot();

    expect(slot.showAddButtonSignal()).toBe(false);
    expect(slot.showUploadAreaSignal()).toBe(true);

    fillSlot('b');

    expect(component.slot().showUploadAreaSignal()).toBe(false);
  });

  it('hides the Clear button when showClearButton is false', () => {
    component.slotConfig.set({ showClearButton: false });
    fillSlot('a');

    expect(component.slot().showClearButtonSignal()).toBe(false);
  });

  it('names the slot in the default clear confirmation and lets clearConfirm override any field of it', () => {
    component.slotConfig.set({ label: 'Driver’s License' });
    fixture.detectChanges();

    expect(component.slot().clearConfirmSignal().title).toBe('Clear Driver’s License?');

    component.slotConfig.set({ label: 'Driver’s License', clearConfirm: { title: 'Start over?', autoConfirm: true } });
    fixture.detectChanges();

    const confirm = component.slot().clearConfirmSignal();

    expect(confirm.title).toBe('Start over?');
    expect(confirm.autoConfirm).toBe(true);
    // Untouched fields still come from the defaults.
    expect(confirm.confirmText).toBe('Clear');
  });

  it('withdraws the drop area and waives the requirement while an encrypted PDF in another slot takes over the document', async () => {
    store.addFiles({ entries: [encryptedEntry('locked', 'cert')] });
    fixture.detectChanges();

    const slot = component.slot();

    expect(slot.supersededByEncryptedSignal()).toBe(true);
    expect(slot.showUploadAreaSignal()).toBe(false);
    expect(slot.showAddButtonSignal()).toBe(false);
    // Required and empty, which would normally block the merge — but nothing added here could reach it.
    expect(slot.stateSignal()).toBe('no_file');
    expect(await firstValueFrom(slot.isValid$)).toBe(true);
  });

  it('is superseded by an encrypted PDF added outside any slot', () => {
    store.addFiles({ entries: [encryptedEntry('locked', null)] });
    fixture.detectChanges();

    expect(component.slot().supersededByEncryptedSignal()).toBe(true);
  });

  it('is not superseded by the encrypted PDF it owns itself', () => {
    store.addFiles({ entries: [encryptedEntry('locked', SLOT_ID)] });
    fixture.detectChanges();

    const slot = component.slot();

    expect(slot.supersededByEncryptedSignal()).toBe(false);
    // Capacity, not supersession, is what withholds Add here — the slot is single-file and now full.
    expect(slot.showClearButtonSignal()).toBe(true);
  });

  it('restores the drop area once the encrypted entry is removed', () => {
    store.addFiles({ entries: [encryptedEntry('locked', 'cert')] });
    fixture.detectChanges();

    store.removeEntry('locked');
    fixture.detectChanges();

    const slot = component.slot();

    expect(slot.supersededByEncryptedSignal()).toBe(false);
    expect(slot.showUploadAreaSignal()).toBe(true);
  });

  it('drops files handed to a superseded slot instead of adding entries the merge would ignore', async () => {
    store.addFiles({ entries: [encryptedEntry('locked', 'cert')] });
    fixture.detectChanges();

    const slot = component.slot();
    const file = new File([new Uint8Array([1])], 'extra.pdf', { type: 'application/pdf' });

    await slot.onFiles(filesChangedEvent(file));
    fixture.detectChanges();

    expect(slot.ownedEntriesSignal().length).toBe(0);
  });

  it('clears only the entries this slot owns when the clear action runs', async () => {
    fillSlot('a');
    store.addFiles({ entries: [readyEntry('other', 'cert')] });
    fixture.detectChanges();

    const slot = component.slot();
    let succeeded = false;

    // The handler is what the header's dbxAction runs after dbxActionConfirm resolves.
    (slot.handleClear as (value: unknown, context: { success: () => void }) => void)(undefined, {
      success: () => {
        succeeded = true;
      }
    });
    fixture.detectChanges();

    expect(succeeded).toBe(true);
    expect(slot.ownedEntriesSignal().length).toBe(0);
    expect(await firstValueFrom(store.entriesForSlotId$('cert'))).toHaveLength(1);
  });
});
