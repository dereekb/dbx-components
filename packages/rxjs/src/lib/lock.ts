import { type ObservableOrValue, asObservable } from './rxjs/getter';
import { defaultIfEmpty, delay, filter, first, map, shareReplay, type Subscription, switchMap, tap, startWith, timeout, type Observable, of, BehaviorSubject, Subject } from 'rxjs';
import { cleanup, combineLatestFromMapValuesObsFn, preventComplete } from './rxjs';
import { type Destroyable, type Maybe, type Milliseconds, type Seconds, reduceBooleansWithOrFn, MS_IN_SECOND } from '@dereekb/util';
import { SubscriptionObject } from './subscription';

/**
 * Key used to identify a specific lock within a {@link LockSet}.
 */
export type LockKey = string;

/**
 * Callback invoked when a {@link LockSet} becomes unlocked or the wait times out.
 *
 * @param unlocked - `true` if the lock set unlocked normally, `false` if the timeout was reached
 */
export type OnLockSetUnlockedFunction = (unlocked: boolean) => void;

/**
 * Function returned by {@link LockSet.addLock} that removes the associated lock when called.
 */
export type RemoveLockFunction = () => void;

/**
 * Configuration for {@link onLockSetNextUnlock} that specifies how to wait for a {@link LockSet} to unlock.
 */
export interface OnLockSetUnlockedConfig {
  /**
   * The lock set to monitor for the next unlock event.
   */
  readonly lockSet: LockSet;
  /**
   * Optional callback to invoke when the lock set unlocks or the timeout is reached.
   */
  readonly fn?: Maybe<OnLockSetUnlockedFunction>;
  /**
   * Maximum time in milliseconds to wait for unlock before timing out. Defaults to 50 seconds.
   */
  readonly timeout?: Maybe<Milliseconds>;
  /**
   * Optional delay in milliseconds after the unlock is detected before invoking the callback.
   */
  readonly delayTime?: Maybe<Milliseconds>;
}

/**
 * Configuration for {@link LockSet.destroyOnNextUnlock}, excluding the lock set reference.
 */
export type DestroyOnNextUnlockConfig = Omit<OnLockSetUnlockedConfig, 'lockSet'>;

/**
 * Configuration for {@link LockSet.setLocked} that controls the locked state and optional auto-unlock duration.
 */
export interface SetLockedConfig {
  /**
   * Whether or not to lock the config.
   */
  readonly locked?: boolean;
  /**
   * Optional duration to set the locked state.
   *
   * Only relevant for locking.
   */
  readonly duration?: Milliseconds;
}

/**
 * Default lock key used by {@link LockSet.lockForTime} when no custom key is provided.
 */
export const DEFAULT_LOCK_SET_TIME_LOCK_KEY = 'timelock';

/**
 * Subscribes to the next unlock event of a {@link LockSet}, invoking the callback when it becomes unlocked or the timeout expires.
 *
 * Useful for deferring an action until all locks are released, with a safety timeout to avoid waiting indefinitely.
 *
 * @param config - configuration specifying the lock set, callback, timeout, and optional delay
 * @param config.lockSet - the lock set to monitor for the next unlock event
 * @param config.fn - optional callback to invoke when the lock set unlocks or the timeout is reached
 * @param config.timeout - maximum time in milliseconds to wait before timing out
 * @param config.delayTime - optional delay in milliseconds after unlock before invoking the callback
 * @returns subscription that can be unsubscribed to cancel the wait
 *
 * @example
 * ```ts
 * const lockSet = new LockSet();
 * lockSet.addLock('busy', of(true));
 *
 * const sub = onLockSetNextUnlock({
 *   lockSet,
 *   fn: (unlocked) => console.log('Unlocked:', unlocked),
 *   timeout: 5000
 * });
 * ```
 */
export function onLockSetNextUnlock({ lockSet, fn, timeout: inputTimeout, delayTime }: OnLockSetUnlockedConfig): Subscription {
  const timeoutTime = inputTimeout ?? MS_IN_SECOND * 50;

  const obs = lockSet.isUnlocked$.pipe(
    filter((x) => x),
    delay(delayTime ?? 0),
    timeout({
      first: timeoutTime,
      with: () => of(false).pipe(tap(() => console.warn('LockSet time out. Potential issue detected.')))
    }),
    first()
  );

  return obs.subscribe({ next: fn ?? undefined });
}

