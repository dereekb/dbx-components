import { asPromise, Destroyable, Maybe, PromiseOrValue } from '@dereekb/util';
import { finalize, MonoTypeOperatorFunction, Observable, of, scan, switchMap } from 'rxjs';

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
 * Cleans up the instance when a new value is pushed.
 *
 * Can be configured to wait until the previous value's destroy promise has resolved.
 *
 * @param destroy
 * @param wait
 * @returns
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
          destroy(currentInstance);
        }
      })
    );
  };
}

/**
 * Convenience function for cleanup() on a Destroyable type.
 *
 * @returns
 */
export function cleanupDestroyable<T extends Destroyable>(wait?: boolean): MonoTypeOperatorFunction<T> {
  return cleanup((x) => x.destroy(), wait);
}
