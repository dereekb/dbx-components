import { Directive, NgZone, inject } from '@angular/core';
import { AbstractTransitionDirective } from './transition.directive';
import { cleanSubscription } from '../../../rxjs/subscription';

/**
 * Abstract directive that listens to onSuccess transition events and runs a function.
 */
@Directive()
export abstract class AbstractTransitionWatcherDirective extends AbstractTransitionDirective {
  protected readonly ngZone = inject(NgZone);

  constructor() {
    super();

    cleanSubscription(
      this.transitionSuccess$.subscribe(() => {
        this.updateForSuccessfulTransition();
      })
    );
  }

  // MARK: Action
  protected zoneUpdateForSuccessfulTransition(): void {
    // TODO: NgZone Deprecation
    // remove this function and replace, if necessary or remove entirely with angular zoneless implementation details.
    this.ngZone.run(() => this.updateForSuccessfulTransition());
  }

  protected abstract updateForSuccessfulTransition(): void;
}
