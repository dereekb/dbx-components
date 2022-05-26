import { asObservable } from '@dereekb/rxjs';
import { ObservableOrValue } from './rxjs/getter';
import { defaultIfEmpty, delay, filter, first, map, shareReplay, switchMap, tap, startWith, timeout, Observable, of, Subscription, BehaviorSubject } from 'rxjs';
import { cleanup, combineLatestFromMapValuesObsFn, preventComplete } from './rxjs';
import { Destroyable, Maybe, reduceBooleansWithOrFn } from '@dereekb/util';
import ms from 'ms';
import { SubscriptionObject } from './subscription';

export type LockKey = string;

export type OnLockSetUnlockedFunction = (unlocked: boolean) => void;
export type RemoveLockFunction = () => void;

export interface OnLockSetUnlockedConfig {
  lockSet: LockSet;
  fn: OnLockSetUnlockedFunction;
  timeout?: Maybe<number>;
  delayTime?: Maybe<number>;
}

export interface SetLockedConfig {
  /**
   * Whether or not to lock the config.
   */
  locked?: boolean;
  /**
   * Optional duration to set the locked state.
   *
   * Only relevant for locking.
   */
  duration?: number;
}

export const DEFAULT_LOCK_SET_TIME_LOCK_KEY = 'timelock';

/**
 * Executes the input function when the lockSet is set unlocked, or the timeout is reached.
 */
export function onLockSetNextUnlock({ lockSet, fn, timeout: inputTimeout, delayTime }: OnLockSetUnlockedConfig): Subscription {
  const timeoutTime = inputTimeout ?? ms('50s');
  return lockSet.isUnlocked$
    .pipe(
      filter((x) => x),
      delay(delayTime ?? 0),
      timeout({
        first: timeoutTime,
        with: () => of(false).pipe(tap(() => console.warn('LockSet time out. Potential issue detected.')))
      }),
      first()
    )
    .subscribe(fn);
}

/**
 * Used for preventing an action until all keys are removed.
 *
 * Added Observables do not need to be strictly removed; empty observables are counted as unlocked.
 */
export class LockSet implements Destroyable {
  private static LOCK_SET_CHILD_INDEX_STEPPER = 0;

  private _locks = new BehaviorSubject<Map<LockKey, Observable<boolean>>>(new Map());
  private _parentSub = new SubscriptionObject();

  readonly locks$ = this._locks.asObservable();

  /**
   * isLocked$ is true if any observable is emitting true.
   */
  readonly isLocked$ = this.locks$.pipe(
    switchMap(combineLatestFromMapValuesObsFn((x) => x)),
    map(reduceBooleansWithOrFn(false)), // Empty map is unlocked.
    shareReplay(1)
  );

  readonly isUnlocked$ = this.isLocked$.pipe(map((x) => !x));

  private get locks(): Map<LockKey, Observable<boolean>> {
    return this._locks.value;
  }

  setLocked(key: LockKey, config: SetLockedConfig): void;
  setLocked(key: LockKey, config: boolean, duration?: number): void;
  setLocked(key: LockKey, config?: boolean | SetLockedConfig, duration?: number): void {
    let lockedConfig: SetLockedConfig;

    if (typeof config !== 'object') {
      lockedConfig = config as SetLockedConfig;
    } else {
      lockedConfig = {
        locked: (config as boolean) ?? true,
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

  lockForSeconds(seconds: number): void {
    this.lockForTime(seconds * 1000);
  }

  lockForTime(milliseconds: number, key?: LockKey): void {
    this.addLock(key ?? DEFAULT_LOCK_SET_TIME_LOCK_KEY, of(false).pipe(delay(milliseconds), startWith(true)));
  }

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

  removeLock(key: LockKey): void {
    if (this._locks.value.delete(key)) {
      this._locks.next(this.locks);
    }
  }

  onNextUnlock(config: OnLockSetUnlockedFunction | Omit<OnLockSetUnlockedConfig, 'lockSet'>, delayTime?: number): Subscription {
    return onLockSetNextUnlock({
      lockSet: this,
      delayTime,
      ...(typeof config === 'function' ? { fn: config } : config)
    });
  }

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
   * Convenience function for watching a child lockset's locked state and propogating it upward.
   */
  addChildLockSet(lockSet: LockSet, key: LockKey = `${LockSet.LOCK_SET_CHILD_INDEX_STEPPER++}`): RemoveLockFunction {
    return this.addLock(key, lockSet.isLocked$);
  }

  // Cleanup
  destroyOnNextUnlock(config?: OnLockSetUnlockedFunction | Omit<OnLockSetUnlockedConfig, 'lockSet'>, delayTime?: number): void {
    let fn: OnLockSetUnlockedFunction | undefined;
    let mergeConfig: Maybe<object>;

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
      delayTime
    });
  }

  destroy(): void {
    this._locks.complete();
    this._parentSub.destroy();
  }
}
