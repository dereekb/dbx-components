import { DbxActionContextSourceReference } from "@dereekb/dbx-core";
import { Milliseconds, Maybe, GetterOrValue, getValueFromGetter, Getter } from "@dereekb/util";
import { DbxActionSnackbarDisplayConfig, DbxActionSnackbarEvent } from "./action.snackbar";

export interface DbxActionSnackbarGeneratorInput<T = unknown, O = unknown> {
  event: DbxActionSnackbarEvent<O>;
  undo?: Maybe<DbxActionSnackbarGeneratorUndoInput<T, O>>;
}

export type DbxActionSnackbarGeneratorUndoInput<T = unknown, O = unknown> = Getter<DbxActionContextSourceReference<T, O>> | DbxActionSnackbarGeneratorUndoInputConfig<T, O>;

export interface DbxActionSnackbarGeneratorUndoInputConfig<T = unknown, O = unknown> {
  duration?: Milliseconds;
  getUndoAction: Getter<DbxActionContextSourceReference<T, O>>;
}

export type DbxActionSnackbarDisplayConfigGeneratorFunction = <T = unknown, O = unknown>(input: DbxActionSnackbarGeneratorInput<T, O>) => Maybe<DbxActionSnackbarDisplayConfig<T, O>>;

export interface DbxMakeActionSnackbarGeneratorConfiguration {
  idle?: GetterOrValue<DbxMakeActionSnackbarGeneratorEventConfiguration>;
  loading?: GetterOrValue<DbxMakeActionSnackbarGeneratorEventConfiguration>;
  success?: GetterOrValue<DbxMakeActionSnackbarGeneratorEventConfiguration>;
  error?: GetterOrValue<DbxMakeActionSnackbarGeneratorEventConfiguration>;
}

export interface DbxMakeActionSnackbarGeneratorEventConfiguration extends Omit<DbxActionSnackbarDisplayConfig, 'action'> {
  /**
   * Sets the undo action text. If undefined, will default to 'undo'
   */
  undoButtonText?: string;
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
