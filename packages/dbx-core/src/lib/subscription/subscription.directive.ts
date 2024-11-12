import { OnDestroy, Directive, Inject, Optional } from '@angular/core';
import { Subscription } from 'rxjs';
import { SubscriptionObject, LockSet } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';

/**
 * Abstract component that contains a SubscriptionObject and will clean it up automatically.
 */
@Directive()
export abstract class AbstractSubscriptionDirective implements OnDestroy {
  private _subscriptionObject = new SubscriptionObject();

  constructor(@Inject(null) @Optional() subscription?: Subscription) {
    this.sub = subscription;

    // TODO: Remove this constructor in a future release with breaking changes. It rarely gets used and the sub class requires a constructor set to avoid injection.
  }

  ngOnDestroy(): void {
    this._subscriptionObject.destroy();
  }

  protected set sub(subscription: Maybe<Subscription | undefined>) {
    this._subscriptionObject.subscription = subscription;
  }
}

/**
 * AbstractSubscriptionDirective extension that prevents the OnDestroy from occuring until the lockset is unlocked.
 */
@Directive()
export abstract class AbstractLockSetSubscriptionDirective extends AbstractSubscriptionDirective implements OnDestroy {
  readonly lockSet = new LockSet();

  constructor() {
    super();
  }

  override ngOnDestroy(): void {
    this.lockSet.onNextUnlock(() => this.onLockSetDestroy());
  }

  protected onLockSetDestroy(): void {
    super.ngOnDestroy();
  }
}
