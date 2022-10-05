import { Configurable, Minutes, PromiseOrValue } from '@dereekb/util';
import { MakeNestContext, NestApplicationFunctionFactory } from '../nest.provider';
import { NestApplicationContextRequest, NestContextRequest } from './nest';

export interface OnScheduleConfig {
  /**
   * Scheduled time in a cron-tab format.
   *
   * Used by v1 and v2.
   */
  cron?: Minutes | string;
  /**
   * Scheduled time configuration in an english format.
   *
   * Used by v2.
   */
  schedule?: string;
  /**
   * Optional timezone to specify.
   */
  timezone?: string;
  /**
   * The number of retry attempts for a failed run.
   */
  retryCount?: number;
  /**
   * The time limit for retrying.
   */
  maxRetrySeconds?: number;
  /**
   * The minimum time to wait before retying.
   */
  minBackoffSeconds?: number;
  /**
   * The maximum time to wait before retrying.
   */
  maxBackoffSeconds?: number;
  /**
   * The time between will double max doublings times.
   */
  maxDoublings?: number;
}

export interface OnScheduleRequest<S> {
  scheduleContext?: S;
}

// MARK: Application
export type OnScheduleWithNestApplicationRequest<S = unknown> = NestApplicationContextRequest<OnScheduleRequest<S>>;

/**
 * Scheduled function that is passed an INestApplicationContext in addition to the OnScheduleRequest object.
 */
export type OnScheduleWithNestApplication<S = unknown> = (request: OnScheduleWithNestApplicationRequest<S>) => PromiseOrValue<void>;

// MARK: Context
export type OnScheduleWithNestContextRequest<N, S = unknown> = NestContextRequest<N, OnScheduleRequest<S>>;

/**
 * Scheduled function that is passed an arbitrary nest context object in addition to the OnScheduleRequest object.
 */
export type OnScheduleWithNestContext<N, S = unknown> = (request: OnScheduleWithNestContextRequest<N, S>) => PromiseOrValue<void>;

export function setNestContextOnScheduleRequest<N, S>(makeNestContext: MakeNestContext<N>, request: OnScheduleWithNestApplicationRequest<S>): OnScheduleWithNestContextRequest<N, S> {
  (request as unknown as Configurable<OnScheduleWithNestContextRequest<N, S>>).nest = makeNestContext(request.nestApplication);
  return request as unknown as OnScheduleWithNestContextRequest<N, S>;
}

// MARK: Factory
export type NestApplicationScheduleConfiguredFunction<F extends object = object> = F & {
  _runNow(): PromiseOrValue<void>;
  readonly _schedule: OnScheduleConfig;
};

export type NestApplicationScheduleConfiguredFunctionFactory<F extends object = object> = NestApplicationFunctionFactory<NestApplicationScheduleConfiguredFunction<F>>;

export type NestApplicationScheduleConfiguredFunctionMap = Record<string, NestApplicationScheduleConfiguredFunction>;
