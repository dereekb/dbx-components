import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, viewChild } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { DbxButtonDirective } from '@dereekb/dbx-core';
import { DbxPdfMergeEditorStore } from '@dereekb/dbx-web';
import { DbxFirebaseStorageFileUploadStore } from '../store';
import { DbxFirebaseStoragePdfMergeUploadSyncDirective, DBX_FIREBASE_STORAGE_PDF_MERGE_UPLOAD_FILE_NAME } from './storagefile.pdfmerge.upload.sync.directive';

/**
 * Verifies that a confirmed button click (clicked$, which only fires after the merge dialog interceptor
 * resolves) pushes the merge editor's latest output blob into the upload store as a single PDF File.
 */
describe('DbxFirebaseStoragePdfMergeUploadSyncDirective', () => {
  let uploadStore: DbxFirebaseStorageFileUploadStore;
  let mergeOutput$: BehaviorSubject<Blob>;
  let mergedBlob: Blob;

  let testComponent: TestDbxFirebaseStoragePdfMergeUploadSyncComponent;
  let fixture: ComponentFixture<TestDbxFirebaseStoragePdfMergeUploadSyncComponent>;

  beforeEach(async () => {
    uploadStore = new DbxFirebaseStorageFileUploadStore();
    mergedBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/pdf' });
    mergeOutput$ = new BehaviorSubject<Blob>(mergedBlob);

    TestBed.configureTestingModule({
      providers: [
        { provide: DbxFirebaseStorageFileUploadStore, useValue: uploadStore },
        { provide: DbxPdfMergeEditorStore, useValue: { mergeOutput$ } }
      ]
    });

    fixture = TestBed.createComponent(TestDbxFirebaseStoragePdfMergeUploadSyncComponent);
    testComponent = fixture.componentInstance;

    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should be created on the host button', () => {
    expect(testComponent.sync()).toBeDefined();
    expect(testComponent.button()).toBeDefined();
  });

  it('should push the merged blob as a single PDF File into the upload store on confirmed click', async () => {
    // a plain dbxButton with no interceptor emits clicked$ immediately, standing in for the confirmed merge.
    testComponent.button().clickButton();
    fixture.detectChanges();

    const files = await firstValueFrom(uploadStore.files$);
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe(DBX_FIREBASE_STORAGE_PDF_MERGE_UPLOAD_FILE_NAME);
    expect(files[0].type).toBe('application/pdf');
    expect(files[0].size).toBe(mergedBlob.size);
  });

  it('should not push anything before a click', async () => {
    let emitted = false;
    const sub = uploadStore.files$.subscribe(() => {
      emitted = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(emitted).toBe(false);
    sub.unsubscribe();
  });
});

@Component({
  template: `
    <button dbxButton dbxFirebaseStoragePdfMergeUploadSync>Upload</button>
  `,
  standalone: true,
  imports: [DbxButtonDirective, DbxFirebaseStoragePdfMergeUploadSyncDirective]
})
class TestDbxFirebaseStoragePdfMergeUploadSyncComponent {
  readonly button = viewChild.required(DbxButtonDirective);
  readonly sync = viewChild.required(DbxFirebaseStoragePdfMergeUploadSyncDirective);
}
