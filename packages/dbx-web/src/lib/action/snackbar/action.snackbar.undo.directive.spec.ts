import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DbxActionButtonDirective, DbxActionContextMachine, type DbxActionContextSourceReference, DbxActionDirective, DbxActionHandlerDirective, DbxActionValueDirective } from '@dereekb/dbx-core';
import { type WorkUsingObservable } from '@dereekb/rxjs';
import { type Getter, type Maybe } from '@dereekb/util';
import { of } from 'rxjs';
import { DbxButtonComponent } from '../../button/button.component';
import { DbxActionSnackbarDirective } from './action.snackbar.directive';
import { DbxActionSnackbarUndoWorkDirective } from './action.snackbar.undo.directive';

@Component({
  template: `
    @if (showItem()) {
      <div dbxAction dbxActionValue [dbxActionHandler]="handleDelete" dbxActionSnackbar dbxActionSnackbarDefault="delete" [dbxActionSnackbarUndo]="explicitUndo()" [dbxActionSnackbarUndoWork]="handleRestore" [dbxActionSnackbarUndoValue]="itemId()" [dbxActionSnackbarUndoDuration]="undoDuration()">
        <dbx-button dbxActionButton text="Delete"></dbx-button>
      </div>
    }
  `,
  imports: [DbxActionDirective, DbxActionValueDirective, DbxActionHandlerDirective, DbxActionButtonDirective, DbxActionSnackbarDirective, DbxActionSnackbarUndoWorkDirective, DbxButtonComponent]
})
class TestUndoItemComponent {
  readonly showItem = signal(true);
  readonly itemId = signal('item-1');
  readonly undoDuration = signal<Maybe<number>>(undefined);
  readonly explicitUndo = signal<Maybe<Getter<DbxActionContextSourceReference>>>(undefined);

  readonly handleDelete: WorkUsingObservable = () => of(true);
  readonly handleRestore = vi.fn<WorkUsingObservable<string, boolean>>((_id: string) => of(true));
}

describe('DbxActionSnackbarUndoWorkDirective', () => {
  let fixture: ComponentFixture<TestUndoItemComponent>;
  let component: TestUndoItemComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestUndoItemComponent],
      providers: [{ provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } }]
    });

    fixture = TestBed.createComponent(TestUndoItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.inject(MatSnackBar).dismiss();
    fixture.destroy();
  });

  function findButton(text: string, root: ParentNode = document): HTMLButtonElement | undefined {
    return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((x) => x.textContent?.includes(text));
  }

  function findSnackbarButton(text: string) {
    return findButton(text, document.querySelector('.cdk-overlay-container') ?? document);
  }

  async function stable() {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function waitFor(check: () => boolean, timeout = 1000) {
    const start = Date.now();

    while (!check() && Date.now() - start < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await stable();
    }
  }

  async function deleteItem() {
    findButton('Delete', fixture.nativeElement)?.click();
    await stable();
    await waitFor(() => findSnackbarButton('Undo') != null);
  }

  it('should restore the item after the item is destroyed', async () => {
    await deleteItem();
    expect(document.querySelector('.cdk-overlay-container')?.textContent).toContain('Deleted');

    component.showItem.set(false); // the item is removed from the list
    await stable();

    findSnackbarButton('Undo')?.click();
    await waitFor(() => component.handleRestore.mock.calls.length > 0);

    expect(component.handleRestore).toHaveBeenCalledTimes(1);
    expect(component.handleRestore.mock.calls[0][0]).toBe('item-1');
  });

  it('should restore the value from when the action succeeded', async () => {
    await deleteItem();

    component.itemId.set('item-2');
    await stable();

    findSnackbarButton('Undo')?.click();
    await waitFor(() => component.handleRestore.mock.calls.length > 0);

    expect(component.handleRestore.mock.calls[0][0]).toBe('item-1');
  });

  it('should destroy the undo action when Undo is never clicked', async () => {
    const destroySpy = vi.spyOn(DbxActionContextMachine.prototype, 'destroy');
    component.undoDuration.set(50);
    await stable();

    await deleteItem();
    await waitFor(() => findSnackbarButton('Undo') == null);

    expect(findSnackbarButton('Undo')).toBeUndefined();
    expect(destroySpy).toHaveBeenCalled();
    expect(component.handleRestore).not.toHaveBeenCalled();
    destroySpy.mockRestore();
  });

  it('should prefer an explicit dbxActionSnackbarUndo', async () => {
    const explicitWork = vi.fn(() => of(true));
    component.explicitUndo.set(() => new DbxActionContextMachine<unknown, unknown>({ oneTimeUse: true, handleValueReady: explicitWork }));
    await stable();

    await deleteItem();
    findSnackbarButton('Undo')?.click();
    await waitFor(() => explicitWork.mock.calls.length > 0);

    expect(explicitWork).toHaveBeenCalledTimes(1);
    expect(component.handleRestore).not.toHaveBeenCalled();
  });
});
