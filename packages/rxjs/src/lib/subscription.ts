import { Unsubscribable, type Subscription } from 'rxjs';
import { type ArrayOrValue, convertToArray, type Destroyable, type Maybe } from '@dereekb/util';

/**
 * Destroyable object that wraps an Unsubscribable.
 */
export class SubscriptionObject<T extends Unsubscribable = Unsubscribable> implements Destroyable {
  private _subscription?: Maybe<T>;

  constructor(sub?: Maybe<T>) {
    if (sub) {
      this.setSub(sub);
    }
  }

  public get hasSubscription(): boolean {
    return Boolean(this._subscription);
  }

  public set subscription(sub: Maybe<T | void>) {
    this.setSub(sub);
  }

  public setSub(sub: Maybe<T | void>) {
    this.unsub();
    this._subscription = sub as T | undefined;
  }

  public unsub() {
    if (this._subscription) {
      this._subscription.unsubscribe();
      delete this._subscription;
    }
  }

  public destroy() {
    this.unsub();
  }
}

/**
 * Destroyable object that wraps an array of subscriptions.
 *
 * NOTE: In some cases it might be better to use RXJS's merge(...[]) and subscribe to a single item.
 */
export class MultiSubscriptionObject<T extends Unsubscribable = Unsubscribable> implements Destroyable {
  private _subscriptions?: T[];

  constructor(subs?: ArrayOrValue<T>) {
    if (subs) {
      this.setSubs(subs);
    }
  }

  public get hasSubscription(): boolean {
    return Boolean(this._subscriptions?.length);
  }

  public set subscriptions(subs: ArrayOrValue<T>) {
    this.setSubs(subs);
  }

  public setSubs(subs: ArrayOrValue<T>) {
    this.unsub();
    this._subscriptions = convertToArray(subs);
  }

  public unsub() {
    if (this._subscriptions) {
      this._subscriptions.forEach((x) => x.unsubscribe());
      delete this._subscriptions;
    }
  }

  public destroy() {
    this.unsub();
  }
}
