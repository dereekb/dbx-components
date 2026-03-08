import { interval, type Subscription } from 'rxjs';
import { MultiSubscriptionObject, SubscriptionObject } from './subscription';

describe('SubscriptionObject', () => {
  it('should manage a single subscription and unsubscribe on reassignment', () => {
    const sub = new SubscriptionObject();
    const sub1: Subscription = interval(1000).subscribe();

    sub.subscription = sub1;
    expect(sub.hasSubscription).toBe(true);

    // Reassigning unsubscribes the previous
    const sub2: Subscription = interval(1000).subscribe();
    sub.subscription = sub2;
    expect(sub1.closed).toBe(true);
    expect(sub.hasSubscription).toBe(true);

    sub.destroy();
    expect(sub2.closed).toBe(true);
    expect(sub.hasSubscription).toBe(false);
  });

  it('should accept an initial subscription in the constructor', () => {
    const rawSub: Subscription = interval(1000).subscribe();
    const sub = new SubscriptionObject(rawSub);

    expect(sub.hasSubscription).toBe(true);

    sub.destroy();
    expect(rawSub.closed).toBe(true);
  });

  it('should handle unsub when no subscription is set', () => {
    const sub = new SubscriptionObject();
    expect(() => sub.unsub()).not.toThrow();
    expect(sub.hasSubscription).toBe(false);
  });
});

describe('MultiSubscriptionObject', () => {
  it('should manage multiple subscriptions and unsubscribe all on destroy', () => {
    const subs = new MultiSubscriptionObject();
    const sub1: Subscription = interval(1000).subscribe();
    const sub2: Subscription = interval(1000).subscribe();

    subs.subscriptions = [sub1, sub2];
    expect(subs.hasSubscription).toBe(true);

    subs.destroy();
    expect(sub1.closed).toBe(true);
    expect(sub2.closed).toBe(true);
    expect(subs.hasSubscription).toBe(false);
  });

  it('should add subscriptions without affecting existing ones', () => {
    const subs = new MultiSubscriptionObject();
    const sub1: Subscription = interval(1000).subscribe();
    const sub2: Subscription = interval(1000).subscribe();
    const sub3: Subscription = interval(1000).subscribe();

    subs.subscriptions = [sub1];
    subs.addSubs([sub2, sub3]);
    expect(subs.hasSubscription).toBe(true);

    subs.destroy();
    expect(sub1.closed).toBe(true);
    expect(sub2.closed).toBe(true);
    expect(sub3.closed).toBe(true);
  });

  it('should not add duplicate subscriptions', () => {
    const subs = new MultiSubscriptionObject();
    const sub1: Subscription = interval(1000).subscribe();

    subs.subscriptions = [sub1];
    subs.addSubs(sub1); // duplicate, should be ignored

    subs.destroy();
    // No error from double-unsubscribe means dedup worked
    expect(sub1.closed).toBe(true);
  });

  it('should replace all subscriptions on setSubs', () => {
    const subs = new MultiSubscriptionObject();
    const sub1: Subscription = interval(1000).subscribe();
    const sub2: Subscription = interval(1000).subscribe();

    subs.subscriptions = [sub1];
    subs.setSubs(sub2);

    expect(sub1.closed).toBe(true);
    expect(subs.hasSubscription).toBe(true);

    subs.destroy();
    expect(sub2.closed).toBe(true);
  });
});
