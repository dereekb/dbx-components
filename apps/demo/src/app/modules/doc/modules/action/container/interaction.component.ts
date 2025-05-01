import { MatDialog } from '@angular/material/dialog';
import { DbxActionDialogFunction, DbxPopoverService, DbxActionPopoverFunction, DbxActionConfirmConfig } from '@dereekb/dbx-web';
import { ChangeDetectorRef, Component, OnDestroy, inject } from '@angular/core';
import { DbxActionContextMachine, safeDetectChanges } from '@dereekb/dbx-core';
import { of, delay, BehaviorSubject, tap } from 'rxjs';
import { DocActionExamplePopoverComponent } from '../component/action.example.popover.component';
import { DocActionExampleDialogComponent } from '../component/action.example.dialog.component';
import { DbxActionAnalyticsConfig, DbxAnalyticsService } from '@dereekb/dbx-analytics';
import { Maybe, ReadableError } from '@dereekb/util';
import { WorkUsingObservable, WorkUsingContext } from '@dereekb/rxjs';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocActionExampleToolsComponent } from '../component/action.example.tool.component';
import { DbxActionDirective } from '@dereekb/dbx-core';
import { DbxActionHandlerDirective } from '@dereekb/dbx-core';
import { DbxActionValueStreamDirective } from '@dereekb/dbx-core';
import { DbxButtonComponent } from '@dereekb/dbx-web';
import { DbxActionButtonDirective } from '@dereekb/dbx-core';
import { DbxActionDisabledDirective } from '@dereekb/dbx-core';
import { DbxActionButtonTriggerDirective } from '@dereekb/dbx-core';
import { DbxActionConfirmDirective } from '@dereekb/dbx-web';
import { DbxActionValueDirective } from '@dereekb/dbx-core';
import { DbxErrorComponent } from '@dereekb/dbx-web';
import { DbxActionErrorDirective } from '@dereekb/dbx-web';
import { DbxActionSnackbarDirective } from '@dereekb/dbx-web';
import { DbxActionSnackbarErrorDirective } from '@dereekb/dbx-web';
import { DbxActionPopoverDirective } from '@dereekb/dbx-web';
import { DbxActionDialogDirective } from '@dereekb/dbx-web';
import { DbxActionAnalyticsDirective } from '@dereekb/dbx-analytics';

@Component({
  templateUrl: './interaction.component.html',
  standalone: true,
  imports: [
    DbxContentContainerDirective,
    DocFeatureLayoutComponent,
    DocFeatureExampleComponent,
    DocActionExampleToolsComponent,
    DbxActionDirective,
    DbxActionHandlerDirective,
    DbxActionValueStreamDirective,
    DbxButtonComponent,
    DbxActionButtonDirective,
    DbxActionDisabledDirective,
    DbxActionButtonTriggerDirective,
    DbxActionConfirmDirective,
    DbxActionValueDirective,
    DbxErrorComponent,
    DbxActionErrorDirective,
    DbxActionSnackbarDirective,
    DbxActionSnackbarErrorDirective,
    DbxActionPopoverDirective,
    DbxActionDialogDirective,
    DbxActionAnalyticsDirective
  ]
})
export class DocActionInteractionComponent implements OnDestroy {
  readonly cdRef = inject(ChangeDetectorRef);
  readonly dbxPopoverService = inject(DbxPopoverService);
  readonly matDialog = inject(MatDialog);

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
