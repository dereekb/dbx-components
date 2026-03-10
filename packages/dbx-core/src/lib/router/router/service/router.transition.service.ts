import { type Observable } from 'rxjs';
import { type DbxRouterTransitionEvent } from '../transition/transition';

/**
 * Abstract service that provides an observable stream of router transition events.
 *
 * This is the base class for {@link DbxRouterService}, exposing only the transition
 * observation capability without navigation methods. Useful when a consumer only needs
 * to react to route changes without performing navigation.
 *
 * @example
 * ```ts
 * @Component({ ... })
 * class MyComponent {
 *   private readonly transitions = inject(DbxRouterTransitionService);
 *
 *   readonly onSuccess$ = this.transitions.transitions$.pipe(
 *     filter(e => e.type === DbxRouterTransitionEventType.SUCCESS)
 *   );
 * }
 * ```
 *
 * @see {@link DbxRouterService} for the full router service with navigation
 * @see {@link DbxRouterTransitionEvent} for the event type
 */
export abstract class DbxRouterTransitionService {
  /**
   * Observable that emits DbxRouterTransitionEvent values as transitions occur.
   */
  abstract readonly transitions$: Observable<DbxRouterTransitionEvent>;
}
