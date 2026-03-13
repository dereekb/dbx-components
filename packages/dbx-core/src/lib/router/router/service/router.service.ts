import { type ObservableOrValue } from '@dereekb/rxjs';
import { type Observable } from 'rxjs';
import { type SegueRefOrSegueRefRouterLink, type SegueRefRawSegueParams } from '../../segue';
import { DbxRouterTransitionService } from './router.transition.service';

/**
 * Abstract router service that provides navigation capabilities and routing state information.
 *
 * Extends {@link DbxRouterTransitionService} with navigation methods (`go`, `updateParams`) and
 * route inspection methods (`isActive`, `isActiveExactly`, `comparePrecision`).
 *
 * Concrete implementations include {@link DbxAngularRouterService} (Angular Router) and
 * {@link DbxUIRouterService} (UIRouter).
 *
 * @example
 * ```ts
 * // Inject and use in a component or service
 * @Component({ ... })
 * class MyComponent {
 *   private readonly router = inject(DbxRouterService);
 *
 *   navigateToDashboard(): void {
 *     this.router.go({ ref: 'app.dashboard', refParams: { tab: 'overview' } });
 *   }
 * }
 * ```
 *
 * @see {@link DbxRouterTransitionService} for transition event observables
 * @see {@link DbxAngularRouterService} for the Angular Router implementation
 * @see {@link DbxUIRouterService} for the UIRouter implementation
 */
export abstract class DbxRouterService extends DbxRouterTransitionService {
  /**
   * Params of the current successfully loaded route.
   */
  abstract readonly params$: Observable<SegueRefRawSegueParams>;

  /**
   * Navigates to the target SegueRef.
   *
   * @param segueRef
   */
  abstract go(segueRef: ObservableOrValue<SegueRefOrSegueRefRouterLink>): Promise<boolean>;

  /**
   * Navigates to the current url with updated parameters. Will be merged with the existing parameters.
   *
   * The new state will replace the current state in the history.
   *
   * @param segueRef
   */
  abstract updateParams(params: ObservableOrValue<SegueRefRawSegueParams>): Promise<boolean>;

  /**
   * Returns `true` if the input segue ref is considered active (hierarchical match).
   *
   * Accepts both state names (e.g., `'app.dashboard'`) and slash paths (e.g., `'/app/dashboard'`).
   * For non-exact checks, a parent route matches all of its children — e.g., `'/app/oauth'`
   * is active when the current path is `'/app/oauth/login'`.
   *
   * @param segueRef - A state name, URL path, or {@link SegueRef} to check against the current route.
   */
  abstract isActive(segueRef: SegueRefOrSegueRefRouterLink): boolean;

  /**
   * Returns `true` if the input segue ref matches the current route exactly.
   *
   * Unlike {@link isActive}, this does not match parent routes against child routes.
   *
   * @param segueRef - A state name, URL path, or {@link SegueRef} to check against the current route.
   */
  abstract isActiveExactly(segueRef: SegueRefOrSegueRefRouterLink): boolean;

  /**
   * Compares the two refs for precision for a certain route.
   *
   * For example, if the parent route is input with a child route, the child route is
   * considered more precise.
   *
   * @param a
   * @param b
   */
  abstract comparePrecision(a: SegueRefOrSegueRefRouterLink, b: SegueRefOrSegueRefRouterLink): number;
}
