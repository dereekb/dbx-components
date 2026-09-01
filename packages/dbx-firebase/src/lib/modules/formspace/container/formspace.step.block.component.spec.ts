import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Maybe } from '@dereekb/util';
import { DEFAULT_DBX_FIREBASE_FORM_SPACE_STEP_BLOCK_COLOR, DEFAULT_DBX_FIREBASE_FORM_SPACE_STEP_BLOCK_COMPLETE_COLOR, DEFAULT_DBX_FIREBASE_FORM_SPACE_STEP_BLOCK_COMPLETE_ICON, DbxFirebaseFormSpaceStepBlockComponent } from './formspace.step.block.component';

/**
 * The badge is the whole point of the component: a complete step supersedes its own number.
 */
describe('DbxFirebaseFormSpaceStepBlockComponent badge', () => {
  let testComponent: TestDbxFirebaseFormSpaceStepBlockComponent;
  let fixture: ComponentFixture<TestDbxFirebaseFormSpaceStepBlockComponent>;

  async function detectChanges(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({});

    fixture = TestBed.createComponent(TestDbxFirebaseFormSpaceStepBlockComponent);
    testComponent = fixture.componentInstance;

    await detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should show no icon while incomplete, leaving the step number', () => {
    expect(testComponent.block().completeSignal()).toBe(false);
    expect(testComponent.block().badgeIconSignal()).toBeUndefined();
    expect(testComponent.block().badgeColorSignal()).toBe(DEFAULT_DBX_FIREBASE_FORM_SPACE_STEP_BLOCK_COLOR);
  });

  it('should swap the number for a check once complete', async () => {
    testComponent.completeSignal.set(true);
    await detectChanges();

    expect(testComponent.block().badgeIconSignal()).toBe(DEFAULT_DBX_FIREBASE_FORM_SPACE_STEP_BLOCK_COMPLETE_ICON);
    expect(testComponent.block().badgeColorSignal()).toBe(DEFAULT_DBX_FIREBASE_FORM_SPACE_STEP_BLOCK_COMPLETE_COLOR);
  });

  it('should keep an incomplete step icon distinct from the complete one', async () => {
    testComponent.iconSignal.set('lock');
    await detectChanges();
    expect(testComponent.block().badgeIconSignal()).toBe('lock');

    testComponent.completeSignal.set(true);
    await detectChanges();
    expect(testComponent.block().badgeIconSignal()).toBe(DEFAULT_DBX_FIREBASE_FORM_SPACE_STEP_BLOCK_COMPLETE_ICON);
  });

  it('should mark the host complete for styling', async () => {
    testComponent.completeSignal.set(true);
    await detectChanges();

    expect(fixture.nativeElement.querySelector('.dbx-firebase-formspace-step-block-complete')).not.toBeNull();
  });
});

@Component({
  template: `
    <dbx-firebase-formspace-step-block [step]="2" header="Cover File" [complete]="completeSignal()" [icon]="iconSignal()"></dbx-firebase-formspace-step-block>
  `,
  imports: [DbxFirebaseFormSpaceStepBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
class TestDbxFirebaseFormSpaceStepBlockComponent {
  readonly block = viewChild.required(DbxFirebaseFormSpaceStepBlockComponent);

  readonly completeSignal = signal<Maybe<boolean>>(undefined);
  readonly iconSignal = signal<Maybe<string>>(undefined);
}
