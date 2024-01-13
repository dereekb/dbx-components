import { build, type CachedFactoryWithInput, cachedGetter, type Destroyable, type Maybe } from '@dereekb/util';
import { throttleTime, distinctUntilChanged, BehaviorSubject, type Observable, type Subject } from 'rxjs';
import { SubscriptionObject } from '../subscription';
import { skipFirstMaybe } from './value';

/**
 * Default amount of throttle in milliseconds used by AsyncPusher.
 */
export const DEFAULT_ASYNC_PUSHER_THROTTLE = 200;

/**
 * Special function that when called pushes a value onto an internal subject, and returns an observable.
 *
 * This is useful for cases where a function may get called and subscribes to an observable each time, but we need to throttle that.
 */
export type AsyncPusher<T> = ((value: T) => Observable<T>) &
  Destroyable & {
    /**
     * Configures the pusher to watch this input observable for complete.
     *
     * @param obs
     */
    watchForCleanup(obs: Observable<unknown>): void;

    /**
     * The internal subject.
     */
    readonly _subject: Subject<T>;
  };

export interface AsyncPusherConfig<T> {
  /**
   * Time to throttle each emission.
   */
  throttle?: number;
  /**
   * Whether or not to filter on distinct values.
   */
  distinct?: boolean;
  /**
   * Configuration function to build onto the internal observable.
   */
  pipe?: (obs: Observable<T>) => Observable<T>;
  /**
   * (Optional) Observable to watch for cleaunup.
   */
  cleanupObs?: Observable<unknown>;
}

/**
 * Creates an AsyncPusher.
 *
 * @param config
 * @returns
 */
export function asyncPusher<T>(config: AsyncPusherConfig<T> = {}): AsyncPusher<T> {
  const { throttle = DEFAULT_ASYNC_PUSHER_THROTTLE, cleanupObs, distinct = true, pipe: pipeObs } = config;

  const _subject = new BehaviorSubject<Maybe<T>>(undefined);
  const _sub = new SubscriptionObject();

  let obs: Observable<T> = _subject.pipe(skipFirstMaybe(), throttleTime(throttle, undefined, { leading: false, trailing: true })) as unknown as Observable<T>;

  if (distinct) {
    obs = obs.pipe(distinctUntilChanged());
  }

  if (pipeObs) {
    obs = pipeObs(obs);
  }

  const pusher: AsyncPusher<T> = build<AsyncPusher<T>>({
    base: ((value: T) => {
      _subject.next(value);
      return obs;
    }) as AsyncPusher<T>,
    build: (x) => {
      x.destroy = () => {
        _subject.complete();
        _sub.destroy();
      };

      x.watchForCleanup = (obs: Observable<unknown>) => {
        _sub.subscription = obs.subscribe({
          complete: () => {
            pusher.destroy();
          }
        });
      };

      x._subject = _subject as Subject<T>;
    }
  });

  if (cleanupObs) {
    pusher.watchForCleanup(cleanupObs);
  }

  return pusher;
}

/**
 * AsyncPusher cache
 */
export type AsyncPusherCache<T> = CachedFactoryWithInput<AsyncPusher<T>, Observable<unknown>>;

/**
 * Creates a cache that returns an AsyncPusher.
 *
 * The CachedFactoryWithInput resunt can optionally be pass an observable to watch for the cleanup process.
 *
 * @param config
 * @returns
 */
export function asyncPusherCache<T>(config?: AsyncPusherConfig<T>): AsyncPusherCache<T> {
  return cachedGetter((cleanupObs?: Observable<unknown>) => {
    const pusher = asyncPusher(config);

    if (cleanupObs) {
      pusher.watchForCleanup(cleanupObs);
    }

    return pusher;
  });
}
