import { Expose } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export type ScheduledFunctionDevelopmentFunctionType = 'list' | 'run';

export enum ScheduledFunctionDevelopmentFunctionTypeEnum {
  LIST = 'list',
  RUN = 'run'
}

export class ScheduledFunctionDevelopmentFirebaseFunctionParams {
  @Expose()
  @IsEnum(ScheduledFunctionDevelopmentFunctionTypeEnum)
  type!: ScheduledFunctionDevelopmentFunctionTypeEnum;

  /**
   * Name of function to run.
   */
  @Expose()
  @IsString()
  @IsOptional()
  run?: string;
}

export class ScheduledFunctionDevelopmentFirebaseFunctionListEntry {
  name!: string;
  // TODO(FUTURE): Add priority to use for choosing execution order, probably with the move to v2 scheduled functions.
}

export interface ScheduledFunctionDevelopmentFirebaseFunctionListResult {
  readonly type: 'list';
  readonly list: ScheduledFunctionDevelopmentFirebaseFunctionListEntry[];
}

export interface ScheduledFunctionDevelopmentFirebaseFunctionRunResult {
  readonly type: 'run';
  readonly success: true;
}

export type ScheduledFunctionDevelopmentFirebaseFunctionResult = ScheduledFunctionDevelopmentFirebaseFunctionListResult | ScheduledFunctionDevelopmentFirebaseFunctionRunResult;

/**
 * Key used on the front-end and backend that refers to the specifier for the scheduled functions access.
 */
export const SCHEDULED_FUNCTION_DEV_FUNCTION_SPECIFIER = 'scheduledFunction';
