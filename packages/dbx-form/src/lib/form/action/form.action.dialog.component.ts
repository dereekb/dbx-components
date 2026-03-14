import { Component, inject, type OnInit } from '@angular/core';
import { AbstractDialogDirective, DbxDialogContentDirective, DbxDialogContentCloseComponent, DbxActionModule, DbxButtonModule, type DbxButtonStyle } from '@dereekb/dbx-web';
import { type MatDialog, type MatDialogConfig, type MatDialogRef } from '@angular/material/dialog';
import { type Maybe } from '@dereekb/util';
import { asObservableFromGetter, type MaybeObservableOrValueGetter, type ObservableOrValueGetter, type WorkUsingContext } from '@dereekb/rxjs';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { distinctUntilChanged } from 'rxjs';
import { cleanSubscription, type DbxButtonDisplay } from '@dereekb/dbx-core';
import { DbxFormlyContext, provideFormlyContext } from '../../formly/formly.context';
import { DbxFormlyComponent } from '../../formly/formly.form.component';
import { DbxFormSourceDirective } from '../io/form.input.directive';
import { DbxActionFormDirective } from './form.action.directive';

/**
 * Button configuration for the submit button in a {@link DbxFormActionDialogComponent}.
 *
 * Combines display properties (text, icon) with style properties (color, raised, etc.).
 */
export interface DbxFormActionDialogComponentButtonConfig extends DbxButtonDisplay, DbxButtonStyle {}

/**
 * Configuration for opening a {@link DbxFormActionDialogComponent}.
 *
 * Defines the dialog header, form fields, initial values, submit button, and dialog options.
 *
 * @typeParam O - The form value type produced by the dialog.
 */
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
 * A standalone dialog component that renders a dynamic Formly form within a Material dialog.
 *
 * Provides a header, a configurable form, and a submit button wired to an action handler.
 * The dialog closes with the submitted form value on success, or `undefined` if dismissed.
 *
 * Use {@link DbxFormActionDialogComponent.openDialogWithForm} to open the dialog programmatically.
 *
 * @typeParam O - The form value type produced by the dialog.
 */
@Component({
  template: `
    <dbx-dialog-content dbxAction [dbxActionHandler]="handleSubmitValue" class="dbx-dialog-content-with-header">
      <h3 class="dbx-dialog-content-header">{{ header }}</h3>
      <dbx-dialog-content-close (close)="close()"></dbx-dialog-content-close>
      <div>
        <dbx-formly dbxActionForm [dbxFormSource]="initialValue$"></dbx-formly>
        <dbx-button dbxActionButton [buttonDisplay]="submitButtonConfig" [buttonStyle]="submitButtonConfig" [raised]="true"></dbx-button>
      </div>
    </dbx-dialog-content>
  `,
  standalone: true,
  providers: [provideFormlyContext()],
  imports: [DbxDialogContentDirective, DbxActionModule, DbxButtonModule, DbxDialogContentCloseComponent, DbxFormlyComponent, DbxFormSourceDirective, DbxActionFormDirective, DbxFormlyComponent]
})
export class DbxFormActionDialogComponent<O> extends AbstractDialogDirective<O, DbxFormActionDialogComponentConfig<O>> implements OnInit {
  private readonly _fieldsSub = cleanSubscription();

  readonly context = inject(DbxFormlyContext<O>, { self: true });
  readonly fields$ = asObservableFromGetter(this.data.fields);
  readonly initialValue$ = asObservableFromGetter(this.data.initialValue);

  readonly header = this.data.header;

  readonly submitButtonConfig = {
    text: 'Submit',
    ...this.data.submitButtonConfig
  };

  ngOnInit(): void {
    this._fieldsSub.setSub(
      this.fields$.pipe(distinctUntilChanged()).subscribe((fields) => {
        this.context.fields = fields;
      })
    );
  }

  /**
   * Action handler that marks the action as successful and closes the dialog with the submitted value.
   */
  readonly handleSubmitValue: WorkUsingContext<O> = (value, context) => {
    context.success();
    this.close(value);
  };

  /**
   * Opens a new dialog with a dynamic Formly form using the provided configuration.
   *
   * @param matDialog - The Angular Material dialog service.
   * @param config - Configuration for the dialog, including fields, header, and initial value.
   * @returns A reference to the opened dialog, which resolves to the submitted value or `undefined`.
   */
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
