import { DbxActionContextSourceReference } from "@dereekb/dbx-core";
import { Milliseconds, Maybe, ObjectOrGetter, getValueFromObjectOrGetter } from "@dereekb/util";
import { DbxActionSnackbarDisplayConfig, DbxActionSnackbarEvent } from "./action.snackbar";

export interface DbxActionSnackbarGeneratorInput<O = any> {
  event: DbxActionSnackbarEvent<O>;
  undo?: Maybe<DbxActionSnackbarGeneratorUndoInput>;
}

export interface DbxActionSnackbarGeneratorUndoInput {
  duration?: Milliseconds;
  getUndoAction: () => DbxActionContextSourceReference;
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
   * Whether or not to enable undo for this event.
   * 
   * This only configures the display to show undo as the action, but the input must also provide undo configuration.
   */
  enableUndo?: boolean;
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
    const { event, undo } = input;
    const type = event.type;
    const eventConfigObjectOrGetter = config[type];
    const eventConfig = eventConfigObjectOrGetter && getValueFromObjectOrGetter(eventConfigObjectOrGetter);

    let result: Maybe<DbxActionSnackbarDisplayConfig>;

    if (eventConfig) {
      const { enableUndo, undoButtonText } = eventConfig;
      result = {
        button: eventConfig.button,
        message: eventConfig.message,
        snackbar: eventConfig.snackbar
      };

      if (enableUndo && undo) {
        const reference = undo.getUndoAction();

        if (!reference) {
          console.error('Expected action source reference was not provided to undo...');
        } else {
          result.action = {
            button: undoButtonText ?? 'undo',
            reference
          };
        }
      }
    }

    return result;
  };
}
