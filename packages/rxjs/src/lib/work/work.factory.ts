import { isObservable, type Observable } from 'rxjs';
import { type ErrorInput, type FactoryWithRequiredInput, type Maybe } from '@dereekb/util';
import { WorkInstance, type WorkInstanceDelegate } from './work.instance';

/**
 * A function that accepts an input value, performs asynchronous work, and returns a {@link WorkInstance}
 * to track progress and results.
 */
export type WorkFactory<T, O> = FactoryWithRequiredInput<Maybe<WorkInstance<T, O>>, T>;

/**
 * Union type for work that can either return an observable result directly or interact with
 * the {@link WorkInstance} handler to manage the work lifecycle manually.
 */
export type Work<T = unknown, O = unknown> = WorkUsingObservable<T, O> | WorkUsingContext<T, O>;

/**
 * Work implementation that returns an observable of the result, allowing the framework
 * to manage subscription and lifecycle.
 */
export type WorkUsingObservable<T = unknown, O = unknown> = (value: T) => Observable<O>;

/**
 * Work implementation that manages its own lifecycle by calling methods on the
 * {@link WorkInstance} handler directly (e.g. `startWorking()`, `success()`, `reject()`).
 */
export type WorkUsingContext<T = unknown, O = unknown> = (value: T, instance: WorkInstance<T, O>) => void;

/**
 * Configuration for {@link workFactory}.
 */
export interface WorkFactoryConfig<T, O> {
  /**
   * The work function to execute.
   */
  readonly work: Work<T, O>;
  /**
   * Delegate that receives lifecycle callbacks (start, success, reject).
   */
  readonly delegate: WorkInstanceDelegate<O>;
}

/**
 * Creates a {@link WorkFactory} that executes the configured work function with a {@link WorkInstance} handler.
 *
 * If the work function returns an observable, it is automatically subscribed to. If it uses
 * the handler directly, the observable return is ignored.
 *
 * @example
 * ```ts
 * const factory = workFactory({
 *   work: (value: number) => of(`result: ${value}`),
 *   delegate: { startWorking: () => {}, success: () => {}, reject: () => {} }
 * });
 *
 * const instance = factory(42);
 * // instance tracks the work lifecycle
 * ```
 *
 * @param config - work function and delegate configuration
 * @returns a factory function that creates WorkInstance for each input
 */
export function workFactory<T, O>({ work, delegate }: WorkFactoryConfig<T, O>): WorkFactory<T, O> {
  return (value: T) => {
    const handler = new WorkInstance<T, O>(value, delegate);
    let fnResult: void | Observable<O>;

    try {
      fnResult = work(value, handler);
    } catch (e: unknown) {
      console.error('Work encountered an unexpected error.', e);
      handler.reject(e as ErrorInput);
      return;
    }

    if (!handler.isComplete) {
      if (fnResult && isObservable(fnResult)) {
        if (handler.hasStarted) {
          throw new Error('Work already marked as begun from returned result. Either return an observable or use the handler directly.');
        }

        handler.startWorkingWithObservable(fnResult);
      }
    }

    return handler;
  };
}

/**
 * A factory that produces a fresh {@link WorkFactoryConfig} for each input value, allowing
 * per-invocation customization of work and delegate.
 */
export type WorkFactoryConfigFactory<T, O> = FactoryWithRequiredInput<WorkFactoryConfig<T, O>, T>;

/**
 * Creates a {@link WorkFactory} that generates a new {@link WorkFactoryConfig} for each input,
 * enabling dynamic work and delegate selection per invocation.
 *
 * @param configFactory - factory that produces work configuration from the input value
 * @returns a work factory with per-invocation configuration
 */
export function workFactoryForConfigFactory<T, O>(configFactory: WorkFactoryConfigFactory<T, O>): WorkFactory<T, O> {
  return (value) => {
    const config: WorkFactoryConfig<T, O> = configFactory(value);
    return workFactory(config)(value);
  };
}
