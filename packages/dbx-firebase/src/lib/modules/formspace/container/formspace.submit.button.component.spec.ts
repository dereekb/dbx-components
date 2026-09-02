import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DbxRouterWebProviderConfig } from '@dereekb/dbx-web';
import { type FormSpaceSubmitBlocker, type FormSpaceTypeConfig } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { FormSpaceDocumentStore } from '../store/formspace.document.store';
import { DEFAULT_DBX_FIREBASE_FORM_SPACE_SUBMIT_INCOMPLETE_HINT, DbxFirebaseFormSpaceSubmitButtonComponent, dbxFirebaseFormSpaceSubmitIncompleteHint } from './formspace.submit.button.component';

const TEST_TYPE_CONFIG: FormSpaceTypeConfig = {
  formSpaceType: 'demo_test',
  slots: [
    { slot: 'cover', name: 'Cover File', required: true },
    { slot: 'folder', name: 'Folder', maxFiles: 4 },
    // deliberately unnamed, to cover the fallback
    { slot: 'extras', minFiles: 1 }
  ]
};

/**
 * The hint is a pure function so its wording can be checked without a fixture, and so an app that wants its
 * own has something to read.
 */
function hintFor(blockers: Maybe<FormSpaceSubmitBlocker[]>): Maybe<string> {
  return dbxFirebaseFormSpaceSubmitIncompleteHint({ blockers, config: TEST_TYPE_CONFIG });
}

describe('dbxFirebaseFormSpaceSubmitIncompleteHint()', () => {
  it('should say nothing when nothing is blocking', () => {
    expect(hintFor([])).toBeUndefined();
  });

  it('should name one blocked section', () => {
    expect(hintFor([{ slot: 'cover', reason: 'missing_files' }])).toBe('Finish Cover File before submitting.');
  });

  it('should join two blocked sections with and', () => {
    const blockers: FormSpaceSubmitBlocker[] = [
      { slot: 'cover', reason: 'missing_files' },
      { slot: 'folder', reason: 'missing_files' }
    ];

    expect(hintFor(blockers)).toBe('Finish Cover File and Folder before submitting.');
  });

  it('should comma-separate three blocked sections', () => {
    const blockers: FormSpaceSubmitBlocker[] = [
      { slot: 'cover', reason: 'missing_files' },
      { slot: 'folder', reason: 'missing_files' },
      { slot: 'extras', reason: 'missing_files' }
    ];

    expect(hintFor(blockers)).toBe('Finish Cover File, Folder and extras before submitting.');
  });

  // a slot the type never named still reads as something, because the key says what it holds
  it('should fall back to the slot key for an unnamed slot', () => {
    expect(hintFor([{ slot: 'extras', reason: 'missing_files' }])).toBe('Finish extras before submitting.');
  });

  // the one case the user cannot act on: sending them to a section they already filled in correctly
  it('should say it is still checking when every blocker is a pending validation', () => {
    expect(hintFor([{ slot: 'folder', reason: 'pending_validation' }])).toBe('Still checking the file in Folder.');
  });

  it('should tell the user to act when a rejection sits beside a pending check', () => {
    const blockers: FormSpaceSubmitBlocker[] = [
      { slot: 'cover', reason: 'invalid_file' },
      { slot: 'folder', reason: 'pending_validation' }
    ];

    expect(hintFor(blockers)).toBe('Finish Cover File and Folder before submitting.');
  });

  // the button is disabled either way, and a disabled control with no explanation is worse than a vague one
  it('should fall back to the generic sentence when the blockers are unknown', () => {
    expect(hintFor(undefined)).toBe(DEFAULT_DBX_FIREBASE_FORM_SPACE_SUBMIT_INCOMPLETE_HINT);
    expect(dbxFirebaseFormSpaceSubmitIncompleteHint({ blockers: [{ slot: 'cover', reason: 'missing_files' }], config: undefined })).toBe(DEFAULT_DBX_FIREBASE_FORM_SPACE_SUBMIT_INCOMPLETE_HINT);
  });
});

/**
 * The button mirrors the server's own submit gate. It is a courtesy, not a control — but a courtesy that
 * offers a submit the server would refuse is worse than none, so the default is to withhold it.
 */
