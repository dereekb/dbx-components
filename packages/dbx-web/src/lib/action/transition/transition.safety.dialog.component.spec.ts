import { DbxActionDirective, DbxActionHandlerDirective, DbxActionValueDirective, DbxRouterTransitionService } from '@dereekb/dbx-core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, inject, ViewContainerRef } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { type WorkUsingObservable } from '@dereekb/rxjs';
import { EMPTY, firstValueFrom, of } from 'rxjs';
import { DbxActionUIRouterTransitionSafetyDialogComponent } from './transition.safety.dialog.component';

// MARK: Test Components
@Component({
  selector: 'dbx-test-transition-safety-dialog-opener',
  template: ``
})
class TestDialogOpenerComponent {
  readonly viewContainerRef = inject(ViewContainerRef);
}

@Component({
  template: `
    <ng-container dbxAction dbxActionValue [dbxActionHandler]="handleAction">
      <dbx-test-transition-safety-dialog-opener></dbx-test-transition-safety-dialog-opener>
    </ng-container>
  `,
  imports: [DbxActionDirective, DbxActionHandlerDirective, DbxActionValueDirective, TestDialogOpenerComponent]
})
class TestTransitionSafetyHostComponent {
  handled = 0;

  readonly handleAction: WorkUsingObservable = () => {
    this.handled += 1;
    return of(true);
  };
}

// MARK: Tests
describe('DbxActionUIRouterTransitionSafetyDialogComponent', () => {
  let fixture: ComponentFixture<TestTransitionSafetyHostComponent>;
  let matDialog: MatDialog;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MatDialogModule, TestTransitionSafetyHostComponent],
      providers: [{ provide: DbxRouterTransitionService, useValue: { transitions$: EMPTY } }]
    });

    fixture = TestBed.createComponent(TestTransitionSafetyHostComponent);
    fixture.detectChanges();
    matDialog = TestBed.inject(MatDialog);
  });

  afterEach(() => {
    matDialog.closeAll();
    fixture.destroy();
  });

  function openDialog() {
    // opened like DbxActionTransitionSafetyDirective, with a view container inside the action context
    const opener: TestDialogOpenerComponent = fixture.debugElement.query(By.directive(TestDialogOpenerComponent)).componentInstance;
    const dialogRef = matDialog.open(DbxActionUIRouterTransitionSafetyDialogComponent, { viewContainerRef: opener.viewContainerRef });
    fixture.detectChanges();
    return dialogRef;
  }

  function findDialogButton(text: string): HTMLButtonElement | undefined {
    return Array.from(document.querySelectorAll<HTMLButtonElement>('.cdk-overlay-container button')).find((x) => x.textContent?.trim() === text);
  }

  it('should show the prompt inside the dialog content', async () => {
    openDialog();
    await fixture.whenStable();

    const content = document.querySelector('.cdk-overlay-container .dbx-dialog-content');
    expect(content?.querySelector('dbx-prompt-confirm')).toBeTruthy();
  });

  it('should show Save Changes in the same row as Stay and Leave without saving', async () => {
    openDialog();
    await fixture.whenStable();

    const row = findDialogButton('Stay')?.closest('dbx-button')?.parentElement;
    expect(row).toBeTruthy();
    expect(findDialogButton('Save Changes')?.closest('dbx-button')?.parentElement).toBe(row);
    expect(findDialogButton('Leave without saving')?.closest('dbx-button')?.parentElement).toBe(row);
  });

  it('should trigger the action when Save Changes is clicked', async () => {
    openDialog();
    await fixture.whenStable();

    findDialogButton('Save Changes')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.handled).toBe(1);
  });

  it('should close with stay when Stay is clicked', async () => {
    const dialogRef = openDialog();
    await fixture.whenStable();

    const result = firstValueFrom(dialogRef.afterClosed());

    findDialogButton('Stay')?.click();
    fixture.detectChanges();

    expect(await result).toBe('stay');
  });
});
