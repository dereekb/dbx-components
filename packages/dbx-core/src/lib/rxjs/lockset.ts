import { DestroyRef, inject } from '@angular/core';
import { type DestroyOnNextUnlockConfig, LockSet, SubscriptionObject } from '@dereekb/rxjs';
import { type DestroyFunction, type GetterOrValue, getValueFromGetter, type Maybe } from '@dereekb/util';
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

/**
 * Creates a new LockSet that is automatically destroyed when the component is destroyed.
 *
 * Must be run within an Angular injection context.
 *
 * @param onLockSetDestroy Optional callback to run when the lockset is unlocked.
 */
export function cleanLockSet(config?: Maybe<CleanLockSetConfig>): LockSet {
  const { onDestroy, onLockSetDestroy, destroyLocksetTiming } = config ?? {};

  const destroyRef = inject(DestroyRef);
  const lockSet = new LockSet();

  destroyRef.onDestroy(() => {
    onDestroy?.();
    lockSet.destroyOnNextUnlock(destroyLocksetTiming); // flag to be destroyed on the next complete unlock
  });

  if (onLockSetDestroy) {
    const _destroySub = cleanSubscription(
      lockSet.onDestroy$.subscribe(() => {
        onLockSetDestroy();
        _destroySub.destroy();
      })
    );
  }

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
 */
export function cleanSubscriptionWithLockSet<T extends Unsubscribable = Unsubscribable>(input: CleanSubscriptionWithLockSetConfig<T>): SubscriptionObject<T> {
  const subscription = getValueFromGetter(input.sub);
  const subscriptionObject = new SubscriptionObject<T>(subscription);
  cleanWithLockSet(input.lockSet, () => subscriptionObject.destroy());
  return subscriptionObject;
}
