import { type ObservableOrValue } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { type Observable } from 'rxjs';
import { type SegueRefOrSegueRefRouterLink, type SegueRefRawSegueParams } from '../../segue';
import { DbxRouterTransitionService } from './router.transition.service';

/**
 * Router-neutral options for {@link DbxRouterService.go}.
 *
 * Use these instead of a router's own options in the segue ref's `refOptions`, so the caller works with any
 * {@link DbxRouterService} implementation. Each implementation maps them to its router.
 */
export interface DbxRouterServiceGoOptions {
  /**
   * Replaces the current history entry instead of adding one, so the back button skips the page being left.
   *
   * Use it for pages that only redirect, such as a short link page. When true, it wins over a conflicting replace option
   * in the segue ref's `refOptions`. False or unset leaves history handling to the router and the segue ref's `refOptions`.
   */
  readonly replace?: Maybe<boolean>;
}

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
   * Pass `{ replace: true }` to replace the current history entry instead of adding one. UIRouter maps it to
   * `location: 'replace'` and Angular Router to `replaceUrl: true`, on top of any `refOptions` on the segue ref.
   * Anchors do not use these options; they only read `refOptions`.
   *
   * @param segueRef - The page to open, or an observable of it. Only its first value is used.
   * @param options - Router-neutral navigation options.
   * @returns Whether the navigation succeeded.
   *
   * @example
   * ```ts
   * // A page that only redirects, so it should not stay in the browser history
   * await this.dbxRouterService.go({ ref: 'app.jobs' }, { replace: true });
   * ```
   */
  abstract go(segueRef: ObservableOrValue<SegueRefOrSegueRefRouterLink>, options?: Maybe<DbxRouterServiceGoOptions>): Promise<boolean>;

  /**
   * Navigates to the current url with updated parameters. Will be merged with the existing parameters.
   *
   * The new state replaces the current entry in the history, like `go()` with `{ replace: true }`.
   *
   * @param params - The params to merge into the current params, or an observable of them.
   * @returns Whether the navigation succeeded.
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
