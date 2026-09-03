import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, viewChild } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { GOOGLE_CLOUD_STORAGE_PUBLIC_URL_API_ENDPOINT, storagePublicDownloadUrl, type StorageFileId, type StoragePathInput } from '@dereekb/firebase';
import { DbxRouterWebProviderConfig, DbxWebFilePreviewService } from '@dereekb/dbx-web';
import { MatDialog } from '@angular/material/dialog';
import { vi } from 'vitest';
import { DbxFirebaseStorageService } from '../../../storage/firebase.storage.service';
import { DbxFirebaseStorageFileDownloadService } from '../service/storagefile.download.service';
import { DbxFirebaseStorageFileDownloadButtonComponent, type DbxFirebaseStorageFileDownloadButtonConfig, type DbxFirebaseStorageFileDownloadButtonSource } from './storagefile.download.button.component';

const TEST_BUCKET_ID = 'test-bucket.appspot.com';
const TEST_STORAGE_FILE_ID = 'cDoQAQSM9OyBnZi23duw';
const TEST_STORAGE_FILE_KEY = `sf/${TEST_STORAGE_FILE_ID}`;
const TEST_PATH_STRING = `/cal/${TEST_STORAGE_FILE_ID}.ics`;

const EXPECTED_PUBLIC_URL = storagePublicDownloadUrl({
  apiEndpoint: GOOGLE_CLOUD_STORAGE_PUBLIC_URL_API_ENDPOINT,
  storagePath: { bucketId: TEST_BUCKET_ID, pathString: TEST_PATH_STRING }
});

/**
 * The button's public-path branch: a url derived on the client, so it must be live before anything is
 * clicked and must never reach the download callable.
 */
describe('DbxFirebaseStorageFileDownloadButtonComponent public storage path', () => {
  let downloadPairForStorageFileUsingSource: ReturnType<typeof vi.fn>;

  let testComponent: TestDbxFirebaseStorageFileDownloadButtonComponent;
  let fixture: ComponentFixture<TestDbxFirebaseStorageFileDownloadButtonComponent>;

  beforeEach(async () => {
    downloadPairForStorageFileUsingSource = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: {} },
        { provide: DbxWebFilePreviewService, useValue: {} },
        { provide: DbxRouterWebProviderConfig, useValue: { anchorSegueRefComponent: {} } },
        {
          provide: DbxFirebaseStorageFileDownloadService,
          useValue: {
            getCachedDownloadPairForStorageFile: () => of(null),
            downloadPairForStorageFileUsingSource
          }
        },
        {
          // stands in for the real service, which resolves the origin from the app's emulator config
          provide: DbxFirebaseStorageService,
          useValue: {
            publicDownloadUrl: (path: StoragePathInput) =>
              storagePublicDownloadUrl({
                apiEndpoint: GOOGLE_CLOUD_STORAGE_PUBLIC_URL_API_ENDPOINT,
                storagePath: { bucketId: TEST_BUCKET_ID, pathString: typeof path === 'string' ? path : (path as { pathString: string }).pathString }
              })
          }
        }
      ]
    });

    fixture = TestBed.createComponent(TestDbxFirebaseStorageFileDownloadButtonComponent);
    testComponent = fixture.componentInstance;

    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should derive the download url from a path factory and the storage file key', () => {
    expect(testComponent.downloadButton().usesPublicDownloadUrlSignal()).toBe(true);
    expect(testComponent.downloadButton().downloadUrlSignal()).toBe(EXPECTED_PUBLIC_URL);
  });

  it('should render an href anchor that is live before any click', () => {
    const anchor: HTMLAnchorElement = fixture.debugElement.query(By.css('a.dbx-anchor-href')).nativeElement;
    expect(anchor.getAttribute('href')).toBe(EXPECTED_PUBLIC_URL);
  });

  it('should not carry an expiration, since a public url does not expire', () => {
    expect(testComponent.downloadButton().downloadUrlExpiresAtSignal()).toBeUndefined();
  });

  it('should render an enabled button, since the url is ready to save', () => {
    const button: HTMLButtonElement = fixture.debugElement.query(By.css('a.dbx-anchor-href button')).nativeElement;
    expect(button.disabled).toBe(false);
  });

  it('should never call the download service, even when the action is triggered', async () => {
    const button: HTMLButtonElement = fixture.debugElement.query(By.css('a.dbx-anchor-href button')).nativeElement;
    button.click();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(downloadPairForStorageFileUsingSource).not.toHaveBeenCalled();
    expect(testComponent.downloadButton().downloadUrlSignal()).toBe(EXPECTED_PUBLIC_URL);
  });

  it('should accept a path value instead of a factory', async () => {
    fixture.componentRef.setInput('source', {
      storageFileKey: TEST_STORAGE_FILE_KEY,
      publicStoragePath: { bucketId: TEST_BUCKET_ID, pathString: TEST_PATH_STRING }
    } as DbxFirebaseStorageFileDownloadButtonSource);

    await fixture.whenStable();
    fixture.detectChanges();

    expect(testComponent.downloadButton().downloadUrlSignal()).toBe(EXPECTED_PUBLIC_URL);
  });

  it('should stay on the action when no public path is configured', async () => {
    fixture.componentRef.setInput('source', { storageFileKey: TEST_STORAGE_FILE_KEY } as DbxFirebaseStorageFileDownloadButtonSource);

    await fixture.whenStable();
    fixture.detectChanges();

    expect(testComponent.downloadButton().usesPublicDownloadUrlSignal()).toBe(false);
    expect(testComponent.downloadButton().downloadUrlSignal()).toBeUndefined();
  });
});

@Component({
  template: `
    <dbx-firebase-storagefile-download-button [config]="config" [source]="source()"></dbx-firebase-storagefile-download-button>
  `,
  imports: [DbxFirebaseStorageFileDownloadButtonComponent]
})
class TestDbxFirebaseStorageFileDownloadButtonComponent {
  readonly downloadButton = viewChild.required(DbxFirebaseStorageFileDownloadButtonComponent);

  // the preview button opens a dialog through its own dbxAction, which this spec has no interest in
  readonly config: DbxFirebaseStorageFileDownloadButtonConfig = { showPreviewButton: false };

  readonly source = input<DbxFirebaseStorageFileDownloadButtonSource>({
    storageFileKey: TEST_STORAGE_FILE_KEY,
    publicStoragePath: (storageFileId: StorageFileId) => `/cal/${storageFileId}.ics`
  });
}
