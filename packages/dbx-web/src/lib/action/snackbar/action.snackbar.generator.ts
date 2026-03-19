import { type DbxActionContextSourceReference } from '@dereekb/dbx-core';
import { type Configurable, type Milliseconds, type Maybe, type GetterOrValue, getValueFromGetter, type Getter } from '@dereekb/util';
import { type DbxActionSnackbarDisplayConfig, type DbxActionSnackbarEvent } from './action.snackbar';

/**
 * Input passed to a snackbar display config generator function, containing the
 * action event and optional undo configuration.
 */
export interface DbxActionSnackbarGeneratorInput<T = unknown, O = unknown> {
  /** The action snackbar event that triggered the generator. */
  readonly event: DbxActionSnackbarEvent<O>;
  /** Optional undo action configuration, only applied on success events. */
  readonly undo?: Maybe<DbxActionSnackbarGeneratorUndoInput<T, O>>;
}

/**
 * Input for configuring an undo action on the snackbar. Can be either a simple getter
 * that returns the action source reference, or a full config object with duration.
 */
export type DbxActionSnackbarGeneratorUndoInput<T = unknown, O = unknown> = Getter<DbxActionContextSourceReference<T, O>> | DbxActionSnackbarGeneratorUndoInputConfig<T, O>;

/**
 * Extended undo configuration that specifies how long to show the undo action
 * and how to obtain the undo action source reference.
 */
export interface DbxActionSnackbarGeneratorUndoInputConfig<T = unknown, O = unknown> {
  /** How long the undo button remains visible in the snackbar. */
  readonly duration?: Milliseconds;
  /** Factory that returns the action context source reference to trigger for undo. */
  readonly getUndoAction: Getter<DbxActionContextSourceReference<T, O>>;
}

/**
 * Function that produces a snackbar display configuration from a generator input.
 * Returns `undefined` to suppress the snackbar for a given event.
 */
export type DbxActionSnackbarDisplayConfigGeneratorFunction = <T = unknown, O = unknown>(input: DbxActionSnackbarGeneratorInput<T, O>) => Maybe<DbxActionSnackbarDisplayConfig<T, O>>;

/**
 * Configuration for generating snackbar display configs per loading state type.
 * Each property maps a loading state (idle, loading, success, error) to its message configuration.
 */
export interface DbxMakeActionSnackbarGeneratorConfiguration {
  /** Configuration shown when the action is idle. */
  readonly idle?: GetterOrValue<DbxMakeActionSnackbarGeneratorEventConfiguration>;
  /** Configuration shown while the action is loading. */
  readonly loading?: GetterOrValue<DbxMakeActionSnackbarGeneratorEventConfiguration>;
  /** Configuration shown when the action succeeds. */
  readonly success?: GetterOrValue<DbxMakeActionSnackbarGeneratorEventConfiguration>;
  /** Configuration shown when the action fails. */
  readonly error?: GetterOrValue<DbxMakeActionSnackbarGeneratorEventConfiguration>;
}

/**
 * Per-event snackbar configuration that extends the base display config with undo button text.
 * The `action` field from {@link DbxActionSnackbarDisplayConfig} is omitted because undo actions
 * are configured separately via the generator input.
 */
export interface DbxMakeActionSnackbarGeneratorEventConfiguration extends Omit<DbxActionSnackbarDisplayConfig, 'action'> {
  /**
   * Label for the undo button. Defaults to "Undo" if not specified.
   */
  readonly undoButtonText?: string;
}

/**
 * Creates a generator function that produces snackbar display configurations based on
 * the current loading state type. If an undo input is provided, an undo action button
 * is included in the generated config.
 *
 * @param config - Per-state message configurations (idle, loading, success, error).
 * @returns A function that maps generator input to a snackbar display configuration.
 *
 * @example
 * ```typescript
 * const generator = makeDbxActionSnackbarDisplayConfigGeneratorFunction({
 *   loading: { message: 'Processing...' },
 *   success: { message: 'Done!', button: 'Ok' },
 *   error: { message: 'Failed', button: 'X' }
 * });
 * ```
 */
export function makeDbxActionSnackbarDisplayConfigGeneratorFunction(config: DbxMakeActionSnackbarGeneratorConfiguration): DbxActionSnackbarDisplayConfigGeneratorFunction {
  return <T = unknown, O = unknown>(input: DbxActionSnackbarGeneratorInput<T, O>) => {
    const { event, undo: undoInput } = input;
    const type = event.type;
    const eventConfigGetterOrValue = config[type];
    const eventConfig = eventConfigGetterOrValue && getValueFromGetter(eventConfigGetterOrValue);

    let result: Maybe<DbxActionSnackbarDisplayConfig<T, O>>;

    if (eventConfig) {
      const { undoButtonText } = eventConfig;
      const building: Configurable<DbxActionSnackbarDisplayConfig<T, O>> = {
        button: eventConfig.button,
        message: eventConfig.message,
        snackbar: eventConfig.snackbar
      };

      if (undoInput) {
        let reference: DbxActionContextSourceReference<T, O>;

        if (typeof undoInput === 'object') {
          reference = undoInput.getUndoAction();
        } else {
          reference = getValueFromGetter(undoInput);
        }

        if (!reference) {
          console.error('Expected action source reference was not provided to undo...');
        } else {
          building.action = {
            button: undoButtonText ?? 'Undo',
            reference
          };
        }
      }

      result = building;
    }

    return result;
  };
}
