import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { type Maybe } from '@dereekb/util';
import { type DbxImageCompressionConfig } from '../image';
import { type DbxPdfMergeEditorStore } from './pdf.merge.editor.store';
import { DbxPdfMergeEditorStoreDirective } from './pdf.merge.editor.store.directive';
import { DbxPdfMergeEditorFileUploadComponent, type DbxPdfMergeEditorFileUploadConfig } from './pdf.merge.editor.file.upload.component';

const STORE_COMPRESSION: DbxImageCompressionConfig = { maxDimension: 1024, jpegQuality: 0.7 };
const SLOT_COMPRESSION: DbxImageCompressionConfig = { maxDimension: 512, jpegQuality: 0.5 };

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
