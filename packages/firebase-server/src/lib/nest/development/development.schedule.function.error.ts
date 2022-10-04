import { badRequestError } from '../../function/error';

export const NO_RUN_NAME_SPECIFIED_FOR_SCHEDULED_FUNCTION_DEVELOPMENT_FUNCTION_CODE = 'NO_RUN_NAME_SPECIFIED_FOR_SCHEDULED_FUNCTION_DEVELOPMENT_FUNCTION';

export function noRunNameSpecifiedForScheduledFunctionDevelopmentFunction(type: unknown) {
  return badRequestError({
    code: NO_RUN_NAME_SPECIFIED_FOR_SCHEDULED_FUNCTION_DEVELOPMENT_FUNCTION_CODE,
    message: `Must specify run parameter.`
  });
}

export const UNKNOWN_SCHEDULED_FUNCTION_DEVELOPMENT_FUNCTION_NAME_CODE = 'UNKNOWN_SCHEDULED_FUNCTION_DEVELOPMENT_FUNCTION_NAME';

export function unknownScheduledFunctionDevelopmentFunctionName(name: unknown) {
  return badRequestError({
    code: UNKNOWN_SCHEDULED_FUNCTION_DEVELOPMENT_FUNCTION_NAME_CODE,
    message: `Unknown function with name "${name}"`,
    data: {
      name
    }
  });
}

export const UNKNOWN_SCHEDULED_FUNCTION_DEVELOPMENT_FUNCTION_TYPE_CODE = 'UNKNOWN_SCHEDULED_FUNCTION_DEVELOPMENT_FUNCTION_TYPE';

export function unknownScheduledFunctionDevelopmentFunctionType(type: unknown) {
  return badRequestError({
    code: UNKNOWN_SCHEDULED_FUNCTION_DEVELOPMENT_FUNCTION_TYPE_CODE,
    message: `Unknown type "${type}"`,
    data: {
      type
    }
  });
}
