import { MatDialog } from '@angular/material/dialog';
import { DbxActionDialogFunction, DbxPopoverService, DbxActionPopoverFunction, DbxActionConfirmConfig } from '@dereekb/dbx-web';
import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { DbxActionContextMachine, safeDetectChanges } from '@dereekb/dbx-core';
import { of, delay, BehaviorSubject, tap } from 'rxjs';
import { DocActionExamplePopoverComponent } from '../component/action.example.popover.component';
import { DocActionExampleDialogComponent } from '../component/action.example.dialog.component';
import { DbxActionAnalyticsConfig, DbxAnalyticsService } from '@dereekb/dbx-analytics';
import { Maybe, ReadableError } from '@dereekb/util';
import { WorkUsingObservable, WorkUsingContext } from '@dereekb/rxjs';

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

  readonly analyticsConfig: DbxActionAnalyticsConfig = {
    onTriggered: (service: DbxAnalyticsService) => {
      service.sendEventType('Analytics Trigger Example');
      console.log('Triggered');
    },
    onReady: (service: DbxAnalyticsService, value) => {
      console.log('Ready');
    },
    onSuccess: (service: DbxAnalyticsService, value) => {
      console.log('Success');
    },
    onError: (service: DbxAnalyticsService, error: Maybe<ReadableError>) => {
      console.log('Error');
    }
  };

  private _value = new BehaviorSubject<{ test: number }>({ test: 0 });
  readonly value$ = this._value.asObservable();

  constructor(readonly dbxPopoverService: DbxPopoverService, readonly matDialog: MatDialog, readonly cdRef: ChangeDetectorRef) {}

  ngOnDestroy(): void {
    this._value.complete();
  }

  readonly handleAction: WorkUsingObservable = () => {
    return of(true).pipe(delay(1000));
  };

  readonly handleActionWithError: WorkUsingContext = (_, x) => {
    const error = new Error('This is a simple example error.');
    x.reject(error);
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
