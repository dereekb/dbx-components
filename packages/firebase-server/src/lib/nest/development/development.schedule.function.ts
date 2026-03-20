import { type ScheduledFunctionDevelopmentFirebaseFunctionListEntry, type ScheduledFunctionDevelopmentFirebaseFunctionParams, type ScheduledFunctionDevelopmentFirebaseFunctionResult, ScheduledFunctionDevelopmentFunctionTypeEnum } from '@dereekb/firebase';
import { forEachKeyValue, cachedGetter } from '@dereekb/util';
import { type NestApplicationScheduleConfiguredFunctionMap } from '../function/schedule';
import { type OnCallDevelopmentFunction } from './development.function';
import { noRunNameSpecifiedForScheduledFunctionDevelopmentFunction, unknownScheduledFunctionDevelopmentFunctionName } from './development.schedule.function.error';

/**
 * Configuration for {@link makeScheduledFunctionDevelopmentFunction}.
 */
export interface MakeScheduledFunctionDevelopmentFunctionConfig {
  /**
   * The complete map of registered scheduled functions that can be triggered manually.
   */
  readonly allScheduledFunctions: NestApplicationScheduleConfiguredFunctionMap;
}

/**
 * Creates a development function that allows manually triggering or listing scheduled functions.
 *
 * Supports two operation types:
 * - `'run'` - Executes a scheduled function by name via its `_runNow()` method.
 * - `'list'` - Returns a list of all available scheduled function names.
 *
 * This is intended for development and testing environments where you need to
 * trigger scheduled jobs on demand without waiting for their cron schedule.
 *
 * @param config - Provides the map of all scheduled functions available for manual execution.
 * @returns A development function handler compatible with {@link OnCallDevelopmentFunctionMap}.
 *
 * @example
 * ```typescript
 * const scheduleDev = makeScheduledFunctionDevelopmentFunction({
 *   allScheduledFunctions: myScheduledFunctions
 * });
 *
 * // Register it in the dev function map:
 * const devFunctions: OnCallDevelopmentFunctionMap<MyContext> = {
 *   [SCHEDULED_FUNCTION_DEV_FUNCTION_SPECIFIER]: scheduleDev
 * };
 * ```
 */
export function makeScheduledFunctionDevelopmentFunction(config: MakeScheduledFunctionDevelopmentFunctionConfig): OnCallDevelopmentFunction<unknown, ScheduledFunctionDevelopmentFirebaseFunctionParams, ScheduledFunctionDevelopmentFirebaseFunctionResult> {
  const { allScheduledFunctions } = config;
  const getListValues = cachedGetter(() => {
    const result: ScheduledFunctionDevelopmentFirebaseFunctionListEntry[] = [];

    forEachKeyValue(allScheduledFunctions, {
      forEach: (x) => {
        const [functionName] = x;

        result.push({
          name: functionName.toString()
        });
      }
    });

    return result;
  });

  return async (request) => {
    const { data } = request;
    const { type } = data;

    switch (type) {
      case ScheduledFunctionDevelopmentFunctionTypeEnum.RUN: {
        const targetRunName = data.run;

        if (!targetRunName) {
          throw noRunNameSpecifiedForScheduledFunctionDevelopmentFunction();
        }

        const targetFunction = allScheduledFunctions[targetRunName];

        if (!targetFunction) {
          throw unknownScheduledFunctionDevelopmentFunctionName(targetRunName);
        }

        try {
          await targetFunction._runNow();
        } catch (e) {
          console.error(`Failed manually running task "${targetRunName}".`, e);
          throw e;
        }

        return {
          type: 'run',
          success: true
        };
      }
      case ScheduledFunctionDevelopmentFunctionTypeEnum.LIST:
        return {
          type: 'list',
          list: getListValues()
        };
    }
  };
}
