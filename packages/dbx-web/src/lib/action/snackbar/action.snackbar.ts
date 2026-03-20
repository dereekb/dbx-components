import { type MatSnackBarConfig } from '@angular/material/snack-bar';
import { type DbxActionContextSourceReference } from '@dereekb/dbx-core';
import { type LoadingState, type LoadingStateType } from '@dereekb/rxjs';
import { type Maybe, type Milliseconds } from '@dereekb/util';

/**
 * Identifies the snackbar category, used to select the appropriate default messages.
 */
export type DbxActionSnackbarType = string;

/**
 * Well-known snackbar types that have pre-configured default messages (e.g. "Saving...", "Saved", "Save Failed").
 */
export type DbxActionSnackbarKnownType = 'none' | 'create' | 'save' | 'delete' | 'merge' | 'send' | 'cancel' | 'restore' | 'refresh' | 'read' | 'unread';

/**
 * Represents a snackbar event derived from an action's loading state.
 * Contains the loading state type and, depending on the outcome, either the result value or an error.
 */
export interface DbxActionSnackbarEvent<O = unknown> extends Omit<LoadingState<O>, 'loading'> {
  readonly type: LoadingStateType;
}

/**
 * Configuration for rendering a snackbar popup, including the message, close button, optional action, and Material snackbar settings.
 */
export interface DbxActionSnackbarDisplayConfig<T = unknown, O = unknown> {
  /**
   * Text to be shown on the close button. If action is defined, this is ignored and the action text is used.
   */
  readonly button?: string;
  /**
   * Message to show in the snackbar.
   */
  readonly message?: Maybe<string>;
  /**
   * Additional action that can occur.
   */
  readonly action?: DbxActionSnackbarActionConfig<T, O>;
  /**
   * MatSnackBar configuration
   */
  readonly snackbar?: MatSnackBarConfig;
}

/**
 * Configuration for an interactive action button displayed within the snackbar, such as an "Undo" button.
 */
export interface DbxActionSnackbarActionConfig<T = unknown, O = unknown> {
  /**
   * Action label to display on the button.
   */
  readonly button: string;
  /**
   * Action reference to use.
   *
   * The referred to action is used for triggering and lifecycle.
   */
  readonly reference: DbxActionContextSourceReference<T, O>;
  /**
   * Duration to show the action.
   */
  readonly duration?: Milliseconds;
}
