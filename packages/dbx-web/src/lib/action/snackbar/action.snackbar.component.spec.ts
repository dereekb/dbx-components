import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Component } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DbxActionContextMachine, DbxActionState } from '@dereekb/dbx-core';
import { type Work, type WorkUsingContext } from '@dereekb/rxjs';
import { readableError } from '@dereekb/util';
import { Subject, filter, first, firstValueFrom, of } from 'rxjs';
import { DbxActionSnackbarService } from './action.snackbar.service';

@Component({
  template: ``
})
class TestSnackbarHostComponent {}

describe('DbxActionSnackbarComponent', () => {
  let fixture: ComponentFixture<TestSnackbarHostComponent>;
  let service: DbxActionSnackbarService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestSnackbarHostComponent],
      providers: [{ provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } }]
    });

    fixture = TestBed.createComponent(TestSnackbarHostComponent);
    fixture.detectChanges();
    service = TestBed.inject(DbxActionSnackbarService);
  });

  afterEach(() => {
    TestBed.inject(MatSnackBar).dismiss();
    fixture.destroy();
  });

  function findSnackbarButton(text: string): HTMLButtonElement | undefined {
    return Array.from(document.querySelectorAll<HTMLButtonElement>('.cdk-overlay-container button')).find((x) => x.textContent?.includes(text));
  }

  async function stable() {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function openUndoSnackbar(work: Work<unknown, unknown>, duration?: number) {
    const reference = new DbxActionContextMachine<unknown, unknown>({ oneTimeUse: true, handleValueReady: work });
    const ref = service.openSnackbar({ message: 'Deleted', action: { button: 'Undo', reference, duration } });
    return { reference, ref };
  }

  function waitForState(reference: DbxActionContextMachine<unknown, unknown>, state: DbxActionState) {
    return firstValueFrom(reference.sourceInstance.actionState$.pipe(filter((x) => x === state)));
  }

  it('should run the undo work when Undo is clicked', async () => {
    const work = vi.fn(() => of(true));
    const { reference } = openUndoSnackbar(work);
    await stable();

    const resolved = waitForState(reference, DbxActionState.RESOLVED);
    findSnackbarButton('Undo')?.click();
    await resolved;
    await stable();

    expect(work).toHaveBeenCalledTimes(1);
    expect(findSnackbarButton('Success')).toBeTruthy();
  });

  it('should show the error and stay open when the undo is rejected', async () => {
    const work: WorkUsingContext = (_, instance) => instance.reject(readableError('REFUSED', 'This item can no longer be restored.'));
    const { reference, ref } = openUndoSnackbar(work, 50);
    await stable();

    let dismissed = false;
    ref.afterDismissed().subscribe(() => (dismissed = true));

    const rejected = waitForState(reference, DbxActionState.REJECTED);
    findSnackbarButton('Undo')?.click();
    await rejected;
    await stable();

    await new Promise((resolve) => setTimeout(resolve, 150));
    await stable();

    const errorElement = document.querySelector('.cdk-overlay-container dbx-error');
    expect(errorElement).toBeTruthy();
    expect(errorElement?.textContent).toContain('This item can no longer be restored.');
    expect(dismissed).toBe(false);
  });

  it('should dismiss itself after the duration and destroy the reference when Undo is never clicked', async () => {
    const { reference, ref } = openUndoSnackbar(() => of(true), 50);
    const destroySpy = vi.spyOn(reference, 'destroy');
    await stable();

    await firstValueFrom(ref.afterDismissed());

    expect(destroySpy).toHaveBeenCalled();
    expect(reference.isShutdown).toBe(true);
  });

  it('should stay open past the duration while the undo is working', async () => {
    const workSubject = new Subject<boolean>();
    const { reference, ref } = openUndoSnackbar(() => workSubject.pipe(first()), 50);
    await stable();

    let dismissed = false;
    ref.afterDismissed().subscribe(() => (dismissed = true));

    const working = waitForState(reference, DbxActionState.WORKING);
    findSnackbarButton('Undo')?.click();
    await working;

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(dismissed).toBe(false);

    const resolved = waitForState(reference, DbxActionState.RESOLVED);
    workSubject.next(true);
    await resolved;
    await stable();

    expect(findSnackbarButton('Success')).toBeTruthy();
  });
});
