import { MatDialog } from '@angular/material/dialog';
import { DbxActionDialogFunction, DbxPopoverService, DbxActionPopoverFunction, DbxActionConfirmConfig, DbxPromptConfirmTypes } from '@dereekb/dbx-web';
import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { DbxActionContextMachine, HandleActionFunction, safeDetectChanges } from '@dereekb/dbx-core';
import { of, delay, BehaviorSubject, tap } from 'rxjs';
import { DocActionExamplePopoverComponent } from '../component/action.example.popover.form.component';
import { DocActionExampleDialogComponent } from '../component/action.example.dialog.component';

@Component({
  templateUrl: './interaction.component.html'
})
export class DocActionInteractionComponent implements OnDestroy {
  successValue: any;
  undoValue: any;

  readonly confirmConfig: DbxActionConfirmConfig<unknown> = {
    title: 'Confirm Example',
    prompt: 'Example Prompt here.',
    confirmText: 'Customized Confirm',
    cancelText: 'Cancel Customized'
  };

  private _value = new BehaviorSubject<{ test: number }>({ test: 0 });
  readonly value$ = this._value.asObservable();

  constructor(readonly dbxPopoverService: DbxPopoverService, readonly matDialog: MatDialog, readonly cdRef: ChangeDetectorRef) {}

  ngOnDestroy(): void {
    this._value.complete();
  }

  readonly handleAction: HandleActionFunction = () => {
    return of(true).pipe(delay(1000));
  };

  onActionSuccess = (value: any) => {
    this.successValue = value;
  };

  resetValue() {
    this._value.next({ test: this._value.value.test + 1 });
  }

  getUndoAction = () => {
    const instance = new DbxActionContextMachine({
      oneTimeUse: true,
      handleValueReady: (value: any) => {
        safeDetectChanges(this.cdRef);
        return of(0).pipe(
          delay(1000),
          tap(() => {
            this.undoValue = value;
          })
        );
      }
    });

    return instance;
  };

  handleOpenPopover: DbxActionPopoverFunction = ({ origin }) => {
    return DocActionExamplePopoverComponent.openPopover(this.dbxPopoverService, { origin });
  };

  handleOpenDialog: DbxActionDialogFunction = () => {
    return DocActionExampleDialogComponent.openDialog(this.matDialog);
  };
}
