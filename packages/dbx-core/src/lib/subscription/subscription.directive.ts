import { OnDestroy, Directive } from '@angular/core';
import { Subscription, Unsubscribable } from 'rxjs';
import { SubscriptionObject, LockSet } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';

/**
 * Abstract component that contains a SubscriptionObject and will clean it up automatically.
 */
@Directive()
export abstract class AbstractSubscriptionDirective<T extends Unsubscribable = Unsubscribable> implements OnDestroy {
  private readonly _subscriptionObject = new SubscriptionObject();

  ngOnDestroy(): void {
    this._subscriptionObject.destroy();
  }

  protected set sub(subscription: Maybe<T | void>) {
    this._subscriptionObject.subscription = subscription;
  }
}

/**
 * AbstractSubscriptionDirective extension that prevents the OnDestroy from occuring until the lockset is unlocked.
 */
@Directive()
export abstract class AbstractLockSetSubscriptionDirective<T extends Unsubscribable = Unsubscribable> extends AbstractSubscriptionDirective<T> implements OnDestroy {
  readonly lockSet = new LockSet();

  override ngOnDestroy(): void {
    this.lockSet.onNextUnlock(() => this.onLockSetDestroy());
  }

  protected onLockSetDestroy(): void {
    super.ngOnDestroy();
  }
}
