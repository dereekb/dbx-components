import { Component, inject, type OnInit } from '@angular/core';
import { AbstractDialogDirective, DbxDialogContentDirective, DbxDialogContentCloseComponent, DbxActionModule, DbxButtonModule, type DbxButtonStyle } from '@dereekb/dbx-web';
import { type MatDialog, type MatDialogConfig, type MatDialogRef } from '@angular/material/dialog';
import { type Maybe } from '@dereekb/util';
import { asObservableFromGetter, type MaybeObservableOrValueGetter, type ObservableOrValueGetter, type WorkUsingContext } from '@dereekb/rxjs';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { distinctUntilChanged } from 'rxjs';
import { cleanSubscription, type DbxButtonDisplay } from '@dereekb/dbx-core';
import { DbxForgeFormContext, provideDbxForgeFormContext } from '../../forge/form/forge.context';
import { DbxForgeFormComponent } from '../../forge/form/forge.component';
import { DbxFormSourceDirective } from '../io/form.input.directive';
import { DbxActionFormDirective } from './form.action.directive';

/**
 * Button configuration for the submit button in a {@link DbxForgeActionDialogComponent}.
 *
 * Combines display properties (text, icon) with style properties (color, raised, etc.).
 */
export interface DbxForgeActionDialogComponentButtonConfig extends DbxButtonDisplay, DbxButtonStyle {}

/**
 * Configuration for opening a {@link DbxForgeActionDialogComponent}.
 *
 * Defines the dialog header, form config, initial values, submit button, and dialog options.
 *
 * @typeParam O - The form value type produced by the dialog.
 */
export interface DbxForgeActionDialogComponentConfig<O> {
  /**
   * Header text for the dialog.
   */
  readonly header: string;
  /**
   * Used for retrieving the ng-forge FormConfig to display in the dialog.
   */
  readonly config: ObservableOrValueGetter<FormConfig>;
  /**
   * Initial value for the form.
   */
  readonly initialValue?: MaybeObservableOrValueGetter<O>;
  /**
   * Text/Icon for the submit button.
   */
  readonly submitButtonConfig?: DbxForgeActionDialogComponentButtonConfig;
  /**
   * Dialog-specific configuration
   */
  readonly dialog?: Omit<MatDialogConfig, 'data'>;
}

/**
 * A standalone dialog component that renders a dynamic ng-forge form within a Material dialog.
 *
 * Provides a header, a configurable form, and a submit button wired to an action handler.
 * The dialog closes with the submitted form value on success, or `undefined` if dismissed.
 *
 * Use {@link DbxForgeActionDialogComponent.openDialogWithForm} to open the dialog programmatically.
 *
 * @typeParam O - The form value type produced by the dialog.
 */
@Component({
  template: `
    <dbx-dialog-content dbxAction [dbxActionHandler]="handleSubmitValue" class="dbx-dialog-content-with-header">
      <h3 class="dbx-dialog-content-header">{{ header }}</h3>
      <dbx-dialog-content-close (close)="close()"></dbx-dialog-content-close>
      <div>
        <dbx-forge dbxActionForm [dbxFormSource]="initialValue$"></dbx-forge>
        <dbx-button dbxActionButton [buttonDisplay]="submitButtonConfig" [buttonStyle]="submitButtonConfig" [raised]="true"></dbx-button>
      </div>
    </dbx-dialog-content>
  `,
  standalone: true,
  providers: [provideDbxForgeFormContext()],
  imports: [DbxDialogContentDirective, DbxActionModule, DbxButtonModule, DbxDialogContentCloseComponent, DbxForgeFormComponent, DbxFormSourceDirective, DbxActionFormDirective]
})
export class DbxForgeActionDialogComponent<O> extends AbstractDialogDirective<O, DbxForgeActionDialogComponentConfig<O>> implements OnInit {
  private readonly _configSub = cleanSubscription();

  readonly context = inject(DbxForgeFormContext<O>, { self: true });
  readonly config$ = asObservableFromGetter(this.data.config);
  readonly initialValue$ = asObservableFromGetter(this.data.initialValue);

  readonly header = this.data.header;

  readonly submitButtonConfig = {
    text: 'Submit',
    ...this.data.submitButtonConfig
  };

  ngOnInit(): void {
    this._configSub.setSub(
      this.config$.pipe(distinctUntilChanged()).subscribe((config) => {
        this.context.config = config;
      })
    );
  }

  /**
   * Action handler that marks the action as successful and closes the dialog with the submitted value.
   *
   * @param value - The submitted form value
   * @param context - The action context used to signal success
   */
  readonly handleSubmitValue: WorkUsingContext<O> = (value, context) => {
    context.success();
    this.close(value);
  };

  /**
   * Opens a new dialog with a dynamic ng-forge form using the provided configuration.
   *
   * @param matDialog - The Angular Material dialog service.
   * @param config - Configuration for the dialog, including form config, header, and initial value.
   * @returns A reference to the opened dialog, which resolves to the submitted value or `undefined`.
   */
  static openDialogWithForm<O>(matDialog: MatDialog, config: DbxForgeActionDialogComponentConfig<O>): MatDialogRef<DbxForgeActionDialogComponent<O>, Maybe<O>> {
    return matDialog.open(DbxForgeActionDialogComponent<O>, {
      width: '90vw',
      maxHeight: '300px',
      maxWidth: '600px',
      ...config.dialog,
      data: config
    });
  }
}
