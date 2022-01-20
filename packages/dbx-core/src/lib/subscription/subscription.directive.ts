import { OnDestroy, Directive, Inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { SubscriptionObject, LockSet } from '@dereekb/util-rxjs';

/**
 * Abstract component that contains a SubscriptionObject and will clean it up automatically.
 */
@Directive()
export abstract class AbstractSubscriptionDirective implements OnDestroy {

  private _subscriptionObject = new SubscriptionObject();

  constructor(subscription?: Subscription) {
    this.sub = subscription;
  }

  ngOnDestroy(): void {
    this._subscriptionObject.destroy();
  }

  protected set sub(subscription: Subscription | undefined) {
    this._subscriptionObject.subscription = subscription;
  }

}


/**
 * AbstractSubscriptionDirective extension that prevents the OnDestroy from occuring until the lockset is unlocked.
 */
@Directive()
export abstract class AbstractLockSetSubscriptionDirective extends AbstractSubscriptionDirective implements OnDestroy {

  readonly lockSet = new LockSet();

  override ngOnDestroy(): void {
    this.lockSet.onNextUnlock(() => this.onLockSetDestroy());
  }

  protected onLockSetDestroy(): void {
    super.ngOnDestroy();
  }

}
