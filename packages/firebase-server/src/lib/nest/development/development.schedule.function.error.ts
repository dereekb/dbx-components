import { badRequestError } from '../../function/error';

/**
 * Error code used when a 'run' request is missing the target function name.
 */
export const NO_RUN_NAME_SPECIFIED_FOR_SCHEDULED_FUNCTION_DEVELOPMENT_FUNCTION_CODE = 'NO_RUN_NAME_SPECIFIED_FOR_SCHEDULED_FUNCTION_DEVELOPMENT_FUNCTION';

/**
 * Creates a bad-request error for when the caller sends a 'run' command
 * without specifying which scheduled function to execute.
 */
export function noRunNameSpecifiedForScheduledFunctionDevelopmentFunction() {
  return badRequestError({
    code: NO_RUN_NAME_SPECIFIED_FOR_SCHEDULED_FUNCTION_DEVELOPMENT_FUNCTION_CODE,
    message: `Must specify run parameter.`
  });
}

/**
 * Error code used when the requested scheduled function name does not exist in the function map.
 */
export const UNKNOWN_SCHEDULED_FUNCTION_DEVELOPMENT_FUNCTION_NAME_CODE = 'UNKNOWN_SCHEDULED_FUNCTION_DEVELOPMENT_FUNCTION_NAME';

/**
 * Creates a bad-request error for when the requested scheduled function name
 * is not found in the registered function map.
 */
export function unknownScheduledFunctionDevelopmentFunctionName(name: unknown) {
  return badRequestError({
    code: UNKNOWN_SCHEDULED_FUNCTION_DEVELOPMENT_FUNCTION_NAME_CODE,
    message: `Unknown function with name "${name}"`,
    data: {
      name
    }
  });
}

/**
 * Error code used when the request `type` field is neither 'run' nor 'list'.
 */
export const UNKNOWN_SCHEDULED_FUNCTION_DEVELOPMENT_FUNCTION_TYPE_CODE = 'UNKNOWN_SCHEDULED_FUNCTION_DEVELOPMENT_FUNCTION_TYPE';

/**
 * Creates a bad-request error for when the request `type` field does not match
 * any supported operation ('run' or 'list').
 */
export function unknownScheduledFunctionDevelopmentFunctionType(type: unknown) {
  return badRequestError({
    code: UNKNOWN_SCHEDULED_FUNCTION_DEVELOPMENT_FUNCTION_TYPE_CODE,
    message: `Unknown type "${type}"`,
    data: {
      type
    }
  });
}
