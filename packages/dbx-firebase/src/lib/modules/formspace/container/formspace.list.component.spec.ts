import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DbxListEmptyContentComponent, DbxRouterWebProviderConfig } from '@dereekb/dbx-web';
import { type ListLoadingState, successResult } from '@dereekb/rxjs';
import { AppFormSpaceTypeConfigService, type FormSpace, FormSpaceProcessingState, FormSpaceState, type FormSpaceType } from '@dereekb/firebase';
import { DbxFirebaseFormSpaceListComponent, type DbxFirebaseFormSpaceListValue, dbxFirebaseFormSpaceListItemStatus, keyForDbxFirebaseFormSpaceListValue } from './formspace.list.component';

const TEST_FORM_SPACE_TYPE = 'demo_test' as FormSpaceType;
const SUBMITTED_AT = new Date('2024-01-02T00:00:00.000Z');
const COMPLETED_AT = new Date('2024-01-03T00:00:00.000Z');

function formSpace(overrides?: Partial<FormSpace>): FormSpace {
  return {
    t: TEST_FORM_SPACE_TYPE,
    s: FormSpaceState.DRAFT,
    ps: FormSpaceProcessingState.INIT_OR_NONE,
    u: 'uid',
    uc: 0,
    fi: 0,
    f: [],
    cat: new Date('2024-01-01T00:00:00.000Z'),
    uat: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides
  };
}

function listValue(id: string, overrides?: Partial<FormSpace>): DbxFirebaseFormSpaceListValue {
  return { ...formSpace(overrides), id, key: `fsp/${id}` };
}

/**
 * The wording is a pure function so a listing can be checked without a fixture — and so an app that wants
 * its own has the verdict without the row.
 */
describe('dbxFirebaseFormSpaceListItemStatus()', () => {
  it('should read a draft by when it was last edited', () => {
    const status = dbxFirebaseFormSpaceListItemStatus(formSpace());

    expect(status.label).toBe('Draft, last edited');
    expect(status.date).toEqual(formSpace().uat);
    expect(status.cssClass).toBe('dbx-hint');
  });

  it('should read a submitted space that has not been picked up by its submission date', () => {
    const status = dbxFirebaseFormSpaceListItemStatus(formSpace({ s: FormSpaceState.SUBMITTED, ps: FormSpaceProcessingState.QUEUED_FOR_PROCESSING, sat: SUBMITTED_AT }));

    expect(status.label).toBe('Queued for processing, submitted');
    expect(status.date).toBe(SUBMITTED_AT);
  });

  it('should read a space being processed by its submission date', () => {
    const status = dbxFirebaseFormSpaceListItemStatus(formSpace({ s: FormSpaceState.SUBMITTED, ps: FormSpaceProcessingState.PROCESSING, sat: SUBMITTED_AT }));

    expect(status.label).toBe('Processing, submitted');
    expect(status.date).toBe(SUBMITTED_AT);
  });

  it('should read a processed space by when its processing concluded', () => {
    const status = dbxFirebaseFormSpaceListItemStatus(formSpace({ s: FormSpaceState.SUBMITTED, ps: FormSpaceProcessingState.SUCCESS, sat: SUBMITTED_AT, cpat: COMPLETED_AT }));

    expect(status.label).toBe('Processed');
    expect(status.date).toBe(COMPLETED_AT);
    expect(status.icon).toBe('check_circle');
  });

  it('should name an archived space as archived rather than processed', () => {
    const status = dbxFirebaseFormSpaceListItemStatus(formSpace({ s: FormSpaceState.ARCHIVED, ps: FormSpaceProcessingState.SUCCESS, sat: SUBMITTED_AT, cpat: COMPLETED_AT }));
    expect(status.label).toBe('Archived');
  });

  // a failure is the one outcome the owner may have to act on, so it is the one that is marked
  it('should mark a failed submission', () => {
    const status = dbxFirebaseFormSpaceListItemStatus(formSpace({ s: FormSpaceState.SUBMITTED, ps: FormSpaceProcessingState.FAILED, sat: SUBMITTED_AT, cpat: COMPLETED_AT }));

    expect(status.label).toBe('Processing failed');
    expect(status.cssClass).toBe('dbx-warn');
  });

  it('should mark a space the sweep retired', () => {
    const status = dbxFirebaseFormSpaceListItemStatus(formSpace({ s: FormSpaceState.EXPIRED }));

    expect(status.label).toBe('Expired');
    expect(status.cssClass).toBe('dbx-warn');
  });

  // the submission date is what a submitted space has; the completion date is what it gains later
  it('should fall back to the submission date while a concluded space has no completion date', () => {
    const status = dbxFirebaseFormSpaceListItemStatus(formSpace({ s: FormSpaceState.SUBMITTED, ps: FormSpaceProcessingState.SUCCESS, sat: SUBMITTED_AT }));
    expect(status.date).toBe(SUBMITTED_AT);
  });
});

