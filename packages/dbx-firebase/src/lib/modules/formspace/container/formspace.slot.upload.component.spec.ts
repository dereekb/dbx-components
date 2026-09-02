import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { DbxRouterWebProviderConfig, DbxWebFilePreviewService } from '@dereekb/dbx-web';
import { type FormSpaceFile, type FormSpaceFileSlot, FormSpaceFileValidationState, StorageFileFunctions } from '@dereekb/firebase';
import { type Maybe, type SlashPathFile } from '@dereekb/util';
import { DbxFirebaseAuthService } from '../../../auth/service/firebase.auth.service';
import { DbxFirebaseStorageService } from '../../../storage/firebase.storage.service';
import { DbxFirebaseStorageFileDownloadService } from '../../storagefile/service/storagefile.download.service';
import { FormSpaceDocumentStore } from '../store/formspace.document.store';
import { DbxFirebaseFormSpaceSlotUploadComponent } from './formspace.slot.upload.component';

const TEST_SLOT = 'cover' as FormSpaceFileSlot;
const TEST_UID = 'testuid';

function testFile(name: string): FormSpaceFile {
  return {
    sl: TEST_SLOT,
    sf: `sf_${name}`,
    n: name as SlashPathFile,
    v: FormSpaceFileValidationState.VALID,
    at: new Date()
  };
}

/**
 * A one-file slot supersedes rather than accumulates, so its upload button is never disabled for being
 * full — which makes its LABEL the only thing that tells the user the file already there is about to go.
 */
describe('DbxFirebaseFormSpaceSlotUploadComponent upload button', () => {
  let files: BehaviorSubject<FormSpaceFile[]>;
  let testComponent: TestDbxFirebaseFormSpaceSlotUploadComponent;
  let fixture: ComponentFixture<TestDbxFirebaseFormSpaceSlotUploadComponent>;

  async function detectChanges(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    files = new BehaviorSubject<FormSpaceFile[]>([]);

    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: {} },
        { provide: DbxWebFilePreviewService, useValue: {} },
        { provide: DbxRouterWebProviderConfig, useValue: { anchorSegueRefComponent: {} } },
        { provide: DbxFirebaseStorageService, useValue: {} },
        { provide: StorageFileFunctions, useValue: {} },
        {
          provide: DbxFirebaseStorageFileDownloadService,
          useValue: {
            getCachedDownloadPairForStorageFile: () => of(null),
            downloadPairForStorageFileUsingSource: () => of(null)
          }
        },
        { provide: DbxFirebaseAuthService, useValue: { currentUid$: of(TEST_UID) } },
        {
          provide: FormSpaceDocumentStore,
          useValue: {
            filesInSlot$: () => files.asObservable(),
            isEditable$: of(true),
            currentData$: of({ u: TEST_UID }),
            currentId$: of('testformspace'),
            removeFormSpaceFile: () => of(undefined)
          }
        }
      ]
    });

    fixture = TestBed.createComponent(TestDbxFirebaseFormSpaceSlotUploadComponent);
    testComponent = fixture.componentInstance;

    await detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should say upload while a one-file slot is empty', () => {
    expect(testComponent.slot().uploadButtonTextSignal()).toBe('Upload Cover');
    expect(testComponent.slot().isReplacingSignal()).toBe(false);
  });

  it('should say replace once a one-file slot holds a file', async () => {
    files.next([testFile('cover.pdf')]);
    await detectChanges();

    expect(testComponent.slot().isReplacingSignal()).toBe(true);
    expect(testComponent.slot().uploadButtonTextSignal()).toBe('Replace Cover');
  });

  it('should keep a named upload rather than reducing it to a bare Replace', async () => {
    testComponent.replaceTextSignal.set(undefined);
    files.next([testFile('cover.pdf')]);
    await detectChanges();

    expect(testComponent.slot().uploadButtonTextSignal()).toBe('Upload Cover');
  });

  it('should fall back to Replace for a slot that named neither', async () => {
    testComponent.replaceTextSignal.set(undefined);
    testComponent.uploadTextSignal.set(undefined);
    files.next([testFile('cover.pdf')]);
    await detectChanges();

    expect(testComponent.slot().uploadButtonTextSignal()).toBe('Replace');
  });

  it('should leave the upload button enabled for a filled one-file slot', async () => {
    files.next([testFile('cover.pdf')]);
    await detectChanges();

    expect(testComponent.slot().uploadDisabledSignal()).toBe(false);
  });

  it('should never say replace for a folder slot', async () => {
    testComponent.maxFilesSignal.set(4);
    files.next([testFile('a.pdf'), testFile('b.pdf')]);
    await detectChanges();

    expect(testComponent.slot().isReplacingSignal()).toBe(false);
    expect(testComponent.slot().uploadButtonTextSignal()).toBe('Upload Cover');
  });
});

