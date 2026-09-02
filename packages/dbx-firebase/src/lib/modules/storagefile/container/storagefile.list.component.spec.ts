import { ChangeDetectionStrategy, Component, computed, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { DbxListEmptyContentComponent, DbxRouterWebProviderConfig, DbxWebFilePreviewService } from '@dereekb/dbx-web';
import { type ListLoadingState, successResult, type WorkUsingContext } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { DbxFirebaseStorageService } from '../../../storage/firebase.storage.service';
import { DbxFirebaseStorageFileDownloadService } from '../service/storagefile.download.service';
import { DbxFirebaseStorageFileListComponent, type DbxFirebaseStorageFileListEntry, keyForDbxFirebaseStorageFileListEntry } from './storagefile.list.component';

const ACCESSIBLE_STORAGE_FILE_KEY = 'sf/cDoQAQSM9OyBnZi23duw';
const INACCESSIBLE_STORAGE_FILE_KEY = 'sf/aBcDeFgHiJkLmNoPqRsT';

const ENTRIES: DbxFirebaseStorageFileListEntry<string>[] = [
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
];

describe('keyForDbxFirebaseStorageFileListEntry()', () => {
  /**
   * The item component is not recreated while its key holds, so a key that is only the file's identity
   * would pin a row to the state it was first rendered with.
   */
  it('should change when the rendered state of the entry changes', () => {
    const pending = keyForDbxFirebaseStorageFileListEntry({ storageFileKey: ACCESSIBLE_STORAGE_FILE_KEY, name: 'a.pdf', details: 'Checking...' });
    const uploaded = keyForDbxFirebaseStorageFileListEntry({ storageFileKey: ACCESSIBLE_STORAGE_FILE_KEY, name: 'a.pdf', details: 'Uploaded' });

    expect(pending).not.toBe(uploaded);
  });

  it('should hold while nothing rendered changes', () => {
    const entry: DbxFirebaseStorageFileListEntry = { storageFileKey: ACCESSIBLE_STORAGE_FILE_KEY, name: 'a.pdf', details: 'Uploaded' };
    expect(keyForDbxFirebaseStorageFileListEntry(entry)).toBe(keyForDbxFirebaseStorageFileListEntry({ ...entry }));
  });
});

describe('DbxFirebaseStorageFileListComponent', () => {
  let testComponent: TestDbxFirebaseStorageFileListComponent;
  let fixture: ComponentFixture<TestDbxFirebaseStorageFileListComponent>;

  async function detectChanges(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

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

    await detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should render one row per entry', () => {
    expect(fixture.debugElement.queryAll(By.css('dbx-file-list-item')).length).toBe(2);
  });

  it('should give an accessible entry a download button and a remove button', () => {
    const row = fixture.debugElement.queryAll(By.css('dbx-firebase-storagefile-list-view-item'))[0];

    expect(row.query(By.css('dbx-firebase-storagefile-download-button'))).not.toBeNull();
    expect(row.query(By.css('.dbx-firebase-storagefile-list-item-remove'))).not.toBeNull();
  });

  /**
   * The row's value rides on the confirm config rather than a dbxActionValue, which would answer the
   * trigger first and remove the file before the user had confirmed it.
   */
  it('should carry the row value on the confirm config', () => {
    const row = fixture.debugElement.queryAll(By.css('dbx-firebase-storagefile-list-view-item'))[0];
    const confirmConfig = row.componentInstance.removeConfirmConfigSignal();

    expect(confirmConfig.readyValue).toBe('a');
    expect(confirmConfig.confirmText).toBe('Remove');
    expect(confirmConfig.autoConfirm).toBeFalsy();
  });

  it('should withhold both controls from an inaccessible entry', () => {
    const row = fixture.debugElement.queryAll(By.css('dbx-firebase-storagefile-list-view-item'))[1];

    expect(row.query(By.css('dbx-firebase-storagefile-download-button'))).toBeNull();
    expect(row.query(By.css('.dbx-firebase-storagefile-list-item-remove'))).toBeNull();
  });

  it('should still list an inaccessible entry by name', () => {
    const row = fixture.debugElement.queryAll(By.css('dbx-firebase-storagefile-list-view-item'))[1];
    expect(row.nativeElement.textContent).toContain('other.pdf');
  });

  it('should not render a remove button when there is no remove handler', async () => {
    testComponent.removeHandlerSignal.set(undefined);
    await detectChanges();

    expect(fixture.debugElement.query(By.css('.dbx-firebase-storagefile-list-item-remove'))).toBeNull();
    expect(fixture.debugElement.query(By.css('dbx-firebase-storagefile-download-button'))).not.toBeNull();
  });

  it('should not render a remove button when remove buttons are turned off', async () => {
    testComponent.showRemoveButtonSignal.set(false);
    await detectChanges();

    expect(fixture.debugElement.query(By.css('.dbx-firebase-storagefile-list-item-remove'))).toBeNull();
  });

  /**
   * `dbxActionButton` pushes the action's own disabled state onto the button, so a remove button gated only
   * by the button's `disabled` input is re-enabled the moment the action reports itself enabled — leaving a
   * live Remove on a listing that is meant to be read-only.
   */
  it('should render a disabled remove button when removes are disabled', async () => {
    testComponent.removeDisabledSignal.set(true);
    await detectChanges();

    const button: HTMLButtonElement = fixture.debugElement.query(By.css('.dbx-firebase-storagefile-list-item-remove button')).nativeElement;
    expect(button.disabled).toBe(true);
  });

  it('should render an enabled remove button by default', () => {
    const button: HTMLButtonElement = fixture.debugElement.query(By.css('.dbx-firebase-storagefile-list-item-remove button')).nativeElement;
    expect(button.disabled).toBe(false);
  });

  it('should not render a download button when download buttons are turned off', async () => {
    testComponent.showDownloadButtonSignal.set(false);
    await detectChanges();

    expect(fixture.debugElement.query(By.css('dbx-firebase-storagefile-download-button'))).toBeNull();
  });

  it('should show the projected empty content in place of an empty list', async () => {
    testComponent.entriesSignal.set([]);
    await detectChanges();

    expect(fixture.debugElement.queryAll(By.css('dbx-file-list-item')).length).toBe(0);

    const empty: HTMLElement = fixture.debugElement.query(By.css('dbx-list-empty-content')).nativeElement;
    expect(empty.textContent).toContain('Nothing here yet.');
  });
});