/**
 * Observable-based locking mechanism that prevents actions until all registered locks are released.
 *
 * Each lock is identified by a {@link LockKey} and backed by an `Observable<boolean>`. The lock set
 * is considered locked when any registered observable emits `true`. Empty or completed observables
 * are treated as unlocked, so locks do not need to be explicitly removed.
 *
 * Supports hierarchical locking via parent/child relationships between lock sets.
 *
 * @example
 * ```ts
 * const lockSet = new LockSet();
 *
 * // Add a lock that is currently active
 * const removeLock = lockSet.addLock('saving', of(true));
 *
 * // Check locked state
 * lockSet.isLocked$.subscribe(locked => console.log('Locked:', locked));
 * // Output: Locked: true
 *
 * // Remove the lock
 * removeLock();
 * // Output: Locked: false
 * ```
 */
export class LockSet implements Destroyable {
  private static LOCK_SET_CHILD_INDEX_STEPPER = 0;

  private _isDestroyed = false;

  private readonly _onDestroy = new Subject<void>();
  private readonly _locks = new BehaviorSubject<Map<LockKey, Observable<boolean>>>(new Map());
  private readonly _parentSub = new SubscriptionObject();

  /**
   * Observable of the current lock map, emitting whenever locks are added or removed.
   */
  readonly locks$ = this._locks.asObservable();

  /**
   * Observable that emits `true` when any registered lock observable is emitting `true`.
   * Emits `false` when all locks are released or the map is empty.
   */
  readonly isLocked$ = this.locks$.pipe(
    switchMap(combineLatestFromMapValuesObsFn((x) => x)),
    map(reduceBooleansWithOrFn(false)), // Empty map is unlocked.
    shareReplay(1)
  );

  /**
   * Observable that emits `true` when no locks are active. Inverse of {@link isLocked$}.
   */
  readonly isUnlocked$ = this.isLocked$.pipe(map((x) => !x));

  /**
   * Observable that emits when this lock set is destroyed. Useful for cleanup coordination.
   */
  readonly onDestroy$ = this._onDestroy.pipe(shareReplay(1));

  private get locks(): Map<LockKey, Observable<boolean>> {
    return this._locks.value;
  }

  /**
   * Sets the locked state for a given key, optionally with an auto-unlock duration.
   *
   * When locked with a duration, the lock automatically releases after the specified time.
   * When unlocked, the lock is removed from the set.
   *
   * @param key - identifier for this lock
   * @param config - locked state or configuration object
   * @param duration - optional auto-unlock duration in milliseconds (only used with boolean config)
   */
  setLocked(key: LockKey, config: SetLockedConfig): void;
  setLocked(key: LockKey, config: boolean, duration?: Milliseconds): void;
  setLocked(key: LockKey, config?: boolean | SetLockedConfig, duration?: Milliseconds): void {
    let lockedConfig: SetLockedConfig;

    if (typeof config === 'object') {
      lockedConfig = config as SetLockedConfig;
    } else {
      lockedConfig = {
        locked: config ?? true,
        duration
      };
    }

    if (lockedConfig.locked) {
      let obs = of(true);

      if (lockedConfig.duration) {
        obs = obs.pipe(timeout({ first: lockedConfig.duration, with: () => of(false) }));
      }

      this.addLock(key, obs);
    } else {
      this.removeLock(key);
    }
  }

  /**
   * Locks for a specified number of seconds using the default time lock key.
   *
   * @param seconds - duration in seconds
   */
  lockForSeconds(seconds: Seconds): void {
    this.lockForTime(seconds * 1000);
  }

  /**
   * Locks for a specified duration in milliseconds, automatically unlocking when the time elapses.
   *
   * @param milliseconds - lock duration
   * @param key - optional lock key, defaults to {@link DEFAULT_LOCK_SET_TIME_LOCK_KEY}
   */
  lockForTime(milliseconds: Milliseconds, key?: LockKey): void {
    this.addLock(key ?? DEFAULT_LOCK_SET_TIME_LOCK_KEY, of(false).pipe(delay(milliseconds), startWith(true)));
  }