describe('DbxFirebaseFormSpaceSlotUploadComponent remaining uploads', () => {
  let files: BehaviorSubject<FormSpaceFile[]>;
  let testComponent: TestDbxFirebaseFormSpaceSlotUploadComponent;
  let fixture: ComponentFixture<TestDbxFirebaseFormSpaceSlotUploadComponent>;

  async function detectChanges(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    files = new BehaviorSubject<FormSpaceFile[]>([]);

    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: {} },
        { provide: DbxWebFilePreviewService, useValue: {} },
        { provide: DbxRouterWebProviderConfig, useValue: { anchorSegueRefComponent: {} } },
        { provide: DbxFirebaseStorageService, useValue: {} },
        { provide: StorageFileFunctions, useValue: {} },
        {
          provide: DbxFirebaseStorageFileDownloadService,
          useValue: {
            getCachedDownloadPairForStorageFile: () => of(null),
            downloadPairForStorageFileUsingSource: () => of(null)
          }
        },
        { provide: DbxFirebaseAuthService, useValue: { currentUid$: of(TEST_UID) } },
        {
          provide: FormSpaceDocumentStore,
          useValue: {
            filesInSlot$: () => files.asObservable(),
            isEditable$: of(true),
            currentData$: of({ u: TEST_UID }),
            currentId$: of('testformspace'),
            removeFormSpaceFile: () => of(undefined)
          }
        }
      ]
    });

    fixture = TestBed.createComponent(TestDbxFirebaseFormSpaceSlotUploadComponent);
    testComponent = fixture.componentInstance;

    await detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should offer a one-file slot exactly one opening no matter what it holds', async () => {
    expect(testComponent.slot().remainingUploadsSignal()).toBe(1);

    files.next([testFile('cover.pdf')]);
    await detectChanges();

    expect(testComponent.slot().remainingUploadsSignal()).toBe(1);
  });

  it('should offer a folder slot only the room it has left', async () => {
    testComponent.maxFilesSignal.set(4);
    files.next([testFile('a.pdf'), testFile('b.pdf')]);
    await detectChanges();

    expect(testComponent.slot().remainingUploadsSignal()).toBe(2);
  });

  it('should offer a full folder slot no room, and disable its upload button', async () => {
    testComponent.maxFilesSignal.set(2);
    files.next([testFile('a.pdf'), testFile('b.pdf')]);
    await detectChanges();

    expect(testComponent.slot().remainingUploadsSignal()).toBe(0);
    expect(testComponent.slot().uploadDisabledSignal()).toBe(true);
  });
});

@Component({
  template: `
    <dbx-firebase-formspace-slot-upload slot="cover" label="Cover File" [maxFiles]="maxFilesSignal()" [uploadText]="uploadTextSignal()" [replaceText]="replaceTextSignal()"></dbx-firebase-formspace-slot-upload>
  `,
  imports: [DbxFirebaseFormSpaceSlotUploadComponent],
  standalone: true
})
class TestDbxFirebaseFormSpaceSlotUploadComponent {
  readonly slot = viewChild.required(DbxFirebaseFormSpaceSlotUploadComponent);

  readonly maxFilesSignal = signal<Maybe<number>>(undefined);
  readonly uploadTextSignal = signal<Maybe<string>>('Upload Cover');
  readonly replaceTextSignal = signal<Maybe<string>>('Replace Cover');
}
