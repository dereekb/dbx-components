import { type Maybe } from '@dereekb/util';
import { type FirestoreModelType, type ModelFirebaseCrudFunctionSpecifier, type OnCallFunctionType } from '@dereekb/firebase';
import { firebaseServerValidationErrorForSummary } from '../function/context';
import { type OnCallApiDetailsRef, isOnCallHandlerApiDetails, readApiDetails } from './api.details';
import { DEFAULT_ON_CALL_MODEL_FUNCTION_INPUT_VALIDATION, DEFAULT_ON_CALL_MODEL_INPUT_VALIDATION_MODE, isOnCallModelInputValidator, isOnCallModelInputValidatorResultPromise, onCallModelInputValidatorResultSummary, type OnCallModelInputValidationMode } from './input.validator';

/**
 * The app-level input validation config `onCallModel` forwards to the dispatch leaf.
 *
 * The coordinates are carried for the `'log'` line, since the specifier level no longer has the typed params.
 */
export interface OnCallModelInputValidationRequestConfig {
  readonly mode: OnCallModelInputValidationMode;
  readonly call?: Maybe<OnCallFunctionType>;
  readonly modelType?: Maybe<FirestoreModelType>;
  readonly specifier?: Maybe<ModelFirebaseCrudFunctionSpecifier>;
}

/**
 * Request ref carrying the forwarded {@link OnCallModelInputValidationRequestConfig}.
 *
 * Only set by `onCallModel` when its mode is not the default; a request without it is enforced.
 */
export interface OnCallModelInputValidationRequestRef {
  readonly onCallModelInputValidation?: Maybe<OnCallModelInputValidationRequestConfig>;
}

/**
 * Input for {@link validateOnCallModelFunctionInput}.
 */
export interface ValidateOnCallModelFunctionInput {
  /**
   * The handler function about to run. Its handler-level `_apiDetails` supplies the `inputType`.
   */
  readonly handler: Maybe<OnCallApiDetailsRef>;
  /**
   * The request data the handler is about to receive.
   */
  readonly data: unknown;
  /**
   * The request, which may carry the forwarded app-level config.
   */
  readonly request: OnCallModelInputValidationRequestRef;
}

/**
 * Checks request data against the declared `inputType` of the handler about to run.
 *
 * Acts only on handler-level `_apiDetails` whose `inputType` implements Standard Schema (any ArkType `Type`).
 * Specifier-level (aggregated) details are skipped here and checked one level down by `onCallSpecifierHandler`.
 *
 * Missing (`null`/`undefined`) data is checked as `{}`, so an all-optional params type accepts "no params".
 *
 * @param input - The handler, its data and the request.
 * @returns The data to hand the handler: the raw data, or the schema's output for `'parse'` handlers.
 * @throws {HttpsError} A `VALIDATION_ERROR` bad request when the data fails and the check is enforced.
 * @throws {Error} When the validator returns a thenable; the dispatch is synchronous.
 */
export function validateOnCallModelFunctionInput(input: ValidateOnCallModelFunctionInput): unknown {
  const { handler, data, request } = input;
  const details = readApiDetails(handler);
  let result: unknown = data;

  if (details != null && isOnCallHandlerApiDetails(details)) {
    const { inputType, inputValidation = DEFAULT_ON_CALL_MODEL_FUNCTION_INPUT_VALIDATION } = details;
    const requestConfig = request.onCallModelInputValidation;
    const mode = inputValidation === 'parse' ? 'enforce' : (requestConfig?.mode ?? DEFAULT_ON_CALL_MODEL_INPUT_VALIDATION_MODE);

    if (inputValidation !== 'off' && mode !== 'off' && isOnCallModelInputValidator(inputType)) {
      const validation = inputType['~standard'].validate(data ?? {});

      if (isOnCallModelInputValidatorResultPromise(validation)) {
        throw new Error(`The inputType for callModel handler (${describeOnCallModelInputValidationCoordinates(requestConfig)}) returned a promise. inputType validators must be synchronous.`);
      }

      if (validation.issues != null) {
        const summary = onCallModelInputValidatorResultSummary(validation);

        if (mode === 'enforce') {
          throw firebaseServerValidationErrorForSummary(summary);
        }

        console.warn(`callModel input validation failed (${describeOnCallModelInputValidationCoordinates(requestConfig)}):\n${summary}`);
      } else if (inputValidation === 'parse') {
        result = validation.value;
      }
    }
  }

  return result;
}

/**
 * Describes the call/modelType/specifier coordinates for log and error messages.
 *
 * @param config - The forwarded request config, if any.
 * @returns A `call=… modelType=… specifier=…` string, or `unknown coordinates`.
 */
function describeOnCallModelInputValidationCoordinates(config: Maybe<OnCallModelInputValidationRequestConfig>): string {
  return config ? `call=${config.call} modelType=${config.modelType} specifier=${config.specifier ?? '_'}` : 'unknown coordinates';
}
