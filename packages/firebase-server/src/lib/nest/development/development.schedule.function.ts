import { ScheduledFunctionDevelopmentFirebaseFunctionListEntry, ScheduledFunctionDevelopmentFirebaseFunctionParams, ScheduledFunctionDevelopmentFirebaseFunctionResult } from '@dereekb/firebase';
import { forEachKeyValue, cachedGetter } from '@dereekb/util';
import { NestApplicationScheduleConfiguredFunctionMap } from '../function/schedule';
import { OnCallDevelopmentFunction } from './development.function';
import { noRunNameSpecifiedForScheduledFunctionDevelopmentFunction, unknownScheduledFunctionDevelopmentFunctionName, unknownScheduledFunctionDevelopmentFunctionType } from './development.schedule.function.error';

export interface MakeScheduledFunctionDevelopmentFunctionConfig {
  readonly allScheduledFunctions: NestApplicationScheduleConfiguredFunctionMap;
}

export function makeScheduledFunctionDevelopmentFunction(config: MakeScheduledFunctionDevelopmentFunctionConfig): OnCallDevelopmentFunction<unknown, ScheduledFunctionDevelopmentFirebaseFunctionParams, ScheduledFunctionDevelopmentFirebaseFunctionResult> {
  const { allScheduledFunctions } = config;
  const getListValues = cachedGetter(() => {
    const result: ScheduledFunctionDevelopmentFirebaseFunctionListEntry[] = [];

    forEachKeyValue(allScheduledFunctions, {
      forEach: (x) => {
        const [functionName, config] = x;

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
      case 'run':
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
      case 'list':
        return {
          type: 'list',
          list: getListValues()
        };
      default:
        throw unknownScheduledFunctionDevelopmentFunctionType(type);
    }
  };
}
