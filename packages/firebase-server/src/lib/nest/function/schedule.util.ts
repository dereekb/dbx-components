import { AsyncDecisionFunction, CronExpression, cronExpressionRepeatingEveryNMinutes, mapObjectMap, MappedObjectMap, Minutes } from '@dereekb/util';
import { scheduleJob, Job, RecurrenceRule } from 'node-schedule';
import { NestApplicationScheduleConfiguredFunction } from './schedule';

// MARK: Utilities
export type NestApplicationScheduleConfiguredFunctionMap = {
  [key: string]: NestApplicationScheduleConfiguredFunction;
};

export type NestApplicationScheduleConfiguredFunctionJobMap<T extends NestApplicationScheduleConfiguredFunctionMap> = MappedObjectMap<T, Job>;

export type ScheduledRecurrenceValue = Minutes | CronExpression | RecurrenceRule;

/**
 * Configuration for initEnvironmentForScheduleConfiguredFunctions()
 */
export interface InitEnvironmentForScheduleConfiguredFunctionsConfig<T extends NestApplicationScheduleConfiguredFunctionMap = NestApplicationScheduleConfiguredFunctionMap> {
  /**
   * Function to check whether or not to enable the dev schedule.
   *
   * If not provided, then the initialization is skipped.
   */
  checkEnabled?: AsyncDecisionFunction<void>;
  /**
   * Runs all cron jobs at the given interval in minutes.
   */
  overrideAll?: ScheduledRecurrenceValue;
  /**
   * Override specific function's times.
   */
  override?: Partial<MappedObjectMap<T, ScheduledRecurrenceValue>>;
  /**
   * Runs all jobs that have a readable schedule on the given
   */
  scheduleCron?: ScheduledRecurrenceValue;
}

/**
 * Initializes the current environment to handle the input scheduled functions.
 *
 * - For production, nothing will be configured.
 * - For development,
 *
 * @param input
 * @returns
 */
export function initEnvironmentForScheduleConfiguredFunctions<T extends NestApplicationScheduleConfiguredFunctionMap>(input: T, config: InitEnvironmentForScheduleConfiguredFunctionsConfig): T {
  const { checkEnabled } = config;

  if (checkEnabled != null) {
    setTimeout(async () => {
      const isEnabled = await checkEnabled();
      if (isEnabled) {
        console.log('Initializing scheduled functions for development environment...');
        initDevelopmentEnvironmentForScheduleConfiguredFunctions(input, config);
      }
    }, 100);
  }

  return input;
}

/**
 * Initializes jobs for each scheduled task in the input map.
 *
 * @param input
 * @param config
 * @returns
 */
export function initDevelopmentEnvironmentForScheduleConfiguredFunctions<T extends NestApplicationScheduleConfiguredFunctionMap>(input: T, config: InitEnvironmentForScheduleConfiguredFunctionsConfig<T>): NestApplicationScheduleConfiguredFunctionJobMap<T> {
  const { overrideAll, override = {} as Partial<MappedObjectMap<T, ScheduledRecurrenceValue>>, scheduleCron } = config;

  const result = mapObjectMap(input, (entry, key) => {
    const schedule = entry._schedule;
    let cron: ScheduledRecurrenceValue = overrideAll ?? override[key] ?? schedule.cron ?? scheduleCron ?? 1;

    if (typeof cron === 'number') {
      cron = cronExpressionRepeatingEveryNMinutes(cron);
    }

    return scheduleJob(cron, entry._runNow);
  });

  return result;
}