@Component({
  template: `
    <dbx-firebase-storagefile-list [state]="stateSignal()" [showDownloadButton]="showDownloadButtonSignal()" [showRemoveButton]="showRemoveButtonSignal()" [removeDisabled]="removeDisabledSignal()" [removeHandler]="removeHandlerSignal()">
      <dbx-list-empty-content empty>Nothing here yet.</dbx-list-empty-content>
    </dbx-firebase-storagefile-list>
  `,
  imports: [DbxFirebaseStorageFileListComponent, DbxListEmptyContentComponent],
  standalone: true
})
class TestDbxFirebaseStorageFileListComponent {
  readonly list = viewChild.required(DbxFirebaseStorageFileListComponent);

  readonly entriesSignal = signal<DbxFirebaseStorageFileListEntry<string>[]>(ENTRIES);
  readonly stateSignal = computed<ListLoadingState<DbxFirebaseStorageFileListEntry<string>>>(() => successResult(this.entriesSignal()));

  readonly showDownloadButtonSignal = signal<Maybe<boolean>>(undefined);
  readonly showRemoveButtonSignal = signal<Maybe<boolean>>(undefined);
  readonly removeDisabledSignal = signal<Maybe<boolean>>(undefined);
  readonly removeHandlerSignal = signal<Maybe<WorkUsingContext<string>>>((_, context) => context.success());
}
