import { type Observable, startWith } from 'rxjs';
import { Directive, inject } from '@angular/core';
import { DbxRouterTransitionService } from '../service/router.transition.service';
import { successTransition } from './transition.rxjs';

/**
 * Abstract directive that provides observables for reacting to successful router transitions.
 *
 * Subclasses can subscribe to `transitionSuccess$` to react to each successful navigation,
 * or use `initAndUpdateOnTransitionSuccess$` which also emits once immediately on initialization.
 *
 * @example
 * ```ts
 * @Directive({ selector: '[myTransitionHandler]' })
 * class MyTransitionHandlerDirective extends AbstractTransitionDirective {
 *   readonly data$ = this.initAndUpdateOnTransitionSuccess$.pipe(
 *     switchMap(() => this.loadData())
 *   );
 * }
 * ```
 *
 * @see {@link AbstractTransitionWatcherDirective} for a variant that automatically calls a callback
 * @see {@link DbxRouterTransitionService}
 */
@Directive()
export abstract class AbstractTransitionDirective {
  protected readonly dbxRouterTransitionService = inject(DbxRouterTransitionService);

  /**
   * Observable that emits on each successful router transition.
   */
  readonly transitionSuccess$ = successTransition(this.dbxRouterTransitionService.transitions$);
  /**
   * Observable that emits immediately on initialization and on each subsequent successful transition.
   */
  readonly initAndUpdateOnTransitionSuccess$: Observable<void> = this.transitionSuccess$.pipe(startWith(undefined)) as Observable<void>;
}
