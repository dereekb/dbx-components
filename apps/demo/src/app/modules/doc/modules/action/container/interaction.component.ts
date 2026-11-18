import { MatDialog } from '@angular/material/dialog';
import {
  type DbxActionDialogFunction,
  DbxPopoverService,
  type DbxActionPopoverFunction,
  type DbxActionConfirmConfig,
  DbxContentContainerDirective,
  DbxButtonComponent,
  DbxActionConfirmDirective,
  DbxErrorComponent,
  DbxActionErrorDirective,
  DbxActionSnackbarDirective,
  DbxActionSnackbarErrorDirective,
  DbxActionSnackbarUndoWorkDirective,
  DbxActionPopoverDirective,
  DbxActionDialogDirective
} from '@dereekb/dbx-web';
import { Component, inject, signal } from '@angular/core';
import { DbxActionDirective, DbxActionHandlerDirective, DbxActionValueStreamDirective, DbxActionButtonDirective, DbxActionDisabledDirective, DbxActionButtonTriggerDirective, DbxActionValueDirective, type DbxActionButtonEchoConfig, completeOnDestroy } from '@dereekb/dbx-core';
import { of, delay, BehaviorSubject, map, tap } from 'rxjs';
import { DocActionExamplePopoverComponent } from '../component/action.example.popover.component';
import { DocActionExampleDialogComponent } from '../component/action.example.dialog.component';
import { type DbxActionAnalyticsConfig, type DbxAnalyticsService, DbxActionAnalyticsDirective } from '@dereekb/dbx-analytics';
import { type Maybe, readableError, type ReadableError } from '@dereekb/util';
import { type WorkUsingObservable, type WorkUsingContext } from '@dereekb/rxjs';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocActionExampleToolsComponent } from '../component/action.example.tool.component';
import { DbxForgeActionDialogComponent, dbxForgeTextAreaField } from '@dereekb/dbx-form';

/**
 * An item in the removable list example of the undo snackbar.
 */
interface DocUndoItem {
  readonly id: number;
  readonly name: string;
}

const DOC_UNDO_ITEMS: DocUndoItem[] = [
  { id: 1, name: 'First Item' },
  { id: 2, name: 'Second Item' },
  { id: 3, name: 'Third Item' }
];

@Component({
  templateUrl: './interaction.component.html',
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
    DbxActionSnackbarUndoWorkDirective,
    DbxActionPopoverDirective,
    DbxActionDialogDirective,
    DbxActionAnalyticsDirective
  ]
})
export class DocActionInteractionComponent {
  readonly dbxPopoverService = inject(DbxPopoverService);
  readonly matDialog = inject(MatDialog);

  successValue: any;
  readonly undoValue = signal<Maybe<number>>(undefined);
  readonly undoItems = signal<DocUndoItem[]>(DOC_UNDO_ITEMS);

  readonly confirmConfig: DbxActionConfirmConfig<unknown> = {
    title: 'Confirm Example',
    prompt: 'Example Prompt here.',
    confirmText: 'Customized Confirm',
    cancelText: 'Cancel Customized'
  };

  readonly autoConfirmConfig: DbxActionConfirmConfig<unknown> = {
    autoConfirm: true
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
    onReady: (_service: DbxAnalyticsService, _value) => {
      console.log('Ready');
    },
    onSuccess: (_service: DbxAnalyticsService, _value) => {
      console.log('Success');
    },
    onError: (_service: DbxAnalyticsService, _error: Maybe<ReadableError>) => {
      console.log('Error');
    }
  };

  private _value = completeOnDestroy(new BehaviorSubject<{ test: number }>({ test: 0 }));
  readonly value$ = this._value.asObservable();

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

  // Undo work for the first example. Runs after a short delay, then shows the value that was captured when the action succeeded.
  readonly handleUndo: WorkUsingObservable<number, void> = (value) => {
    return of(value).pipe(
      delay(1000),
      tap((x) => this.undoValue.set(x)),
      map(() => undefined)
    );
  };

  // Undo work that is always refused. The refusal is shown in the snackbar.
  readonly handleRefusedUndo: WorkUsingContext<unknown, void> = (_, instance) => {
    instance.reject(readableError('UNDO_REFUSED', 'This item can no longer be restored.'));
  };

  // Removes the item from the list. The item's row, and the action that removed it, are destroyed on success.
  readonly handleRemoveItem: WorkUsingObservable<DocUndoItem, boolean> = (item) => {
    return of(true).pipe(
      delay(500),
      tap(() => this.undoItems.update((items) => items.filter((x) => x.id !== item.id)))
    );
  };

  // Restores a removed item. Owned by this page so it keeps working after the item's row is destroyed.
  readonly handleRestoreItem: WorkUsingObservable<DocUndoItem, boolean> = (item) => {
    return of(true).pipe(
      delay(500),
      tap(() => this.undoItems.update((items) => (items.some((x) => x.id === item.id) ? items : [...items, item].sort((a, b) => a.id - b.id))))
    );
  };

  resetUndoItems() {
    this.undoItems.set(DOC_UNDO_ITEMS);
  }

  // Getter for the first example's undo value, read when the action succeeds.
  readonly getUndoValue = (): number => this._value.value.test;

  handleOpenPopover: DbxActionPopoverFunction = ({ origin }) => {
    return DocActionExamplePopoverComponent.openPopover(this.dbxPopoverService, { origin });
  };

  handleOpenDialog: DbxActionDialogFunction = () => {
    return DocActionExampleDialogComponent.openDialog(this.matDialog);
  };

  handleOpenFormDialog: DbxActionDialogFunction = () => {
    return DbxForgeActionDialogComponent.openDialogWithForm(this.matDialog, {
      header: 'Form Dialog Example',
      config: {
        fields: [
          dbxForgeTextAreaField({
            key: 'test',
            label: 'Test',
            placeholder: 'Enter test text',
            required: true
          })
        ]
      },
      submitButtonConfig: {
        text: 'Custom Submit Button',
        icon: 'save',
        color: 'warn'
      }
    });
  };
}
