import * as functions from 'firebase-functions';
import { type INestApplicationContext } from '@nestjs/common';
import { type MakeNestContext, type NestApplicationPromiseGetter } from '../../nest.provider';
import { type NestApplicationScheduleConfiguredFunction, type NestApplicationScheduleConfiguredFunctionFactory, type OnScheduleConfig, type OnScheduleWithNestApplication, type OnScheduleWithNestApplicationRequest, type OnScheduleWithNestContext, setNestContextOnScheduleRequest } from '../schedule';
import { cronExpressionRepeatingEveryNMinutes, type CronExpression, mergeObjects } from '@dereekb/util';
import { type Buildable } from 'ts-essentials';

export function makeOnScheduleWithNestApplicationRequest(nestApplication: INestApplicationContext, scheduleContext?: functions.EventContext): OnScheduleWithNestApplicationRequest<functions.EventContext> {
  return {
    nestApplication,
    scheduleContext
  };
}

// TODO: use functions.pubsub.schedule to configure tasks. Have one that uses the nest context, and one that optionally does not.
// Factory should return a function that can also be called directly for immediate execution.

// MARK: Nest
export type NestApplicationScheduleCloudFunctionFactory<I = unknown> = NestApplicationScheduleConfiguredFunctionFactory<functions.CloudFunction<I>>;

/**
 * Factory function for generating a NestApplicationFunctionFactory for a HttpsFunctions/Runnable firebase function.
 */
export type OnScheduleWithNestApplicationFactory = (schedule: OnScheduleConfig, fn: OnScheduleWithNestApplication<functions.EventContext>) => NestApplicationScheduleCloudFunctionFactory;

/**
 * Creates a factory for generating OnCallWithNestApplication functions.
 *
 * @param nestAppPromiseGetter
 * @returns
 */
export function onScheduleWithNestApplicationFactory(baseSchedule?: OnScheduleConfig): OnScheduleWithNestApplicationFactory {
  return <I, O>(inputSchedule: OnScheduleConfig, fn: OnScheduleWithNestApplication<functions.EventContext>) => {
    const schedule = mergeObjects<OnScheduleConfig>([baseSchedule, inputSchedule]) as OnScheduleConfig;
    let cron: CronExpression;

    if (!schedule.cron) {
      throw new Error('Missing required "cron" variable for configuration.');
    } else if (typeof schedule.cron === 'number') {
      cron = cronExpressionRepeatingEveryNMinutes(schedule.cron);
    } else {
      cron = schedule.cron;
    }

    return (nestAppPromiseGetter: NestApplicationPromiseGetter) => {
      let builder = functions.pubsub.schedule(cron).retryConfig(schedule);

      if (schedule.timezone) {
        builder = builder.timeZone(schedule.timezone);
      }

      const runNow = (scheduleContext?: functions.EventContext) => nestAppPromiseGetter().then((x) => fn(makeOnScheduleWithNestApplicationRequest(x, scheduleContext)));
      const fnn: Buildable<Partial<NestApplicationScheduleConfiguredFunction<functions.CloudFunction<unknown>>>> = builder.onRun(runNow);
      fnn._schedule = schedule;
      fnn._runNow = runNow;
      return fnn as NestApplicationScheduleConfiguredFunction<functions.CloudFunction<unknown>>;
    };
  };
}

/**
 * Factory function for generating HttpsFunctions/Runnable firebase function that returns the value from the input OnCallWithNestContext function.
 */
export type OnScheduleWithNestContextFactory<N> = (schedule: OnScheduleConfig, fn: OnScheduleWithNestContext<N, functions.EventContext>) => NestApplicationScheduleCloudFunctionFactory;

/**
 * Creates a factory for generating OnCallWithNestContext functions with a nest context object that is generated by the input function.
 *
 * @param appFactory
 * @param makeNestContext
 * @returns
 */
export function onScheduleWithNestContextFactory<N>(appFactory: OnScheduleWithNestApplicationFactory, makeNestContext: MakeNestContext<N>): OnScheduleWithNestContextFactory<N> {
  return (schedule: OnScheduleConfig, fn: OnScheduleWithNestContext<N, functions.EventContext>) => appFactory(schedule, (request: OnScheduleWithNestApplicationRequest<functions.EventContext>) => fn(setNestContextOnScheduleRequest(makeNestContext, request)));
}
