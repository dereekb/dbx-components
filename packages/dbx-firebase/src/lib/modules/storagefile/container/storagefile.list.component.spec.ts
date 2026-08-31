import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { DbxRouterWebProviderConfig, DbxWebFilePreviewService } from '@dereekb/dbx-web';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { DbxFirebaseStorageService } from '../../../storage/firebase.storage.service';
import { DbxFirebaseStorageFileDownloadService } from '../service/storagefile.download.service';
import { DbxFirebaseStorageFileListComponent, type DbxFirebaseStorageFileListEntry } from './storagefile.list.component';

const ACCESSIBLE_STORAGE_FILE_KEY = 'sf/cDoQAQSM9OyBnZi23duw';
const INACCESSIBLE_STORAGE_FILE_KEY = 'sf/aBcDeFgHiJkLmNoPqRsT';

describe('DbxFirebaseStorageFileListComponent', () => {
  let testComponent: TestDbxFirebaseStorageFileListComponent;
  let fixture: ComponentFixture<TestDbxFirebaseStorageFileListComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: {} },
        { provide: DbxWebFilePreviewService, useValue: {} },
        { provide: DbxRouterWebProviderConfig, useValue: { anchorSegueRefComponent: {} } },
        {
          provide: DbxFirebaseStorageFileDownloadService,
          useValue: {
            getCachedDownloadPairForStorageFile: () => of(null),
            downloadPairForStorageFileUsingSource: () => of(null)
          }
        },
        {
          provide: DbxFirebaseStorageService,
          useValue: {
            publicDownloadUrl: () => undefined
          }
        }
      ]
    });

    fixture = TestBed.createComponent(TestDbxFirebaseStorageFileListComponent);
    testComponent = fixture.componentInstance;

    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should render one row per entry', () => {
    expect(fixture.debugElement.queryAll(By.css('dbx-file-list-item')).length).toBe(2);
  });

  it('should give an accessible entry a download button and a remove button', () => {
    const row = fixture.debugElement.queryAll(By.css('dbx-file-list-item'))[0];

    expect(row.query(By.css('dbx-firebase-storagefile-download-button'))).not.toBeNull();
    expect(row.query(By.css('.dbx-firebase-storagefile-list-item-remove'))).not.toBeNull();
  });

  it('should withhold both controls from an inaccessible entry', () => {
    const row = fixture.debugElement.queryAll(By.css('dbx-file-list-item'))[1];

    expect(row.query(By.css('dbx-firebase-storagefile-download-button'))).toBeNull();
    expect(row.query(By.css('.dbx-firebase-storagefile-list-item-remove'))).toBeNull();

    const hint: HTMLElement = row.query(By.css('.item-right .dbx-hint')).nativeElement;
    expect(hint.textContent).toContain('Uploaded by someone else.');
  });

  it('should not render a remove button when there is no remove handler', () => {
    testComponent.removeHandlerSignal.set(undefined);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.dbx-firebase-storagefile-list-item-remove'))).toBeNull();
    expect(fixture.debugElement.query(By.css('dbx-firebase-storagefile-download-button'))).not.toBeNull();
  });

  it('should not render a remove button when remove buttons are turned off', () => {
    testComponent.showRemoveButtonSignal.set(false);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.dbx-firebase-storagefile-list-item-remove'))).toBeNull();
  });

  it('should not render a download button when download buttons are turned off', () => {
    testComponent.showDownloadButtonSignal.set(false);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('dbx-firebase-storagefile-download-button'))).toBeNull();
  });

  it('should show the empty text in place of an empty list', () => {
    testComponent.entriesSignal.set([]);
    fixture.detectChanges();

    const empty: HTMLElement = fixture.debugElement.query(By.css('dbx-list-empty-content')).nativeElement;
    expect(empty.textContent).toContain('Nothing here yet.');
  });
});

@Component({
  template: `
    <dbx-firebase-storagefile-list [entries]="entriesSignal()" [showDownloadButton]="showDownloadButtonSignal()" [showRemoveButton]="showRemoveButtonSignal()" [removeHandler]="removeHandlerSignal()" emptyText="Nothing here yet."></dbx-firebase-storagefile-list>
  `,
  imports: [DbxFirebaseStorageFileListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
class TestDbxFirebaseStorageFileListComponent {
  readonly list = viewChild.required(DbxFirebaseStorageFileListComponent);

  readonly entriesSignal = signal<DbxFirebaseStorageFileListEntry<string>[]>([
    {
      storageFileKey: ACCESSIBLE_STORAGE_FILE_KEY,
      name: 'report.pdf',
      details: 'Uploaded',
      value: 'a'
    },
    {
      storageFileKey: INACCESSIBLE_STORAGE_FILE_KEY,
      name: 'other.pdf',
      accessible: false,
      value: 'b'
    }
  ]);

  readonly showDownloadButtonSignal = signal<Maybe<boolean>>(undefined);
  readonly showRemoveButtonSignal = signal<Maybe<boolean>>(undefined);
  readonly removeHandlerSignal = signal<Maybe<WorkUsingContext<string>>>((_, context) => context.success());
}
