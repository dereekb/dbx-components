import { Subscription } from 'rxjs';
import { ArrayOrValue, convertToArray, Destroyable } from '@dereekb/util';

/**
 * Destroyable object that wraps a subscription.
 */
export class SubscriptionObject implements Destroyable {

  private _subscription?: Subscription;

  constructor(sub?: Subscription) {
    if (sub) {
      this.setSub(sub);
    }
  }

  public get hasSubscription(): boolean {
    return Boolean(this._subscription);
  }

  public set subscription(sub: Subscription | undefined) {
    this.setSub(sub);
  }

  public setSub(sub: Subscription | undefined) {
    this.unsub();
    this._subscription = sub;
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
export class MultiSubscriptionObject implements Destroyable {

  private _subscriptions?: Subscription[];

  constructor(subs?: ArrayOrValue<Subscription>) {
    if (subs) {
      this.setSubs(subs);
    }
  }

  public get hasSubscription(): boolean {
    return Boolean(this._subscriptions?.length);
  }

  public set subscriptions(subs: ArrayOrValue<Subscription>) {
    this.setSubs(subs);
  }

  public setSubs(subs: ArrayOrValue<Subscription>) {
    this.unsub();
    this._subscriptions = convertToArray(subs);
  }

  public unsub() {
    if (this._subscriptions) {
      this._subscriptions.forEach(x => x.unsubscribe());
      delete this._subscriptions;
    }
  }

  public destroy() {
    this.unsub();
  }

}
