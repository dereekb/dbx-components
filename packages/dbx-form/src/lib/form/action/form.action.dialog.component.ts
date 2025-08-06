import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { AbstractDialogDirective, DbxDialogContentDirective, DbxDialogContentCloseComponent, DbxActionModule, DbxButtonModule, DbxButtonStyle } from '@dereekb/dbx-web';
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { Maybe } from '@dereekb/util';
import { asObservableFromGetter, MaybeObservableOrValueGetter, ObservableOrValueGetter, SubscriptionObject, WorkUsingContext } from '@dereekb/rxjs';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { distinctUntilChanged } from 'rxjs';
import { DbxButtonDisplay } from '@dereekb/dbx-core';
import { DbxFormlyContext, provideFormlyContext } from '../../formly/formly.context';
import { DbxFormlyComponent } from '../../formly/formly.form.component';
import { DbxFormSourceDirective } from '../io/form.input.directive';
import { DbxActionFormDirective } from './form.action.directive';

export interface DbxFormActionDialogComponentButtonConfig extends DbxButtonDisplay, DbxButtonStyle {}

export interface DbxFormActionDialogComponentConfig<O> {
  /**
   * Header text for the dialog.
   */
  readonly header: string;
  /**
   * Used for retrieving the fields to display in the dialog.
   */
  readonly fields: ObservableOrValueGetter<FormlyFieldConfig[]>;
  /**
   * Initial value for the form.
   */
  readonly initialValue?: MaybeObservableOrValueGetter<O>;
  /**
   * Text/Icon for the submit button.
   */
  readonly submitButtonConfig?: DbxFormActionDialogComponentButtonConfig;
  /**
   * Dialog-specific configuration
   */
  readonly dialog?: Omit<MatDialogConfig, 'data'>;
}

/**
 *
 */
@Component({
  template: `
    <dbx-dialog-content dbxAction [dbxActionHandler]="handleSubmitValue" class="dbx-dialog-content-with-header">
      <h3 class="dbx-dialog-content-header">{{ header }}</h3>
      <dbx-dialog-content-close (close)="close()"></dbx-dialog-content-close>
      <div>
        <dbx-formly dbxActionForm [dbxFormSource]="initialValue$"></dbx-formly>
        <dbx-button dbxActionButton [buttonDisplay]="submitButtonConfig" [style]="submitButtonConfig" [raised]="true"></dbx-button>
      </div>
    </dbx-dialog-content>
  `,
  standalone: true,
  providers: [provideFormlyContext()],
  imports: [DbxDialogContentDirective, DbxActionModule, DbxButtonModule, DbxDialogContentCloseComponent, DbxFormlyComponent, DbxFormSourceDirective, DbxActionFormDirective, DbxFormlyComponent]
})
export class DbxFormActionDialogComponent<O> extends AbstractDialogDirective<O, DbxFormActionDialogComponentConfig<O>> implements OnInit, OnDestroy {
  private readonly _fieldsSub = new SubscriptionObject();

  readonly context = inject(DbxFormlyContext<O>, { self: true });
  readonly fields$ = asObservableFromGetter(this.data.fields);
  readonly initialValue$ = asObservableFromGetter(this.data.initialValue);

  readonly header = this.data.header;

  readonly submitButtonConfig = {
    text: 'Submit',
    ...this.data.submitButtonConfig
  };

  override ngOnInit(): void {
    super.ngOnInit();
    this._fieldsSub.subscription = this.fields$.pipe(distinctUntilChanged()).subscribe((fields) => {
      this.context.fields = fields;
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._fieldsSub.destroy();
  }

  readonly handleSubmitValue: WorkUsingContext<O> = (value, context) => {
    context.success();
    this.close(value);
  };

  static openDialogWithForm<O>(matDialog: MatDialog, config: DbxFormActionDialogComponentConfig<O>): MatDialogRef<DbxFormActionDialogComponent<O>, Maybe<O>> {
    const dialogRef = matDialog.open(DbxFormActionDialogComponent<O>, {
      width: '90vw',
      maxHeight: '300px',
      maxWidth: '600px',
      ...config.dialog,
      data: config
    });

    return dialogRef;
  }
}
