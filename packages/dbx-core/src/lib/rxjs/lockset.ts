import { DestroyRef, inject } from '@angular/core';
import { DestroyOnNextUnlockConfig, LockSet } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { subscriptionObject } from './subscription';

export interface LockSetConfig {
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
export function lockSet(config?: Maybe<LockSetConfig>): LockSet {
  const { onDestroy, onLockSetDestroy, destroyLocksetTiming } = config ?? {};

  const destroyRef = inject(DestroyRef);
  const lockSet = new LockSet();

  destroyRef.onDestroy(() => {
    onDestroy?.();
    lockSet.destroyOnNextUnlock(destroyLocksetTiming); // flag to be destroyed on the next complete unlock
  });

  if (onLockSetDestroy) {
    const _destroySub = subscriptionObject(
      lockSet.onDestroy$.subscribe(() => {
        onLockSetDestroy();
        _destroySub.destroy();
      })
    );
  }

  return lockSet;
}