describe('keyForDbxFirebaseFormSpaceListValue()', () => {
  /**
   * The item component is not recreated while its key holds, so a key that is only the space's identity
   * would pin a row to the state it was first rendered with — a submitted space still reading "Draft".
   */
  it('should change when the rendered state of the space changes', () => {
    const draft = listValue('a');
    const submitted = { ...draft, s: FormSpaceState.SUBMITTED, ps: FormSpaceProcessingState.QUEUED_FOR_PROCESSING, sat: SUBMITTED_AT };

    expect(keyForDbxFirebaseFormSpaceListValue(draft)).not.toBe(keyForDbxFirebaseFormSpaceListValue(submitted));
  });

  it('should hold while nothing rendered changes', () => {
    const value = listValue('a');
    expect(keyForDbxFirebaseFormSpaceListValue(value)).toBe(keyForDbxFirebaseFormSpaceListValue({ ...value }));
  });
});

describe('DbxFirebaseFormSpaceListComponent', () => {
  let testComponent: TestDbxFirebaseFormSpaceListComponent;
  let fixture: ComponentFixture<TestDbxFirebaseFormSpaceListComponent>;

  async function detectChanges(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: DbxRouterWebProviderConfig, useValue: { anchorSegueRefComponent: {} } },
        {
          provide: AppFormSpaceTypeConfigService,
          useValue: {
            registeredConfigForFormSpaceType: (formSpaceType: FormSpaceType) => (formSpaceType === TEST_FORM_SPACE_TYPE ? { formSpaceType, name: 'Demo Test Form', slots: [] } : undefined)
          }
        }
      ]
    });

    fixture = TestBed.createComponent(TestDbxFirebaseFormSpaceListComponent);
    testComponent = fixture.componentInstance;

    await detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should render one row per space', () => {
    expect(fixture.debugElement.queryAll(By.css('dbx-firebase-formspace-list-view-item')).length).toBe(2);
  });

  it('should name a space by its own display name', () => {
    const row = fixture.debugElement.queryAll(By.css('dbx-firebase-formspace-list-view-item'))[0];
    expect(row.nativeElement.textContent).toContain('My Draft');
  });

  // a space created without a display name should still read as the kind of form it is
  it('should fall back to the name the type registered', () => {
    const row = fixture.debugElement.queryAll(By.css('dbx-firebase-formspace-list-view-item'))[1];
    expect(row.nativeElement.textContent).toContain('Demo Test Form');
  });

  it('should say where each space has got to', () => {
    const rows = fixture.debugElement.queryAll(By.css('dbx-firebase-formspace-list-view-item'));

    expect(rows[0].nativeElement.textContent).toContain('Draft, last edited');
    expect(rows[1].nativeElement.textContent).toContain('Processed');
  });

  it('should show the projected empty content in place of an empty list', async () => {
    testComponent.formSpacesSignal.set([]);
    await detectChanges();

    expect(fixture.debugElement.queryAll(By.css('dbx-firebase-formspace-list-view-item')).length).toBe(0);

    const empty: HTMLElement = fixture.debugElement.query(By.css('dbx-list-empty-content')).nativeElement;
    expect(empty.textContent).toContain('No form spaces yet.');
  });
});

@Component({
  template: `
    <dbx-firebase-formspace-list [state]="stateSignal()">
      <dbx-list-empty-content empty>No form spaces yet.</dbx-list-empty-content>
    </dbx-firebase-formspace-list>
  `,
  imports: [DbxFirebaseFormSpaceListComponent, DbxListEmptyContentComponent],
  standalone: true
})
class TestDbxFirebaseFormSpaceListComponent {
  readonly formSpacesSignal = signal<DbxFirebaseFormSpaceListValue[]>([listValue('a', { n: 'My Draft' }), listValue('b', { s: FormSpaceState.SUBMITTED, ps: FormSpaceProcessingState.SUCCESS, sat: SUBMITTED_AT, cpat: COMPLETED_AT })]);

  readonly stateSignal = computed<ListLoadingState<DbxFirebaseFormSpaceListValue>>(() => successResult(this.formSpacesSignal()));
}