  /**
   * Registers a lock observable under the given key. The lock is considered active when
   * the observable emits `true`. Empty observables are treated as unlocked.
   *
   * @param key - identifier for this lock
   * @param obs - observable that emits the lock state
   * @returns function that removes this specific lock when called
   *
   * @example
   * ```ts
   * const lockSet = new LockSet();
   * const remove = lockSet.addLock('saving', of(true));
   *
   * // Later, release the lock
   * remove();
   * ```
   */
  addLock(key: LockKey, obs: Observable<boolean>): RemoveLockFunction {
    obs = obs.pipe(
      defaultIfEmpty<boolean, boolean>(false) // empty observables count as unlocked.
    );

    const removeLock: RemoveLockFunction = () => this._removeObsForKey(obs, key);

    this._locks.value.set(key, obs);
    this._locks.next(this._locks.value);

    return removeLock;
  }

  private _removeObsForKey(obs: Observable<boolean>, key: LockKey): void {
    const current = this._locks.value.get(key);

    if (current && obs === current) {
      this.removeLock(key);
    }
  }

  /**
   * Removes the lock registered under the given key, if it exists.
   *
   * @param key - identifier of the lock to remove
   */
  removeLock(key: LockKey): void {
    if (this._locks.value.delete(key)) {
      this._locks.next(this.locks);
    }
  }

  /**
   * Registers a callback for the next time this lock set becomes unlocked.
   *
   * @param config - callback function or configuration object
   * @param delayTime - optional delay in milliseconds after unlock before invoking the callback
   * @returns subscription that can be unsubscribed to cancel the wait
   */
  onNextUnlock(config: OnLockSetUnlockedFunction | Omit<OnLockSetUnlockedConfig, 'lockSet'>, delayTime?: Milliseconds): Subscription {
    return onLockSetNextUnlock({
      lockSet: this,
      delayTime,
      ...(typeof config === 'function' ? { fn: config } : config)
    });
  }

  /**
   * Establishes a parent-child relationship where this lock set's locked state is propagated
   * to the parent. When this lock set is locked, the parent will also reflect a locked state.
   *
   * @param parent - parent lock set or observable of one; pass `undefined` to detach
   */
  setParentLockSet(parent: ObservableOrValue<Maybe<LockSet>>): void {
    this._parentSub.subscription = preventComplete(asObservable(parent))
      .pipe(
        map((parentLockSet) => {
          let removeFn: Maybe<RemoveLockFunction>;

          if (parentLockSet) {
            removeFn = parentLockSet.addChildLockSet(this);
          }

          return removeFn;
        }),
        cleanup((removeLockSet) => {
          removeLockSet?.();
        })
      )
      .subscribe();
  }

  /**
   * Registers a child lock set so its locked state propagates upward to this lock set.
   *
   * @param lockSet - child lock set to monitor
   * @param key - optional lock key, auto-generated if not provided
   * @returns function that removes the child lock relationship when called
   */
  addChildLockSet(lockSet: LockSet, key: LockKey = `${LockSet.LOCK_SET_CHILD_INDEX_STEPPER++}`): RemoveLockFunction {
    return this.addLock(key, lockSet.isLocked$);
  }

  // Cleanup
  get isDestroyed() {
    return this._isDestroyed;
  }

  /**
   * Schedules this lock set for destruction when it next becomes unlocked.
   *
   * After the unlock event (or timeout), the optional callback is invoked and then
   * {@link destroy} is called after a short delay.
   *
   * @param config - optional callback or configuration for the unlock wait
   * @param delayTime - optional delay in milliseconds after unlock before invoking the callback
   */
  destroyOnNextUnlock(config?: Maybe<DestroyOnNextUnlockConfig['fn'] | DestroyOnNextUnlockConfig>, delayTime?: Milliseconds): void {
    let fn: Maybe<OnLockSetUnlockedFunction>;
    let mergeConfig: Maybe<DestroyOnNextUnlockConfig>;

    if (config) {
      if (typeof config === 'function') {
        fn = config;
      } else {
        fn = config.fn;
        mergeConfig = config;
      }
    }

    this.onNextUnlock({
      ...mergeConfig,
      fn: (unlocked) => {
        fn?.(unlocked);
        setTimeout(() => this.destroy(), 100);
      },
      delayTime: delayTime ?? mergeConfig?.delayTime
    });
  }

  /**
   * Completes all internal subjects, unsubscribes from the parent lock set, and marks this lock set as destroyed.
   */
  destroy(): void {
    this._isDestroyed = true;
    this._locks.complete();
    this._parentSub.destroy();
    this._onDestroy.next();
    this._onDestroy.complete();
  }
}
