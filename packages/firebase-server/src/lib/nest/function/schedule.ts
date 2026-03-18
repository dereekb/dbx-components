import { type Configurable, type Minutes, type PromiseOrValue, type Seconds, type TimezoneString } from '@dereekb/util';
import { type MakeNestContext, type NestApplicationFunctionFactory } from '../nest.provider';
import { type NestApplicationContextRequest, type NestContextRequest } from './nest';

/**
 * Configuration for scheduled Firebase functions, supporting both cron expressions and human-readable schedules.
 *
 * At least one of `cron` or `schedule` must be provided. If `cron` is a number, it is interpreted as
 * a repeating interval in minutes and converted to a cron expression automatically.
 */
export interface OnScheduleConfig {
  /**
   * Scheduled time in a cron-tab format.
   *
   * Used by v1 and v2.
   */
  readonly cron?: Minutes | string;
  /**
   * Scheduled time configuration in an english format.
   *
   * Used by v2.
   */
  readonly schedule?: string;
  /**
   * Optional timezone to specify.
   */
  readonly timezone?: TimezoneString;
  /**
   * The number of retry attempts for a failed run.
   */
  readonly retryCount?: number;
  /**
   * The time limit for retrying.
   */
  readonly maxRetrySeconds?: Seconds;
  /**
   * The minimum time to wait before retying.
   */
  readonly minBackoffSeconds?: Seconds;
  /**
   * The maximum time to wait before retrying.
   */
  readonly maxBackoffSeconds?: Seconds;
  /**
   * The time between will double max doublings times.
   */
  readonly maxDoublings?: number;
}

/**
 * Request object passed to scheduled function handlers, containing the platform-specific schedule event context.
 *
 * @typeParam S - The schedule event type (e.g., `scheduler.ScheduledEvent` for v2).
 */
export interface OnScheduleRequest<S> {
  readonly scheduleContext?: S;
}

// MARK: Application
/**
 * Request type for scheduled functions that receive the raw {@link INestApplicationContext}.
 *
 * @typeParam S - The schedule event type.
 */
export type OnScheduleWithNestApplicationRequest<S = unknown> = NestApplicationContextRequest<OnScheduleRequest<S>>;

/**
 * Scheduled function that is passed an INestApplicationContext in addition to the OnScheduleRequest object.
 */
export type OnScheduleWithNestApplication<S = unknown> = (request: OnScheduleWithNestApplicationRequest<S>) => PromiseOrValue<void>;

// MARK: Context
/**
 * Request type for scheduled functions that receive a typed nest context.
 *
 * @typeParam N - The nest context type.
 * @typeParam S - The schedule event type.
 */
export type OnScheduleWithNestContextRequest<N, S = unknown> = NestContextRequest<N, OnScheduleRequest<S>>;

/**
 * Scheduled function that is passed an arbitrary nest context object in addition to the OnScheduleRequest object.
 */
export type OnScheduleWithNestContext<N, S = unknown> = (request: OnScheduleWithNestContextRequest<N, S>) => PromiseOrValue<void>;

/**
 * Mutates the application-level schedule request to attach a typed nest context.
 *
 * This is the schedule-function equivalent of {@link setNestContextOnRequest} for callable functions.
 *
 * @param makeNestContext - Factory that creates the typed context from the application context.
 * @param request - The application-level schedule request to augment.
 * @returns The same request object, now typed with the nest context attached.
 */
export function setNestContextOnScheduleRequest<N, S>(makeNestContext: MakeNestContext<N>, request: OnScheduleWithNestApplicationRequest<S>): OnScheduleWithNestContextRequest<N, S> {
  (request as unknown as Configurable<OnScheduleWithNestContextRequest<N, S>>).nest = makeNestContext(request.nestApplication);
  return request as unknown as OnScheduleWithNestContextRequest<N, S>;
}

// MARK: Factory
/**
 * A scheduled Firebase function augmented with metadata for testing and introspection.
 *
 * The `_runNow` method allows triggering the scheduled function outside of its cron schedule,
 * which is useful for testing or manual invocation. The `_schedule` field exposes the resolved
 * schedule configuration.
 *
 * @typeParam F - The base Firebase function type (e.g., `scheduler.ScheduleFunction`).
 */
export type NestApplicationScheduleConfiguredFunction<F extends object = object> = F & {
  _runNow(): PromiseOrValue<void>;
  readonly _schedule: OnScheduleConfig;
};

/**
 * Factory that creates a {@link NestApplicationScheduleConfiguredFunction} from a {@link NestApplicationPromiseGetter}.
 *
 * @typeParam F - The base Firebase function type.
 */
export type NestApplicationScheduleConfiguredFunctionFactory<F extends object = object> = NestApplicationFunctionFactory<NestApplicationScheduleConfiguredFunction<F>>;

/**
 * A map of named scheduled functions, keyed by function name. Useful for registering
 * multiple scheduled functions as a group (e.g., in a module's function map).
 */
export type NestApplicationScheduleConfiguredFunctionMap = Record<string, NestApplicationScheduleConfiguredFunction>;
