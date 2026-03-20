import { asPromise, type Destroyable, type Maybe, type PromiseOrValue } from '@dereekb/util';
import { finalize, type MonoTypeOperatorFunction, type Observable, of, scan, switchMap } from 'rxjs';

// MARK: Cleanup
interface CleanupInternalState<T> {
  /**
   * Current instance.
   */
  instance?: T;
  /**
   * Promise of the previous item being cleaned up.
   */
  cleanup?: Promise<void>;
}

/**
 * RxJS operator that calls a destroy function on the previous value whenever a new value is emitted.
 *
 * Ensures proper cleanup of resources when switching between instances. When `wait` is true,
 * delays emitting the new value until the previous destruction completes.
 * On unsubscription, the last emitted instance is also destroyed.
 *
 * @param destroy - function to clean up each replaced instance
 * @param wait - whether to wait for the previous destroy to complete before emitting
 * @returns an operator that manages instance lifecycle
 */
export function cleanup<T>(destroy: (instance: T) => PromiseOrValue<void>, wait = false): MonoTypeOperatorFunction<T> {
  return (obs: Observable<T>) => {
    let currentInstance: Maybe<T>;

    return obs.pipe(
      scan<T, CleanupInternalState<T>>((acc: CleanupInternalState<T>, instance: T) => {
        let cleanup: Promise<void> | undefined;

        if (acc.instance) {
          cleanup = asPromise(destroy(acc.instance));
        }

        currentInstance = instance;

        return {
          cleanup,
          instance
        };
      }, {}),
      switchMap((x) => {
        let result: Observable<T> | Promise<T>;

        if (x.cleanup && wait) {
          const continueFn = () => x.instance as T;
          result = x.cleanup.then(continueFn).catch(continueFn);
        } else {
          result = of(x.instance as T);
        }

        return result;
      }),
      finalize(() => {
        if (currentInstance) {
          void destroy(currentInstance);
        }
      })
    );
  };
}

/**
 * Convenience wrapper for {@link cleanup} that calls `destroy()` on each replaced {@link Destroyable} instance.
 *
 * @param wait - whether to wait for the previous destroy to complete before emitting
 * @returns an operator that manages Destroyable lifecycle
 */
export function cleanupDestroyable<T extends Destroyable>(wait?: boolean): MonoTypeOperatorFunction<T> {
  return cleanup((x) => x.destroy(), wait);
}
