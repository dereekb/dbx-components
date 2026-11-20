import { type ObservableOrValue, asObservable } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { firstValueFrom } from 'rxjs';
import { type SegueRefOrSegueRefRouterLink } from '../../segue';
import { type DbxRouterService, type DbxRouterServiceGoOptions } from './router.service';

/**
 * A function type that performs router navigation using a {@link SegueRef} or router link string.
 *
 * Takes the route, or an observable of it, and optional {@link DbxRouterServiceGoOptions} that are passed to
 * {@link DbxRouterService.go}. Returns a promise that resolves to `true` if the navigation was successful.
 *
 * @see {@link goWithRouter} for creating instances
 */
export type GoWithRouter = (route: ObservableOrValue<SegueRefOrSegueRefRouterLink>, options?: Maybe<DbxRouterServiceGoOptions>) => Promise<boolean>;

/**
 * Creates a navigation function bound to the given {@link DbxRouterService}.
 *
 * The returned function accepts either a {@link SegueRef}, a router link string, or an observable of either,
 * resolves it to a single value, and calls `go()` on the router service with the given options.
 *
 * @param dbxRouterService - The router service to use for navigation.
 * @returns Navigates to the given route and returns a promise resolving to the navigation result.
 *
 * @see {@link GoWithRouter}
 *
 * @example
 * ```ts
 * const navigate = goWithRouter(routerService);
 * await navigate({ ref: 'app.dashboard' });
 *
 * // Replace the current history entry instead of adding one
 * await navigate({ ref: 'app.dashboard' }, { replace: true });
 * ```
 */
export function goWithRouter(dbxRouterService: DbxRouterService): GoWithRouter {
  return (route, options) => {
    return firstValueFrom(asObservable(route)).then((x) => dbxRouterService.go(x, options));
  };
}
