import { MatSnackBarConfig } from "@angular/material/snack-bar";
import { DbxActionContextSourceReference } from "@dereekb/dbx-core";
import { LoadingState, LoadingStateType } from "@dereekb/rxjs";
import { Maybe } from "@dereekb/util";

export type DbxActionSnackbarType = string;
export type DbxActionSnackbarKnownType = 'none' | 'create' | 'save' | 'delete' | 'merge' | 'send' | 'cancel' | 'restore' | 'refresh' | 'read' | 'unread';

/**
 * ActionSnackbar event. Depending on the type, a value or error is also available.
 */
export interface DbxActionSnackbarEvent<O = unknown> extends Omit<LoadingState<O>, 'loading'> {
  type: LoadingStateType;
}

/**
 * Configuration for the actual snackbar popup.
 */
export interface DbxActionSnackbarDisplayConfig {
  /**
   * Text to be shown on the close button. If action is defined, this is ignored and the action text is used.
   */
  button?: string;
  /**
   * Message to show in the snackbar.
   */
  message?: Maybe<string>;
  /**
   * Additional action that can occur.
   */
  action?: DbxActionSnackbarActionConfig;
  /**
   * MatSnackBar configuration
   */
  snackbar?: MatSnackBarConfig;
}

/**
 * Used for configuring an action on the snackbar component.
 */
export interface DbxActionSnackbarActionConfig {
  /**
   * Action label to display on the button.
   */
  button: string;
  /**
   * Action reference to use.
   * 
   * The referred to action is used for triggering and lifecycle.
   */
  reference: DbxActionContextSourceReference;
  /**
   * Duration to show the action.
   */
  duration?: number;
}
