import { MatDialog } from '@angular/material/dialog';
import { type DbxActionDialogFunction, DbxPopoverService, type DbxActionPopoverFunction, type DbxActionConfirmConfig, DbxContentContainerDirective, DbxButtonComponent, DbxActionConfirmDirective, DbxErrorComponent, DbxActionErrorDirective, DbxActionSnackbarDirective, DbxActionSnackbarErrorDirective, DbxActionPopoverDirective, DbxActionDialogDirective } from '@dereekb/dbx-web';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, type OnDestroy, inject } from '@angular/core';
import { DbxActionContextMachine, safeDetectChanges, DbxActionDirective, DbxActionHandlerDirective, DbxActionValueStreamDirective, DbxActionButtonDirective, DbxActionDisabledDirective, DbxActionButtonTriggerDirective, DbxActionValueDirective, type DbxActionButtonEchoConfig } from '@dereekb/dbx-core';
import { of, delay, BehaviorSubject, tap } from 'rxjs';
import { DocActionExamplePopoverComponent } from '../component/action.example.popover.component';
import { DocActionExampleDialogComponent } from '../component/action.example.dialog.component';
import { type DbxActionAnalyticsConfig, type DbxAnalyticsService, DbxActionAnalyticsDirective } from '@dereekb/dbx-analytics';
import { type Maybe, type ReadableError } from '@dereekb/util';
import { type WorkUsingObservable, type WorkUsingContext } from '@dereekb/rxjs';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocActionExampleToolsComponent } from '../component/action.example.tool.component';
import { DbxFormActionDialogComponent, textAreaField } from '@dereekb/dbx-form';

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
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

  readonly customEchoConfig: DbxActionButtonEchoConfig = {
    onSuccess: { icon: 'thumb_up', color: 'ok', iconOnly: true, duration: 3000 },
    onError: { icon: 'warning', color: 'warn', iconOnly: true, duration: 3000 }
  };

  readonly noEchoConfig: DbxActionButtonEchoConfig = {
    onSuccess: false,
    onError: false
  };

  skipConfirm = false;

  toggleSkipConfirm() {
    this.skipConfirm = !this.skipConfirm;
  }

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
    return new DbxActionContextMachine({
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
  };

  handleOpenPopover: DbxActionPopoverFunction = ({ origin }) => {
    return DocActionExamplePopoverComponent.openPopover(this.dbxPopoverService, { origin });
  };

  handleOpenDialog: DbxActionDialogFunction = () => {
    return DocActionExampleDialogComponent.openDialog(this.matDialog);
  };

  handleOpenFormDialog: DbxActionDialogFunction = () => {
    return DbxFormActionDialogComponent.openDialogWithForm(this.matDialog, {
      header: 'Form Dialog Example',
      fields: [
        textAreaField({
          key: 'test',
          label: 'Test',
          placeholder: 'Enter test text',
          required: true
        })
      ],
      submitButtonConfig: {
        text: 'Custom Submit Button',
        icon: 'save',
        color: 'warn'
      }
    });
  };
}
