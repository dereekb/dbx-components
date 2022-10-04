// MARK: Function
/**
 * Used to specify which function to direct requests to.
 */
export type DevelopmentFirebaseFunctionSpecifier = string;

/**
 * Provides a reference to a DevelopmentFirebaseFunctionSpecifier if available.
 */
export type DevelopmentFirebaseFunctionSpecifierRef = {
  specifier: DevelopmentFirebaseFunctionSpecifier;
};

// MARK: Params
export interface OnCallDevelopmentParams<T = unknown> {
  specifier: string;
  data: T;
}

/**
 * Creates an OnCallDevelopmentParams
 *
 * @param modelType
 * @param data
 * @returns
 */
export function onCallDevelopmentParams<T>(specifier: string, data: T): OnCallDevelopmentParams<T> {
  const result: OnCallDevelopmentParams<T> = {
    specifier,
    data
  };

  return result;
}

/**
 * Key used on the front-end and backend that refers to a specific function for creating models.
 */
export const RUN_DEV_FUNCTION_APP_FUNCTION_KEY = 'runDevFunction';
