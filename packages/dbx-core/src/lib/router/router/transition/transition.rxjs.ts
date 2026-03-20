import { distinctUntilKeysChange } from '@dereekb/rxjs';
import { type ArrayOrValue, asArray, filterMaybeArrayValues, type IndexRef } from '@dereekb/util';
import { filter, map, type MonoTypeOperatorFunction, type Observable, distinctUntilChanged, shareReplay, startWith } from 'rxjs';
import { type SegueRefOrSegueRefRouterLink } from '../../segue';
import { type DbxRouterService } from '../service/router.service';
import { type DbxRouterTransitionService } from '../service/router.transition.service';
import { type DbxRouterTransitionEvent, DbxRouterTransitionEventType } from './transition';

/**
 * Filters the given transition event observable to only emit successful transitions.
 *
 * Convenience function equivalent to applying {@link filterTransitionSuccess} as a pipe operator.
 *
 * @param obs - The source observable of router transition events.
 * @returns An observable that emits only successful transition events.
 *
 * @see {@link filterTransitionSuccess}
 */
export function successTransition(obs: Observable<DbxRouterTransitionEvent>): Observable<DbxRouterTransitionEvent> {
  return obs.pipe(filterTransitionSuccess());
}

/**
 * RxJS operator that filters transition events to only pass through successful transitions.
 *
 * @returns A `MonoTypeOperatorFunction` that filters for {@link DbxRouterTransitionEventType.SUCCESS} events.
 *
 * @see {@link filterTransitionEvent}
 */
export function filterTransitionSuccess(): MonoTypeOperatorFunction<DbxRouterTransitionEvent> {
  return filterTransitionEvent(DbxRouterTransitionEventType.SUCCESS);
}

/**
 * RxJS operator that filters transition events to only pass through events of the specified type.
 *
 * @param type - The transition event type to filter for.
 * @returns A `MonoTypeOperatorFunction` that only passes matching events.
 */
export function filterTransitionEvent(type: DbxRouterTransitionEventType): MonoTypeOperatorFunction<DbxRouterTransitionEvent> {
  return filter((x) => x.type === type);
}
// MARK: LatestSuccessfulRoutesConfig
/**
 * Configuration for a single route to check for activity within {@link latestSuccessfulRoutes}.
 *
 * @see {@link LatestSuccessfulRoutesConfig}
 */
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
 * Configuration for {@link latestSuccessfulRoutes}, specifying the router services and routes to monitor.
 *
 * @typeParam T - The route configuration type, extending {@link LatestSuccessfulRoutesConfigRoute}.
 *
 * @see {@link latestSuccessfulRoutes}
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
 * Creates an observable that emits the list of currently active routes after each successful transition.
 *
 * On each successful router transition, checks all configured routes against the router service
 * and emits an array of those that are active. The result is deduplicated by index and shared.
 *
 * @typeParam T - The route configuration type, extending {@link LatestSuccessfulRoutesConfigRoute}.
 * @param config - Configuration specifying the router services and routes to monitor.
 * @returns An observable emitting an array of the currently active route configurations.
 *
 * @see {@link LatestSuccessfulRoutesConfig}
 * @see {@link isLatestSuccessfulRoute} for a boolean variant
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
 * Configuration for {@link isLatestSuccessfulRoute}, specifying the router services, routes, and match mode.
 *
 * @see {@link isLatestSuccessfulRoute}
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
 * Creates an observable that emits `true` when any of the configured routes are active after a successful transition,
 * and `false` otherwise.
 *
 * This is a simplified boolean variant of {@link latestSuccessfulRoutes}.
 *
 * @param config - Configuration specifying the router services, routes, and match mode.
 * @returns An observable emitting `true` when at least one configured route is active, `false` otherwise.
 *
 * @see {@link IsLatestSuccessfulRouteConfig}
 * @see {@link latestSuccessfulRoutes} for the full route list variant
 */
export function isLatestSuccessfulRoute(config: IsLatestSuccessfulRouteConfig): Observable<boolean> {
  const { dbxRouterTransitionService, dbxRouterService, activeExactly } = config;
  const routes = asArray(config.routes);
  const checkRoute: (route: SegueRefOrSegueRefRouterLink) => boolean = activeExactly ? (route: SegueRefOrSegueRefRouterLink) => dbxRouterService.isActiveExactly(route) : (route: SegueRefOrSegueRefRouterLink) => dbxRouterService.isActive(route);

  return successTransition(dbxRouterTransitionService.transitions$).pipe(
    startWith(undefined),
    map(() => {
      return routes.some(checkRoute);
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );
}
