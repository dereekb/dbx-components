import { distinctUntilKeysChange } from '@dereekb/rxjs';
import { ArrayOrValue, asArray, filterMaybeArrayValues, IndexRef } from '@dereekb/util';
import { filter, map, MonoTypeOperatorFunction, Observable, distinctUntilChanged, shareReplay, startWith } from 'rxjs';
import { SegueRefOrSegueRefRouterLink } from '../../segue';
import { DbxRouterService } from '../service/router.service';
import { DbxRouterTransitionService } from '../service/router.transition.service';
import { DbxRouterTransitionEvent, DbxRouterTransitionEventType } from './transition';

/**
 * Convenience function for filtering success from the input observable.
 *
 * @param obs
 * @returns
 */
export function successTransition(obs: Observable<DbxRouterTransitionEvent>): Observable<DbxRouterTransitionEvent> {
  return obs.pipe(filterTransitionSuccess());
}

export function filterTransitionSuccess(): MonoTypeOperatorFunction<DbxRouterTransitionEvent> {
  return filterTransitionEvent(DbxRouterTransitionEventType.SUCCESS);
}

export function filterTransitionEvent(type: DbxRouterTransitionEventType): MonoTypeOperatorFunction<DbxRouterTransitionEvent> {
  return filter((x) => x.type === type);
}
// MARK: LatestSuccessfulRoutesConfig
export interface LatestSuccessfulRoutesConfigRoute {
  /**
   * Route to check if it is active or not.
   */
  readonly route: SegueRefOrSegueRefRouterLink;
  /**
   * Whether or not to match the route exactly.
   */
  readonly activeExactly?: boolean;
}

interface LatestSuccessfulRoutesConfigRouteItem<T> extends IndexRef {
  readonly r: T;
}

/**
 * latestSuccessfulRoute() config
 */
export interface LatestSuccessfulRoutesConfig<T extends LatestSuccessfulRoutesConfigRoute> {
  readonly dbxRouterTransitionService: DbxRouterTransitionService;
  readonly dbxRouterService: DbxRouterService;
  /**
   * Route or list of routes to check if they're active or not.
   */
  readonly routes: ArrayOrValue<T>;
}

/**
 * Creates a new observable that uses the input DbxRouterTransitionService and DbxRouterService to determine whether or not any of the configured routes are active.
 *
 * @param obs
 * @param config
 * @returns
 */
export function latestSuccessfulRoutes<T extends LatestSuccessfulRoutesConfigRoute>(config: LatestSuccessfulRoutesConfig<T>): Observable<T[]> {
  const { dbxRouterTransitionService, dbxRouterService, routes: inputRoutes } = config;
  const routes: LatestSuccessfulRoutesConfigRouteItem<T>[] = asArray(inputRoutes).map((r, i) => ({ r, i }));
  const checkRoutes: (() => LatestSuccessfulRoutesConfigRouteItem<T> | undefined)[] = routes.map((routeConfig) => {
    const { r: route } = routeConfig;
    return route.activeExactly ? () => (dbxRouterService.isActiveExactly(route.route) ? routeConfig : undefined) : () => (dbxRouterService.isActive(route.route) ? routeConfig : undefined);
  });

  return successTransition(dbxRouterTransitionService.transitions$).pipe(
    startWith(undefined),
    map(() => {
      const activeRoutes: LatestSuccessfulRoutesConfigRouteItem<T>[] = filterMaybeArrayValues(checkRoutes.map((x) => x()));
      return activeRoutes;
    }),
    distinctUntilKeysChange((x) => x.i),
    map((x) => x.map((y) => y.r)),
    shareReplay(1)
  );
}

// MARK: IsLatestSuccessfulRouteConfig
/**
 * isLatestSuccessfulRoute() config
 */
export interface IsLatestSuccessfulRouteConfig {
  readonly dbxRouterTransitionService: DbxRouterTransitionService;
  readonly dbxRouterService: DbxRouterService;
  /**
   * Route or list of routes to check if they're active or not.
   */
  readonly routes: ArrayOrValue<SegueRefOrSegueRefRouterLink>;
  /**
   * Whether or not to match route activity exactly.
   */
  readonly activeExactly?: boolean;
}

/**
 * Creates a new observable that uses the input DbxRouterTransitionService and DbxRouterService to determine whether or not any of the configured routes are active.
 *
 * @param obs
 * @param config
 * @returns
 */
export function isLatestSuccessfulRoute(config: IsLatestSuccessfulRouteConfig): Observable<boolean> {
  const { dbxRouterTransitionService, dbxRouterService, activeExactly } = config;
  const routes = asArray(config.routes);
  const checkRoute: (route: SegueRefOrSegueRefRouterLink) => boolean = activeExactly ? (route: SegueRefOrSegueRefRouterLink) => dbxRouterService.isActiveExactly(route) : (route: SegueRefOrSegueRefRouterLink) => dbxRouterService.isActive(route);

  return successTransition(dbxRouterTransitionService.transitions$).pipe(
    startWith(undefined),
    map(() => {
      const isActive = routes.findIndex(checkRoute) !== -1;
      return isActive;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );
}
