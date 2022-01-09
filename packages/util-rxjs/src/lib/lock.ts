import { defaultIfEmpty, delay, filter, first, map, shareReplay, switchMap, tap, timeoutWith, startWith } from 'rxjs/operators';
import { Observable, of, Subscription } from 'rxjs';
import { BehaviorSubject } from 'rxjs';
import { combineLatestFromMapValuesObsFn } from './rxjs';
import { reduceBooleansWithOrFn } from '@dereekb/util';
import ms from 'ms';

export type LockKey = string;

export type OnLockSetUnlockedFunction = (unlocked: boolean) => void;

export interface OnLockSetUnlockedConfig {
  lockSet: LockSet;
  fn: OnLockSetUnlockedFunction;
  timeout?: number;
  delayTime?: number;
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
export function onLockSetNextUnlock({ lockSet, fn, timeout = ms('50s'), delayTime }: OnLockSetUnlockedConfig): Subscription {
  return lockSet.isUnlocked$.pipe(
    filter((x) => x),
    delay(delayTime ?? 0),
    timeoutWith(timeout, of(false).pipe(
      tap(() => console.warn('LockSet time out. Potential issue detected.'))
    )),
    first()).subscribe(fn);
}

/**
 * Used for preventing an action until all keys are removed.
 *
 * Added Observables do not need to be strictly removed; empty observables are counted as unlocked.
 */
export class LockSet {

  private static LOCK_SET_CHILD_INDEX_STEPPER = 0;

  private _locks = new BehaviorSubject<Map<LockKey, Observable<boolean>>>(new Map());

  readonly locks$ = this._locks.asObservable();

  /**
   * isLocked$ is true if any observable is emitting true.
   */
  readonly isLocked$ = this.locks$.pipe(
    switchMap(combineLatestFromMapValuesObsFn((x) => x)),
    map(reduceBooleansWithOrFn(false)), // Empty map is unlocked.
    shareReplay(1),
  );

  readonly isUnlocked$ = this.isLocked$.pipe(map(x => !x));

  constructor() { }

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
        locked: config as boolean ?? true,
        duration
      };
    }

    if (lockedConfig.locked) {
      let obs = of(true);

      if (lockedConfig.duration) {
        obs = obs.pipe(timeoutWith(lockedConfig.duration, of(false)));
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

  addLock(key: LockKey, obs: Observable<boolean>): void {
    obs = obs.pipe(defaultIfEmpty(false));  // empty observables count as unlocked.
    this._locks.value.set(key, obs);
    this._locks.next(this.locks);
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
      ...((typeof config === 'function') ? { fn: config } : config)
    });
  }

  /**
   * Convenience function for watching a child lockset's locked state.
   */
  addChildLockSet(lockSet: LockSet, key: LockKey = `${LockSet.LOCK_SET_CHILD_INDEX_STEPPER++}`): void {
    this.addLock(key, lockSet.isLocked$);
  }

  // Cleanup
  destroyOnNextUnlock(config?: OnLockSetUnlockedFunction | Omit<OnLockSetUnlockedConfig, 'lockSet'>, delayTime?: number): void {
    let fn: OnLockSetUnlockedFunction | undefined;
    let mergeConfig: any;

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
  }

}
