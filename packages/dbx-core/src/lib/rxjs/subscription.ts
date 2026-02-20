import { DestroyRef, inject } from '@angular/core';
import { DestroyOnNextUnlockConfig, LockSet, OnLockSetUnlockedConfig, SubscriptionObject } from '@dereekb/rxjs';
import { GetterOrValue, getValueFromGetter, Maybe } from '@dereekb/util';
import { Unsubscribable } from 'rxjs';

/**
 * Creates a new SubscriptionObject that is automatically destroyed when the component is destroyed.
 *
 * Must be run within an Angular injection context.
 */
export function subscriptionObject<T extends Unsubscribable = Unsubscribable>(sub?: Maybe<GetterOrValue<T>>): SubscriptionObject<T> {
  const destroyRef = inject(DestroyRef);

  const subscription = getValueFromGetter(sub);
  const subscriptionObject = new SubscriptionObject<T>(subscription);

  destroyRef.onDestroy(() => {
    subscriptionObject.destroy();
  });

  return subscriptionObject;
}
