import { type GlobalOptions } from 'firebase-functions/v2/options';
import { scheduler } from 'firebase-functions/v2';
import { type INestApplicationContext } from '@nestjs/common';
import { type MakeNestContext, type NestApplicationPromiseGetter } from '../../nest.provider';
import { type NestApplicationScheduleConfiguredFunction, type NestApplicationScheduleConfiguredFunctionFactory, type OnScheduleConfig, type OnScheduleWithNestApplication, type OnScheduleWithNestApplicationRequest, type OnScheduleWithNestContext, setNestContextOnScheduleRequest } from '../schedule';
import { type Building, cronExpressionRepeatingEveryNMinutes, mergeObjects } from '@dereekb/util';
import { type Buildable } from 'ts-essentials';
import { type ScheduleOptions } from 'firebase-functions/v2/scheduler';

export type OnScheduleConfigWithGlobalOptions = OnScheduleConfig & GlobalOptions;

export function makeOnScheduleHandlerWithNestApplicationRequest(nestApplication: INestApplicationContext, scheduleContext?: scheduler.ScheduledEvent): OnScheduleWithNestApplicationRequest<scheduler.ScheduledEvent> {
  return {
    nestApplication,
    scheduleContext
  };
}

// MARK: Nest
export type NestApplicationScheduleFunctionFactory = NestApplicationScheduleConfiguredFunctionFactory<scheduler.ScheduleFunction>;

/**
 * Factory function for generating a NestApplicationFunctionFactory for a HttpsFunctions/Runnable firebase function.
 */
export type OnScheduleHandlerWithNestApplicationFactory = (schedule: OnScheduleConfig, fn: OnScheduleWithNestApplication<scheduler.ScheduledEvent>) => NestApplicationScheduleFunctionFactory;

/**
 * Creates a factory for generating OnCallWithNestApplication functions.
 *
 * @param nestAppPromiseGetter
 * @returns
 */
export function onScheduleHandlerWithNestApplicationFactory(baseSchedule?: OnScheduleConfig): OnScheduleHandlerWithNestApplicationFactory {
  return <I, O>(inputSchedule: OnScheduleConfig, fn: OnScheduleWithNestApplication<scheduler.ScheduledEvent>) => {
    const schedule = mergeObjects<OnScheduleConfig>([baseSchedule, inputSchedule]) as Building<OnScheduleConfig>;

    if (!schedule.schedule) {
      if (schedule.cron) {
        if (typeof schedule.cron === 'number') {
          schedule.schedule = cronExpressionRepeatingEveryNMinutes(schedule.cron);
        } else {
          schedule.schedule = schedule.cron;
        }
      } else {
        throw new Error('Missing required "cron" or "schedule" variable for configuration.');
      }
    }

    return (nestAppPromiseGetter: NestApplicationPromiseGetter) => {
      const runNow = (scheduleContext?: scheduler.ScheduledEvent) => nestAppPromiseGetter().then((x) => fn(makeOnScheduleHandlerWithNestApplicationRequest(x, scheduleContext)));
      const fnn: Buildable<Partial<NestApplicationScheduleConfiguredFunction<scheduler.ScheduleFunction>>> = scheduler.onSchedule(schedule as ScheduleOptions, runNow);
      fnn._schedule = schedule;
      fnn._runNow = runNow;
      return fnn as NestApplicationScheduleConfiguredFunction<scheduler.ScheduleFunction>;
    };
  };
}

/**
 * Factory function for generating HttpsFunctions/Runnable firebase function that returns the value from the input OnCallWithNestContext function.
 */
export type OnScheduleHandlerWithNestContextFactory<N> = (schedule: OnScheduleConfig, fn: OnScheduleWithNestContext<N, scheduler.ScheduledEvent>) => NestApplicationScheduleFunctionFactory;

/**
 * Creates a factory for generating OnCallWithNestContext functions with a nest context object that is generated by the input function.
 *
 * @param appFactory
 * @param makeNestContext
 * @returns
 */
export function onScheduleHandlerWithNestContextFactory<N>(appFactory: OnScheduleHandlerWithNestApplicationFactory, makeNestContext: MakeNestContext<N>): OnScheduleHandlerWithNestContextFactory<N> {
  return (schedule: OnScheduleConfig, fn: OnScheduleWithNestContext<N, scheduler.ScheduledEvent>) => appFactory(schedule, (request: OnScheduleWithNestApplicationRequest<scheduler.ScheduledEvent>) => fn(setNestContextOnScheduleRequest(makeNestContext, request)));
}
