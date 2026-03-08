import { type Unsubscribable } from 'rxjs';
import { type ArrayOrValue, convertToArray, type Destroyable, type Maybe } from '@dereekb/util';

/**
 * Manages a single RxJS subscription with automatic cleanup on reassignment.
 *
 * When a new subscription is assigned, the previous one is automatically unsubscribed.
 * Implements {@link Destroyable} for integration with lifecycle management patterns.
 *
 * @example
 * ```ts
 * const sub = new SubscriptionObject();
 *
 * // Assign a subscription — previous one is automatically unsubscribed
 * sub.subscription = interval(1000).subscribe(console.log);
 * sub.subscription = interval(500).subscribe(console.log); // first subscription is cleaned up
 *
 * // Clean up when done
 * sub.destroy();
 * ```
 */
export class SubscriptionObject<T extends Unsubscribable = Unsubscribable> implements Destroyable {
  private _subscription?: Maybe<T>;

  /**
   * @param sub - optional initial subscription to manage
   */
  constructor(sub?: Maybe<T>) {
    if (sub) {
      this.setSub(sub);
    }
  }

  /**
   * Whether a subscription is currently being managed.
   */
  public get hasSubscription(): boolean {
    return Boolean(this._subscription);
  }

  /**
   * Sets the managed subscription, unsubscribing from any previous one.
   */
  public set subscription(sub: Maybe<T | void>) {
    this.setSub(sub);
  }

  /**
   * Replaces the current subscription with the given one, unsubscribing from the previous.
   *
   * @param sub - new subscription to manage, or `undefined`/`void` to just unsubscribe
   */
  public setSub(sub: Maybe<T | void>) {
    this.unsub();
    this._subscription = sub as T | undefined;
  }

  /**
   * Unsubscribes from the current subscription, if any.
   */
  public unsub() {
    if (this._subscription) {
      this._subscription.unsubscribe();
      delete this._subscription;
    }
  }

  /**
   * Unsubscribes from the current subscription and releases the reference.
   */
  public destroy() {
    this.unsub();
  }
}

/**
 * Manages multiple RxJS subscriptions as a group, with bulk unsubscribe and cleanup.
 *
 * Useful when multiple independent subscriptions share a lifecycle. For subscriptions that
 * should be merged into a single stream, consider using RxJS `merge(...)` instead.
 *
 * @example
 * ```ts
 * const subs = new MultiSubscriptionObject();
 *
 * subs.subscriptions = [
 *   source1$.subscribe(console.log),
 *   source2$.subscribe(console.log)
 * ];
 *
 * // Add more subscriptions later
 * subs.addSubs(source3$.subscribe(console.log));
 *
 * // Clean up all at once
 * subs.destroy();
 * ```
 */
export class MultiSubscriptionObject<T extends Unsubscribable = Unsubscribable> implements Destroyable {
  private _subscriptions?: T[];

  /**
   * @param subs - optional initial subscription(s) to manage
   */
  constructor(subs?: ArrayOrValue<T>) {
    if (subs) {
      this.setSubs(subs);
    }
  }

  /**
   * Whether any subscriptions are currently being managed.
   */
  public get hasSubscription(): boolean {
    return Boolean(this._subscriptions?.length);
  }

  /**
   * Replaces all managed subscriptions, unsubscribing from previous ones.
   */
  public set subscriptions(subs: ArrayOrValue<T>) {
    this.setSubs(subs);
  }

  /**
   * Replaces all managed subscriptions with the given ones, unsubscribing from all previous.
   *
   * @param subs - new subscription(s) to manage
   */
  public setSubs(subs: ArrayOrValue<T>) {
    this.unsub();
    this._subscriptions = convertToArray(subs);
  }

  /**
   * Adds subscription(s) to the managed set without affecting existing ones. Duplicate subscriptions are ignored.
   *
   * @param subs - subscription(s) to add
   */
  public addSubs(subs: ArrayOrValue<T>) {
    const nextSubscriptions = [...(this._subscriptions ?? [])];

    convertToArray(subs).forEach((sub) => {
      if (!nextSubscriptions.includes(sub)) {
        nextSubscriptions.push(sub);
      }
    });

    this._subscriptions = nextSubscriptions;
  }

  /**
   * Unsubscribes from all managed subscriptions and clears the list.
   */
  public unsub() {
    if (this._subscriptions) {
      this._subscriptions.forEach((x) => x.unsubscribe());
      delete this._subscriptions;
    }
  }

  /**
   * Unsubscribes from all managed subscriptions and releases references.
   */
  public destroy() {
    this.unsub();
  }
}
