import { Directive, NgZone, OnDestroy, OnInit } from '@angular/core';
import { SubscriptionObject } from '@dereekb/rxjs';
import { DbxRouterTransitionService } from '../service/router.transition.service';
import { AbstractTransitionDirective } from './transition.directive';

/**
 * Abstract directive that listens to onSuccess transition events and runs a function.
 */
@Directive()
export abstract class AbstractTransitionWatcherDirective extends AbstractTransitionDirective implements OnInit, OnDestroy {

  private _transitionSub = new SubscriptionObject();

  ngOnInit(): void {
    this._transitionSub.subscription = this.transitionSuccess$.subscribe(() => {
      this.updateForSuccessfulTransition();
    });
  }

  ngOnDestroy(): void {
    this._transitionSub.destroy();
  }

  constructor(dbxRouterTransitionService: DbxRouterTransitionService, protected readonly ngZone: NgZone) {
    super(dbxRouterTransitionService);
  }

  // MARK: Action
  protected zoneUpdateForSuccessfulTransition(): void {
    this.ngZone.run(() => this.updateForSuccessfulTransition());
  }

  protected abstract updateForSuccessfulTransition(): void;

}