describe('DbxFirebaseFormSpaceSubmitButtonComponent', () => {
  let isEditable: BehaviorSubject<boolean>;
  let isComplete: BehaviorSubject<boolean>;
  let submitBlockers: BehaviorSubject<Maybe<FormSpaceSubmitBlocker[]>>;
  let testComponent: TestDbxFirebaseFormSpaceSubmitButtonComponent;
  let fixture: ComponentFixture<TestDbxFirebaseFormSpaceSubmitButtonComponent>;

  async function detectChanges(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    isEditable = new BehaviorSubject<boolean>(true);
    isComplete = new BehaviorSubject<boolean>(false);
    submitBlockers = new BehaviorSubject<Maybe<FormSpaceSubmitBlocker[]>>([{ slot: 'cover', reason: 'missing_files' }]);

    TestBed.configureTestingModule({
      providers: [
        { provide: DbxRouterWebProviderConfig, useValue: { anchorSegueRefComponent: {} } },
        {
          provide: FormSpaceDocumentStore,
          useValue: {
            isEditable$: isEditable.asObservable(),
            isComplete$: isComplete.asObservable(),
            submitBlockers$: submitBlockers.asObservable(),
            formSpaceTypeConfig$: of(TEST_TYPE_CONFIG)
          }
        }
      ]
    });

    fixture = TestBed.createComponent(TestDbxFirebaseFormSpaceSubmitButtonComponent);
    testComponent = fixture.componentInstance;

    await detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function buttonElement(): Maybe<HTMLButtonElement> {
    return fixture.nativeElement.querySelector('button');
  }

  it('should be disabled while the space is incomplete, naming what is holding it up', () => {
    expect(testComponent.button().disabledSignal()).toBe(true);
    expect(testComponent.button().incompleteHintSignal()).toBe('Finish Cover File before submitting.');
  });

  // asserted on the ELEMENT, not just the signal: dbxActionButton pushes the action's isDisabled$ onto the
  // button, and DbxButton resolves that ahead of its own [disabled] input — so disabling the button alone
  // leaves a clickable control the moment the action reports itself idle
  it('should actually disable the rendered button while incomplete', async () => {
    await detectChanges();
    expect(buttonElement()?.disabled).toBe(true);
  });

  it('should enable the rendered button once the space is complete', async () => {
    isComplete.next(true);
    submitBlockers.next([]);
    await detectChanges();

    expect(buttonElement()?.disabled).toBe(false);
  });

  it('should follow the blockers as the user works through them', async () => {
    submitBlockers.next([
      { slot: 'cover', reason: 'missing_files' },
      { slot: 'folder', reason: 'missing_files' }
    ]);
    await detectChanges();
    expect(testComponent.button().incompleteHintSignal()).toBe('Finish Cover File and Folder before submitting.');

    submitBlockers.next([{ slot: 'folder', reason: 'missing_files' }]);
    await detectChanges();
    expect(testComponent.button().incompleteHintSignal()).toBe('Finish Folder before submitting.');
  });

  it('should enable once the space is complete', async () => {
    isComplete.next(true);
    submitBlockers.next([]);
    await detectChanges();

    expect(testComponent.button().disabledSignal()).toBe(false);
    expect(testComponent.button().incompleteHintSignal()).toBeUndefined();
  });

  it('should stay disabled for a space that is no longer editable', async () => {
    isComplete.next(true);
    submitBlockers.next([]);
    isEditable.next(false);
    await detectChanges();

    expect(testComponent.button().disabledSignal()).toBe(true);
  });

  // an already-submitted space is not waiting on the user to finish anything, so telling them to would be
  // an instruction they cannot act on
  it('should not tell an uneditable space to finish its steps', async () => {
    isEditable.next(false);
    await detectChanges();

    expect(testComponent.button().incompleteHintSignal()).toBeUndefined();
  });

  it('should offer the submit anyway when the caller waives the completeness requirement', async () => {
    testComponent.requireCompleteSignal.set(false);
    await detectChanges();

    expect(testComponent.button().disabledSignal()).toBe(false);
    expect(testComponent.button().incompleteHintSignal()).toBeUndefined();
  });

  it('should honor a caller disabling it outright', async () => {
    isComplete.next(true);
    submitBlockers.next([]);
    testComponent.disabledSignal.set(true);
    await detectChanges();

    expect(testComponent.button().disabledSignal()).toBe(true);
  });

  it('should let the caller reword or suppress the hint', async () => {
    testComponent.incompleteHintSignal.set('Upload the cover first.');
    await detectChanges();
    expect(testComponent.button().incompleteHintSignal()).toBe('Upload the cover first.');

    testComponent.incompleteHintSignal.set(false);
    await detectChanges();
    expect(testComponent.button().incompleteHintSignal()).toBeUndefined();
  });
});

@Component({
  template: `
    <dbx-firebase-formspace-submit-button text="Submit Form Space" [requireComplete]="requireCompleteSignal()" [disabled]="disabledSignal()" [incompleteHint]="incompleteHintSignal()"></dbx-firebase-formspace-submit-button>
  `,
  imports: [DbxFirebaseFormSpaceSubmitButtonComponent],
  standalone: true
})
class TestDbxFirebaseFormSpaceSubmitButtonComponent {
  readonly button = viewChild.required(DbxFirebaseFormSpaceSubmitButtonComponent);

  readonly requireCompleteSignal = signal<Maybe<boolean>>(undefined);
  readonly disabledSignal = signal<Maybe<boolean>>(undefined);
  readonly incompleteHintSignal = signal<Maybe<string | boolean>>(undefined);
}
