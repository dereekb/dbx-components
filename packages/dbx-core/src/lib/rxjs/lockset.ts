import { DestroyRef, inject } from '@angular/core';
import { type DestroyOnNextUnlockConfig, LockSet, SubscriptionObject } from '@dereekb/rxjs';
import { type Configurable, type DestroyFunction, type GetterOrValue, getValueFromGetter, type Maybe } from '@dereekb/util';
import { cleanSubscription } from './subscription';
import { type Unsubscribable } from 'rxjs';

export interface CleanLockSetConfig {
  /**
   * Arbitrary onDestroy function to call when onDestroy is called by the internal DestroyRef.
   */
  readonly onDestroy?: Maybe<() => void>;
  /**
   * Called when the LockSet is finally destroyed.
   */
  readonly onLockSetDestroy?: Maybe<() => void>;
  /**
   * Configures when the lockset should be destroyed.
   */
  readonly destroyLocksetTiming?: Maybe<DestroyOnNextUnlockConfig>;
}

export type CleanLockSet = LockSet & { readonly _cleanDestroy: () => void };

/**
 * Creates a new LockSet that is automatically destroyed when the component is destroyed.
 *
 * Must be run within an Angular injection context.
 *
 * @param config Optional configuration for destruction behavior and callbacks.
 *
 * @example
 * // Create a simple lockset:
 * readonly lockSet = cleanLockSet();
 *
 * @example
 * // Create with a callback when the lockset is destroyed:
 * readonly lockSet = cleanLockSet({
 *   onLockSetDestroy: () => console.log('lockset destroyed')
 * });
 */
export function cleanLockSet(config?: Maybe<CleanLockSetConfig>): CleanLockSet {
  const { onDestroy, onLockSetDestroy, destroyLocksetTiming } = config ?? {};

  const destroyRef = inject(DestroyRef);
  const lockSet = new LockSet() as unknown as CleanLockSet;

  function cleanDestroy() {
    onDestroy?.();
    lockSet.destroyOnNextUnlock(destroyLocksetTiming); // flag to be destroyed on the next complete unlock
  }

  destroyRef.onDestroy(() => cleanDestroy());

  if (onLockSetDestroy) {
    const _destroySub = cleanSubscription(
      lockSet.onDestroy$.subscribe(() => {
        onLockSetDestroy();
        _destroySub.destroy();
      })
    );
  }

  (lockSet as Configurable<CleanLockSet>)._cleanDestroy = cleanDestroy;
  return lockSet;
}

// MARK: cleanWithLockSet()
/**
 * Runs the given onDestroy function when the context is destroyed, and the lock set's next unlock occurs.
 *
 * Must be run within an Angular injection context.
 *
 * @param lockSet The lockset to use.
 * @param onDestroy The function to run when the lockset is unlocked.
 *
 * @example
 * // Defer cleanup until the lockset unlocks after component destroy:
 * cleanWithLockSet(this.lockSet, () => resource.release());
 */
export function cleanWithLockSet(lockSet: LockSet, onDestroy: DestroyFunction) {
  const destroyRef = inject(DestroyRef);

  destroyRef.onDestroy(() => {
    lockSet.onNextUnlock(() => {
      onDestroy();
    });
  });
}

// MARK: cleanSubscriptionWithLockSet()
/**
 * Config for cleanSubscriptionWithLockSet()
 */
export interface CleanSubscriptionWithLockSetConfig<T extends Unsubscribable = Unsubscribable> {
  readonly lockSet: LockSet;
  readonly sub?: Maybe<GetterOrValue<T>>;
}

/**
 * Creates a new SubscriptionObject that is automatically destroyed when the context is destroyed, and the lock set's next unlock occurs.
 *
 * Must be run within an Angular injection context.
 *
 * @example
 * // Pass a subscription that waits for the lockset to unlock before cleanup:
 * readonly _sub = cleanSubscriptionWithLockSet({
 *   lockSet: this.lockSet,
 *   sub: obs$.subscribe(handler)
 * });
 *
 * @example
 * // Create first, then set the subscription later:
 * readonly _sub = cleanSubscriptionWithLockSet({ lockSet: this.lockSet });
 * this._sub.subscription = obs$.subscribe(handler);
 */
export function cleanSubscriptionWithLockSet<T extends Unsubscribable = Unsubscribable>(input: CleanSubscriptionWithLockSetConfig<T>): SubscriptionObject<T> {
  const subscription = getValueFromGetter(input.sub);
  const subscriptionObject = new SubscriptionObject<T>(subscription);
  cleanWithLockSet(input.lockSet, () => subscriptionObject.destroy());
  return subscriptionObject;
}
