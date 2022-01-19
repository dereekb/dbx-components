import { Directive, NgZone, OnDestroy, OnInit } from '@angular/core';
import { filter } from 'rxjs/operators';
import { DbNgxRouterTransitionEventType } from './transition';
import { DbNgxRouterTransitionService } from '../service/router.transition.service';
import { SubscriptionObject } from '@dereekb/util-rxjs';

/**
 * Abstract directive that listens to onSuccess transition events and runs a function.
 */
@Directive()
export abstract class AbstractTransitionWatcherDirective implements OnInit, OnDestroy {

  private _transitionSub = new SubscriptionObject();

  constructor(protected readonly dbNgxRouterTransitionService: DbNgxRouterTransitionService, protected readonly ngZone: NgZone) { }

  ngOnInit(): void {
    this._transitionSub.subscription = this.dbNgxRouterTransitionService.transitions$.pipe(
      filter(x => x.type === DbNgxRouterTransitionEventType.SUCCESS)
    ).subscribe(() => {
      this.updateForSuccessfulTransition();
    });
  }

  ngOnDestroy(): void {
    this._transitionSub.destroy();
  }

  // MARK: Action
  protected zoneUpdateForSuccessfulTransition(): void {
    this.ngZone.run(() => this.updateForSuccessfulTransition());
  }

  protected abstract updateForSuccessfulTransition(): void;

}
