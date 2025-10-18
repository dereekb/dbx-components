import { type DbxActionContextSourceReference } from '@dereekb/dbx-core';
import { type Milliseconds, type Maybe, type GetterOrValue, getValueFromGetter, type Getter } from '@dereekb/util';
import { type DbxActionSnackbarDisplayConfig, type DbxActionSnackbarEvent } from './action.snackbar';

export interface DbxActionSnackbarGeneratorInput<T = unknown, O = unknown> {
  readonly event: DbxActionSnackbarEvent<O>;
  readonly undo?: Maybe<DbxActionSnackbarGeneratorUndoInput<T, O>>;
}

export type DbxActionSnackbarGeneratorUndoInput<T = unknown, O = unknown> = Getter<DbxActionContextSourceReference<T, O>> | DbxActionSnackbarGeneratorUndoInputConfig<T, O>;

export interface DbxActionSnackbarGeneratorUndoInputConfig<T = unknown, O = unknown> {
  readonly duration?: Milliseconds;
  readonly getUndoAction: Getter<DbxActionContextSourceReference<T, O>>;
}

export type DbxActionSnackbarDisplayConfigGeneratorFunction = <T = unknown, O = unknown>(input: DbxActionSnackbarGeneratorInput<T, O>) => Maybe<DbxActionSnackbarDisplayConfig<T, O>>;

export interface DbxMakeActionSnackbarGeneratorConfiguration {
  readonly idle?: GetterOrValue<DbxMakeActionSnackbarGeneratorEventConfiguration>;
  readonly loading?: GetterOrValue<DbxMakeActionSnackbarGeneratorEventConfiguration>;
  readonly success?: GetterOrValue<DbxMakeActionSnackbarGeneratorEventConfiguration>;
  readonly error?: GetterOrValue<DbxMakeActionSnackbarGeneratorEventConfiguration>;
}

export interface DbxMakeActionSnackbarGeneratorEventConfiguration extends Omit<DbxActionSnackbarDisplayConfig, 'action'> {
  /**
   * Sets the undo action text. If undefined, will default to 'undo'
   */
  readonly undoButtonText?: string;
}

/**
 * Creates a DbxActionSnackbarDisplayConfigGeneratorFunction from the input config.
 *
 * @param config
 * @returns
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
      result = {
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
          result.action = {
            button: undoButtonText ?? 'Undo',
            reference
          };
        }
      }
    }

    return result;
  };
}
