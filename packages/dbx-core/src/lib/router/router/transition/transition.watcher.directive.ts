import { Directive } from '@angular/core';
import { AbstractTransitionDirective } from './transition.directive';
import { cleanSubscription } from '../../../rxjs/subscription';

/**
 * Abstract directive that automatically calls {@link updateForSuccessfulTransition} on each successful router transition.
 *
 * Extends {@link AbstractTransitionDirective} by subscribing to successful transitions during construction
 * and invoking the abstract `updateForSuccessfulTransition()` method for each one.
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
  constructor() {
    super();

    cleanSubscription(
      this.transitionSuccess$.subscribe(() => {
        this.updateForSuccessfulTransition();
      })
    );
  }

  protected abstract updateForSuccessfulTransition(): void;
}
