import { Directive, NgZone, inject } from '@angular/core';
import { AbstractTransitionDirective } from './transition.directive';
import { cleanSubscription } from '../../../rxjs/subscription';

/**
 * Abstract directive that automatically calls {@link updateForSuccessfulTransition} on each successful router transition.
 *
 * Extends {@link AbstractTransitionDirective} by subscribing to successful transitions during construction
 * and invoking the abstract `updateForSuccessfulTransition()` method for each one.
 *
 * Also provides a `zoneUpdateForSuccessfulTransition()` method that wraps the update call in `NgZone.run()`.
 *
 * @example
 * ```ts
 * @Directive({ selector: '[myRouteWatcher]' })
 * class MyRouteWatcherDirective extends AbstractTransitionWatcherDirective {
 *   protected updateForSuccessfulTransition(): void {
 *     console.log('Route changed successfully');
 *   }
 * }
 * ```
 *
 * @see {@link AbstractTransitionDirective}
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
