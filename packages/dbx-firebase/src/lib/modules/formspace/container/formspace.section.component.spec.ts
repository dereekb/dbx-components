import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type FormSpaceFileSlot, FormSpaceFileValidationState, type FormSpaceSlotStatus, type FormSpaceSubmitBlocker } from '@dereekb/firebase';
import { type Maybe, type SlashPathFile } from '@dereekb/util';
import { FormSpaceDocumentStore } from '../store/formspace.document.store';
import { DbxFirebaseFormSpaceSectionComponent, dbxFirebaseFormSpaceSectionBlockerHint } from './formspace.section.component';

const TEST_SLOT = 'cover' as FormSpaceFileSlot;

function status(overrides?: Partial<FormSpaceSlotStatus>): FormSpaceSlotStatus {
  const blockers: FormSpaceSubmitBlocker[] = overrides?.blockers ?? [];

  return {
    slot: TEST_SLOT,
    files: [],
    minFiles: 1,
    maxFiles: 1,
    required: true,
    satisfied: blockers.length === 0,
    complete: false,
    ...overrides,
    blockers
  };
}

function testFile(name: string) {
  return {
    sl: TEST_SLOT,
    sf: `sf_${name}`,
    n: name as SlashPathFile,
    v: FormSpaceFileValidationState.VALID,
    at: new Date()
  };
}

/**
 * The blocker sentence is a pure function so the wording can be checked without a fixture — and so an app
 * that wants its own wording has something to read.
 */
describe('dbxFirebaseFormSpaceSectionBlockerHint()', () => {
  it('should say nothing for a slot with no blockers', () => {
    expect(dbxFirebaseFormSpaceSectionBlockerHint(status({ complete: true }))).toBeUndefined();
  });

  it('should say nothing when the status is unknown', () => {
    expect(dbxFirebaseFormSpaceSectionBlockerHint(undefined)).toBeUndefined();
  });

  // a one-file slot reads as a thing rather than a count
  it('should name the file rather than the count for a one-file slot', () => {
    expect(dbxFirebaseFormSpaceSectionBlockerHint(status({ blockers: [{ slot: TEST_SLOT, reason: 'missing_files' }] }))).toBe('A file is required here.');
  });

  it('should count the shortfall for a folder slot', () => {
    const folder = status({ minFiles: 3, maxFiles: 4, files: [testFile('a.pdf')], blockers: [{ slot: TEST_SLOT, reason: 'missing_files' }] });
    expect(dbxFirebaseFormSpaceSectionBlockerHint(folder)).toBe('2 more files are required here.');
  });

  it('should use the singular for a shortfall of one', () => {
    const folder = status({ minFiles: 2, maxFiles: 4, files: [testFile('a.pdf')], blockers: [{ slot: TEST_SLOT, reason: 'missing_files' }] });
    expect(dbxFirebaseFormSpaceSectionBlockerHint(folder)).toBe('1 more file is required here.');
  });

  it('should tell the user to remove a rejected file', () => {
    expect(dbxFirebaseFormSpaceSectionBlockerHint(status({ blockers: [{ slot: TEST_SLOT, reason: 'invalid_file' }] }))).toBe('A file here was rejected. Remove it to continue.');
  });

  it('should report a validation still in flight', () => {
    expect(dbxFirebaseFormSpaceSectionBlockerHint(status({ blockers: [{ slot: TEST_SLOT, reason: 'pending_validation' }] }))).toBe('Still checking a file here.');
  });
});

describe('DbxFirebaseFormSpaceSectionComponent', () => {
  let slotStatus: BehaviorSubject<Maybe<FormSpaceSlotStatus>>;
  let testComponent: TestDbxFirebaseFormSpaceSectionComponent;
  let fixture: ComponentFixture<TestDbxFirebaseFormSpaceSectionComponent>;

  async function detectChanges(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    slotStatus = new BehaviorSubject<Maybe<FormSpaceSlotStatus>>(undefined);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: FormSpaceDocumentStore,
          useValue: {
            slotStatus$: () => slotStatus.asObservable()
          }
        }
      ]
    });

    fixture = TestBed.createComponent(TestDbxFirebaseFormSpaceSectionComponent);
    testComponent = fixture.componentInstance;

    await detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  // an app that forgot provideDbxFirebaseFormSpaceTypeConfigService() gets no status at all, and a check
  // shown on the strength of nothing is a check the server never agreed to
  it('should stay incomplete while the slot status is unknown', () => {
    expect(testComponent.section().completeSignal()).toBe(false);
  });

  it('should complete once the slot reports complete', async () => {
    slotStatus.next(status({ files: [testFile('cover.pdf')], complete: true }));
    await detectChanges();

    expect(testComponent.section().completeSignal()).toBe(true);
  });

  it('should stay incomplete for a satisfied but empty optional slot', async () => {
    slotStatus.next(status({ minFiles: 0, required: false, satisfied: true, complete: false }));
    await detectChanges();

    expect(testComponent.section().completeSignal()).toBe(false);
  });

  it('should let an explicit complete overrule the slot', async () => {
    slotStatus.next(status({ files: [testFile('cover.pdf')], complete: true }));
    testComponent.completeSignal.set(false);
    await detectChanges();

    expect(testComponent.section().completeSignal()).toBe(false);
  });

  it('should carry a folder slot occupancy in its header', async () => {
    slotStatus.next(status({ minFiles: 0, maxFiles: 4, required: false, files: [testFile('a.pdf'), testFile('b.pdf')], complete: true }));
    await detectChanges();

    expect(testComponent.section().stepHeaderSignal()).toBe('Cover File (2 / 4)');
  });

  it('should leave a one-file slot header alone', async () => {
    slotStatus.next(status({ files: [testFile('cover.pdf')], complete: true }));
    await detectChanges();

    expect(testComponent.section().stepHeaderSignal()).toBe('Cover File');
  });

  it('should show the blocker hint', async () => {
    slotStatus.next(status({ blockers: [{ slot: TEST_SLOT, reason: 'missing_files' }] }));
    await detectChanges();

    expect(testComponent.section().blockerHintSignal()).toBe('A file is required here.');
    expect(testComponent.section().blockerIsWarningSignal()).toBe(false);
  });

  // only a rejection needs the user to undo something; an unfilled required slot is a form in progress
  it('should warn only for a rejected file', async () => {
    slotStatus.next(status({ files: [testFile('cover.pdf')], blockers: [{ slot: TEST_SLOT, reason: 'invalid_file' }] }));
    await detectChanges();

    expect(testComponent.section().blockerIsWarningSignal()).toBe(true);
  });

  it('should report no status for a section with no slot', async () => {
    testComponent.slotSignal.set(undefined);
    await detectChanges();

    expect(testComponent.section().slotStatusSignal()).toBeUndefined();
    expect(testComponent.section().completeSignal()).toBe(false);
  });
});

@Component({
  template: `
    <dbx-firebase-formspace-section [step]="1" [slot]="slotSignal()" header="Cover File" [complete]="completeSignal()"></dbx-firebase-formspace-section>
  `,
  imports: [DbxFirebaseFormSpaceSectionComponent],
  standalone: true
})
class TestDbxFirebaseFormSpaceSectionComponent {
  readonly section = viewChild.required(DbxFirebaseFormSpaceSectionComponent);

  readonly slotSignal = signal<Maybe<FormSpaceFileSlot>>(TEST_SLOT);
  readonly completeSignal = signal<Maybe<boolean>>(undefined);
}
