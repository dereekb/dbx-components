import { type ObservableOrValue, asObservable } from '@dereekb/rxjs';
import { firstValueFrom } from 'rxjs';
import { type SegueRef, type SegueRefOrSegueRefRouterLink } from '../../segue';
import { type DbxRouterService } from './router.service';

/**
 * A function type that performs router navigation using a {@link SegueRef}.
 *
 * Returns a promise that resolves to `true` if the navigation was successful.
 *
 * @see {@link goWithRouter} for creating instances
 */
export type GoWithRouter = (route: ObservableOrValue<SegueRef>) => Promise<boolean>;

/**
 * Creates a navigation function bound to the given {@link DbxRouterService}.
 *
 * The returned function accepts either a {@link SegueRef}, a router link string, or an observable of either,
 * resolves it to a single value, and calls `go()` on the router service.
 *
 * @param dbxRouterService - The router service to use for navigation.
 * @returns A function that navigates to the given route and returns a promise resolving to the navigation result.
 *
 * @example
 * ```ts
 * const navigate = goWithRouter(routerService);
 * await navigate({ ref: 'app.dashboard' });
 * ```
 *
 * @see {@link GoWithRouter}
 */
export function goWithRouter(dbxRouterService: DbxRouterService): (route: ObservableOrValue<SegueRefOrSegueRefRouterLink>) => Promise<boolean> {
  return (route) => {
    return firstValueFrom(asObservable(route)).then((x) => dbxRouterService.go(x));
  };
}
