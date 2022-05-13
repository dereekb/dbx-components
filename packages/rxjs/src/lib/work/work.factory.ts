import { isObservable, Observable } from 'rxjs';
import { FactoryWithRequiredInput, Maybe } from '@dereekb/util';
import { WorkInstance, WorkInstanceDelegate } from './work.instance';

/**
 * A function that handles the incoming value to do work and creates a WorkContext.
 */
export type WorkFactory<T, O> = FactoryWithRequiredInput<Maybe<WorkInstance<T, O>>, T>;

/**
 * Performs the work. Can either return an observable that will use the handler, or can use the handler itself.
 */
export type Work<T = any, O = any> = WorkUsingObservable<T, O> | WorkUsingContext<T, O>;

/**
 * Performs the work using the value and returns an observable.
 */
export type WorkUsingObservable<T = any, O = any> = (value: T) => Observable<O>;

/**
 * Performs the work that uses the context handler to handle the event.
 */
export type WorkUsingContext<T = any, O = any> = (value: T, instance: WorkInstance<T, O>) => void;

/**
 * Config for workFactory().
 */
export interface WorkFactoryConfig<T, O> {
  readonly work: Work<T, O>;
  readonly delegate: WorkInstanceDelegate<O>;
}

/**
 * Creates a function that handles the incoming value and creates a WorkContext.
 */
export function workFactory<T, O>({ work, delegate }: WorkFactoryConfig<T, O>): WorkFactory<T, O> {
  return (value: T) => {
    const handler = new WorkInstance<T, O>(value, delegate);
    let fnResult: void | Observable<O>;

    try {
      fnResult = work(value, handler);
    } catch (e: any) {
      console.error('Work encountered an unexpected error.', e);
      handler.reject(e);
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

export type WorkFactoryConfigFactory<T, O> = FactoryWithRequiredInput<WorkFactoryConfig<T, O>, T>;

/**
 * Creates a WorkFactory using the input WorkFactoryConfigFactory that generates new work configuration given the input.
 */
export function workFactoryForConfigFactory<T, O>(configFactory: WorkFactoryConfigFactory<T, O>): WorkFactory<T, O> {
  return (value) => {
    const config: WorkFactoryConfig<T, O> = configFactory(value);
    return workFactory(config)(value);
  };
}
