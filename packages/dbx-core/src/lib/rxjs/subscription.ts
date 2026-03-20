import { SubscriptionObject } from '@dereekb/rxjs';
import { type GetterOrValue, getValueFromGetter, type Maybe } from '@dereekb/util';
import { type Unsubscribable } from 'rxjs';
import { clean } from './clean';

// MARK: cleanSubscription()
/**
 * Creates a new SubscriptionObject that is automatically destroyed when the context is destroyed.
 *
 * Must be run within an Angular injection context.
 *
 * @example
 * // Pass a subscription directly - it will be cleaned up automatically:
 * cleanSubscription(obs$.subscribe(handler));
 *
 * // Or create first, then set the subscription later:
 * readonly _sub = cleanSubscription();
 * this._sub.subscription = obs$.subscribe(handler);
 *
 * @param sub - Optional subscription or getter to wrap.
 * @returns A SubscriptionObject that is automatically destroyed when the context is destroyed.
 */
export function cleanSubscription<T extends Unsubscribable = Unsubscribable>(sub?: Maybe<GetterOrValue<T>>): SubscriptionObject<T> {
  const subscription = getValueFromGetter(sub);
  const subscriptionObject = new SubscriptionObject<T>(subscription);
  clean(subscriptionObject);
  return subscriptionObject;
}
