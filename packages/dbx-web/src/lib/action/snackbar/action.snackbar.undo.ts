import { forwardRef, type Provider, type Type } from '@angular/core';
import { DbxActionContextMachine } from '@dereekb/dbx-core';
import { type Work, type WorkInstance } from '@dereekb/rxjs';
import { type GetterOrValue, getValueFromGetter, type Maybe, type Milliseconds } from '@dereekb/util';
import { type DbxActionSnackbarGeneratorUndoInput, type DbxActionSnackbarGeneratorUndoInputConfig } from './action.snackbar.generator';

/**
 * Source of the undo input for a sibling {@link DbxActionSnackbarDirective}.
 *
 * Provided on the same element as `dbxActionSnackbar` (e.g. by {@link DbxActionSnackbarUndoWorkDirective}) and read once per success event.
 *
 * @typeParam T - The input value type of the original action.
 * @typeParam O - The output result type of the original action.
 */
export abstract class DbxActionSnackbarUndoSource<T = unknown, O = unknown> {
  /**
   * Returns the undo input to offer for the current success event, if any.
   */
  abstract snackbarUndoInput(): Maybe<DbxActionSnackbarGeneratorUndoInput<T, O>>;
}

/**
 * Provides the given type as the {@link DbxActionSnackbarUndoSource} for its element.
 *
 * @param sourceType - The directive or component class that implements {@link DbxActionSnackbarUndoSource}.
 * @returns Providers that register the type as the undo source.
 */
export function provideDbxActionSnackbarUndoSource<S extends DbxActionSnackbarUndoSource>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: DbxActionSnackbarUndoSource,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}

/**
 * Configuration for {@link dbxActionSnackbarUndoWork}.
 *
 * @typeParam V - The value passed to the undo work, such as the id of the item to restore.
 * @typeParam R - The result of the undo work.
 */
export interface DbxActionSnackbarUndoWorkConfig<V = unknown, R = unknown> {
  /**
   * Work that runs when Undo is clicked.
   *
   * The work runs after the item that offered it may already be destroyed, so it must not depend on the item's own injector.
   */
  readonly work: Work<V, R>;
  /**
   * Value passed to the work. Read once, when the original action succeeds.
   */
  readonly value?: Maybe<GetterOrValue<V>>;
  /**
   * How long Undo is offered. Defaults to the snackbar service's `defaultUndoDuration`.
   */
  readonly duration?: Maybe<Milliseconds>;
}

/**
 * Creates an undo config for `[dbxActionSnackbarUndo]` (or a custom snackbar generator) that runs the given work when Undo is clicked.
 *
 * Each success builds a fresh one-time action that does not need an injection context, so it keeps working after the item that offered it
 * is destroyed. The value is read when the original action succeeds. The snackbar destroys the action when it closes, including when Undo
 * is never clicked.
 *
 * @param config - The undo work, its value and the undo window.
 * @returns An undo config whose `getUndoAction` builds the one-time undo action.
 *
 * @dbxUtil
 * @dbxUtilCategory action
 * @dbxUtilKind factory
 * @dbxUtilTags snackbar, undo, action, delete, restore, work
 *
 * @example
 * ```ts
 * readonly undoDelete = dbxActionSnackbarUndoWork<string, void>({
 *   work: (id) => this.store.restoreRequest(id),
 *   value: () => this.item().id
 * });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function dbxActionSnackbarUndoWork<V = unknown, R = unknown>(config: DbxActionSnackbarUndoWorkConfig<V, R>): DbxActionSnackbarGeneratorUndoInputConfig<unknown, R> {
  const { work, value, duration } = config;

  return {
    duration,
    getUndoAction: () => {
      const undoValue = getValueFromGetter(value) as V;

      return new DbxActionContextMachine<unknown, R>({
        oneTimeUse: true,
        // the readied value of the snackbar's undo button is ignored in favor of the captured value
        handleValueReady: (_readied: unknown, instance: WorkInstance<unknown, R>) => work(undoValue, instance as unknown as WorkInstance<V, R>)
      });
    }
  };
}
