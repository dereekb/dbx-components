import { DbxActionContextSourceReference } from "@dereekb/dbx-core";
import { Milliseconds, Maybe, ObjectOrGetter, getValueFromObjectOrGetter, Getter } from "@dereekb/util";
import { DbxActionSnackbarDisplayConfig, DbxActionSnackbarEvent } from "./action.snackbar";

export interface DbxActionSnackbarGeneratorInput<O = any> {
  event: DbxActionSnackbarEvent<O>;
  undo?: Maybe<DbxActionSnackbarGeneratorUndoInput>;
}

export type DbxActionSnackbarGeneratorUndoInput = DbxActionSnackbarGeneratorUndoInputConfig | Getter<DbxActionContextSourceReference>;

export interface DbxActionSnackbarGeneratorUndoInputConfig {
  duration?: Milliseconds;
  getUndoAction: Getter<DbxActionContextSourceReference>;
}

export type DbxActionSnackbarDisplayConfigGeneratorFunction<O = any> = (input: DbxActionSnackbarGeneratorInput<O>) => Maybe<DbxActionSnackbarDisplayConfig>;

export interface DbxMakeActionSnackbarGeneratorConfiguration {
  idle?: ObjectOrGetter<DbxMakeActionSnackbarGeneratorEventConfiguration>;
  loading?: ObjectOrGetter<DbxMakeActionSnackbarGeneratorEventConfiguration>;
  success?: ObjectOrGetter<DbxMakeActionSnackbarGeneratorEventConfiguration>;
  error?: ObjectOrGetter<DbxMakeActionSnackbarGeneratorEventConfiguration>;
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
export function makeDbxActionSnackbarDisplayConfigGeneratorFunction<O = any>(config: DbxMakeActionSnackbarGeneratorConfiguration): DbxActionSnackbarDisplayConfigGeneratorFunction<O> {
  return (input: DbxActionSnackbarGeneratorInput<O>) => {
    const { event, undo: undoInput } = input;
    const type = event.type;
    const eventConfigObjectOrGetter = config[type];
    const eventConfig = eventConfigObjectOrGetter && getValueFromObjectOrGetter(eventConfigObjectOrGetter);

    let result: Maybe<DbxActionSnackbarDisplayConfig>;

    if (eventConfig) {
      const { undoButtonText } = eventConfig;
      result = {
        button: eventConfig.button,
        message: eventConfig.message,
        snackbar: eventConfig.snackbar
      };

      if (undoInput) {
        let reference: DbxActionContextSourceReference;

        if (typeof undoInput === 'object') {
          reference = undoInput.getUndoAction();
        } else {
          reference = getValueFromObjectOrGetter(undoInput);
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
