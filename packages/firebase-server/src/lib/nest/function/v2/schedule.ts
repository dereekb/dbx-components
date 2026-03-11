import { scheduler } from 'firebase-functions/v2';
import { type INestApplicationContext } from '@nestjs/common';
import { type MakeNestContext, type NestApplicationPromiseGetter } from '../../nest.provider';
import { type NestApplicationScheduleConfiguredFunction, type NestApplicationScheduleConfiguredFunctionFactory, type OnScheduleConfig, type OnScheduleWithNestApplication, type OnScheduleWithNestApplicationRequest, type OnScheduleWithNestContext, setNestContextOnScheduleRequest } from '../schedule';
import { type Building, cronExpressionRepeatingEveryNMinutes, mergeObjects } from '@dereekb/util';
import { type Buildable } from 'ts-essentials';
import { type ScheduleOptions } from 'firebase-functions/v2/scheduler';

/**
 * Configuration options for OnScheduleHandlerWithNestApplicationFactory that extends the base OnScheduleConfig with the gen 2 ScheduleOptions.
 */
export type OnScheduleConfigWithGlobalOptions = OnScheduleConfig & Omit<ScheduleOptions, 'schedule'>;

/**
 * Creates an {@link OnScheduleWithNestApplicationRequest} by combining the NestJS application context
 * with an optional scheduler event. Used internally by schedule handler factories to build the
 * request object passed to schedule function handlers.
 *
 * @param nestApplication - The initialized NestJS application context.
 * @param scheduleContext - The optional Firebase scheduler event, absent when invoked via `_runNow()`.
 * @returns A request object ready for schedule function handlers.
 */
export function makeOnScheduleHandlerWithNestApplicationRequest(nestApplication: INestApplicationContext, scheduleContext?: scheduler.ScheduledEvent): OnScheduleWithNestApplicationRequest<scheduler.ScheduledEvent> {
  return {
    nestApplication,
    scheduleContext
  };
}

// MARK: Nest
/**
 * A {@link NestApplicationScheduleConfiguredFunctionFactory} specialized for Firebase v2 schedule functions.
 */
export type NestApplicationScheduleFunctionFactory = NestApplicationScheduleConfiguredFunctionFactory<scheduler.ScheduleFunction>;

/**
 * Factory function that creates a {@link NestApplicationScheduleFunctionFactory} from a schedule configuration
 * and an {@link OnScheduleWithNestApplication} handler.
 *
 * Produced by {@link onScheduleHandlerWithNestApplicationFactory}.
 */
export type OnScheduleHandlerWithNestApplicationFactory = (schedule: OnScheduleConfigWithGlobalOptions, fn: OnScheduleWithNestApplication<scheduler.ScheduledEvent>) => NestApplicationScheduleFunctionFactory;

/**
 * Creates an {@link OnScheduleHandlerWithNestApplicationFactory} for Firebase v2 scheduled functions.
 *
 * The factory resolves `cron` values (including numeric minute intervals) into cron expressions,
 * merges base and per-function schedule options, and attaches `_runNow` and `_schedule` metadata
 * to the resulting function for testing and introspection.
 *
 * @example
 * ```ts
 * const scheduleFactory = onScheduleHandlerWithNestApplicationFactory({ timeoutSeconds: 60 });
 * const dailyCleanup = scheduleFactory(
 *   { cron: '0 2 * * *', timezone: 'America/New_York' },
 *   (request) => request.nestApplication.get(CleanupService).run()
 * );
 * ```
 *
 * @param baseScheduleConfig - Optional default schedule options merged into every function created by this factory.
 * @returns A factory for creating nest-application-aware scheduled functions.
 */
export function onScheduleHandlerWithNestApplicationFactory(baseScheduleConfig?: OnScheduleConfigWithGlobalOptions): OnScheduleHandlerWithNestApplicationFactory {
  return <I, O>(inputSchedule: OnScheduleConfigWithGlobalOptions, fn: OnScheduleWithNestApplication<scheduler.ScheduledEvent>) => {
    const schedule = mergeObjects<OnScheduleConfigWithGlobalOptions>([baseScheduleConfig, inputSchedule]) as Building<OnScheduleConfigWithGlobalOptions>;

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
 * Factory function that creates a {@link NestApplicationScheduleFunctionFactory} from a schedule configuration
 * and an {@link OnScheduleWithNestContext} handler that receives a typed nest context.
 *
 * Produced by {@link onScheduleHandlerWithNestContextFactory}.
 */
export type OnScheduleHandlerWithNestContextFactory<N> = (schedule: OnScheduleConfigWithGlobalOptions, fn: OnScheduleWithNestContext<N, scheduler.ScheduledEvent>) => NestApplicationScheduleFunctionFactory;

/**
 * Creates a factory for generating OnCallWithNestContext functions with a nest context object that is generated by the input function.
 *
 * @param appFactory
 * @param makeNestContext
 * @returns
 */
export function onScheduleHandlerWithNestContextFactory<N>(appFactory: OnScheduleHandlerWithNestApplicationFactory, makeNestContext: MakeNestContext<N>): OnScheduleHandlerWithNestContextFactory<N> {
  return (schedule: OnScheduleConfigWithGlobalOptions, fn: OnScheduleWithNestContext<N, scheduler.ScheduledEvent>) => appFactory(schedule, (request: OnScheduleWithNestApplicationRequest<scheduler.ScheduledEvent>) => fn(setNestContextOnScheduleRequest(makeNestContext, request)));
}
