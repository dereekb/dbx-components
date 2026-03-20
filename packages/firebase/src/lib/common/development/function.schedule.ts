import { type, type Type } from 'arktype';

/**
 * Action types for the scheduled function development endpoint.
 */
export type ScheduledFunctionDevelopmentFunctionType = 'list' | 'run';

/**
 * Enum variant of {@link ScheduledFunctionDevelopmentFunctionType} for runtime usage.
 */
export enum ScheduledFunctionDevelopmentFunctionTypeEnum {
  LIST = 'list',
  RUN = 'run'
}

/**
 * Parameters for the scheduled function development endpoint.
 *
 * Use `type: 'list'` to discover available scheduled functions, or `type: 'run'` with a function name to execute one.
 */
export interface ScheduledFunctionDevelopmentFirebaseFunctionParams {
  readonly type: ScheduledFunctionDevelopmentFunctionTypeEnum;
  /**
   * Name of the scheduled function to run (required when type is 'run').
   */
  readonly run?: string;
}

/**
 * ArkType validator for {@link ScheduledFunctionDevelopmentFirebaseFunctionParams}.
 */
export const scheduledFunctionDevelopmentFirebaseFunctionParamsType = type({
  type: "'list' | 'run'",
  'run?': 'string'
}) as Type<ScheduledFunctionDevelopmentFirebaseFunctionParams>;

/**
 * Entry in the list of available scheduled functions returned by the development endpoint.
 */
export class ScheduledFunctionDevelopmentFirebaseFunctionListEntry {
  name!: string;
  // TODO(FUTURE): Add priority to use for choosing execution order, probably with the move to v2 scheduled functions.
}

/**
 * Result returned when listing available scheduled functions.
 */
export interface ScheduledFunctionDevelopmentFirebaseFunctionListResult {
  readonly type: 'list';
  readonly list: ScheduledFunctionDevelopmentFirebaseFunctionListEntry[];
}

/**
 * Result returned after successfully running a scheduled function.
 */
export interface ScheduledFunctionDevelopmentFirebaseFunctionRunResult {
  readonly type: 'run';
  readonly success: true;
}

/**
 * Union of all possible results from the scheduled function development endpoint.
 */
export type ScheduledFunctionDevelopmentFirebaseFunctionResult = ScheduledFunctionDevelopmentFirebaseFunctionListResult | ScheduledFunctionDevelopmentFirebaseFunctionRunResult;

/**
 * Development function specifier used to route requests to the scheduled function endpoint.
 *
 * Used as the `specifier` value in {@link OnCallDevelopmentParams}.
 */
export const SCHEDULED_FUNCTION_DEV_FUNCTION_SPECIFIER = 'scheduledFunction';
