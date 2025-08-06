import { Directive, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { SubscriptionObject } from '@dereekb/rxjs';
import { AbstractTransitionDirective } from './transition.directive';

/**
 * Abstract directive that listens to onSuccess transition events and runs a function.
 */
@Directive()
export abstract class AbstractTransitionWatcherDirective extends AbstractTransitionDirective implements OnInit, OnDestroy {
  private readonly _transitionSub = new SubscriptionObject();

  protected readonly ngZone = inject(NgZone);

  ngOnInit(): void {
    this._transitionSub.subscription = this.transitionSuccess$.subscribe(() => {
      this.updateForSuccessfulTransition();
    });
  }

  ngOnDestroy(): void {
    this._transitionSub.destroy();
  }

  // MARK: Action
  protected zoneUpdateForSuccessfulTransition(): void {
    // TODO: NgZone Deprecation
    // remove this function and replace, if necessary or remove entirely with angular zoneless implementation details.
    this.ngZone.run(() => this.updateForSuccessfulTransition());
  }

  protected abstract updateForSuccessfulTransition(): void;
}
