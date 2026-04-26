// MARK: Function
/**
 * Identifies a specific development function endpoint to route requests to.
 *
 * Used in dev/test environments to invoke specific server-side functions by name.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:functions
 */
export type DevelopmentFirebaseFunctionSpecifier = string;

/**
 * Contains a reference to a {@link DevelopmentFirebaseFunctionSpecifier}.
 */
export type DevelopmentFirebaseFunctionSpecifierRef = {
  specifier: DevelopmentFirebaseFunctionSpecifier;
};

// MARK: Params
/**
 * Parameters for calling a development-only Firebase function via the `dev` endpoint.
 *
 * Routes the call to a specific function via `specifier` and passes arbitrary data.
 */
export interface OnCallDevelopmentParams<T = unknown> {
  specifier: string;
  data: T;
}

/**
 * Creates an {@link OnCallDevelopmentParams} envelope for a development function call.
 *
 * @param specifier - the development function to invoke
 * @param data - the call payload
 * @returns an {@link OnCallDevelopmentParams} envelope ready to send to the dev endpoint
 *
 * @example
 * ```ts
 * const params = onCallDevelopmentParams('resetDatabase', { confirm: true });
 * ```
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
export const RUN_DEV_FUNCTION_APP_FUNCTION_KEY = 'dev';
