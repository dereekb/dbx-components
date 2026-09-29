import { Directive, inject, input } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { asObservable, filterMaybe, FilterMap, type FilterMapKey, type ObservableOrValue } from '@dereekb/rxjs';
import { areEqualPOJOValues, type Maybe } from '@dereekb/util';
import { combineLatest, distinctUntilChanged, filter, first, from, map, merge, of, shareReplay, skip, switchMap, tap, withLatestFrom, type Observable } from 'rxjs';
import { DbxRouterService } from '../router/router/service/router.service';
import { type SegueRefRawSegueParams } from '../router/segue';
import { cleanSubscription } from '../rxjs/subscription';

/**
 * Configuration for {@link DbxFilterMapRouteParamsDirective}.
 *
 * @typeParam F - The filter type.
 */
export interface DbxFilterMapRouteParamsConfig<F> {
  /**
   * Filter map key the route params load into and are written from.
   */
  readonly key: FilterMapKey;
  /**
   * Reads the key's filter from the current route params.
   *
   * Return null/undefined when the params carry no filter, so the default filter is used instead.
   */
  readonly filterFromParams: (params: SegueRefRawSegueParams) => Maybe<F>;
  /**
   * Filter to use when the route params carry none.
   */
  readonly defaultFilter?: Maybe<ObservableOrValue<F>>;
  /**
   * Converts the key's filter to the route params it is written as. When set, every change to the key is written to the
   * current URL, replacing the current history entry.
   *
   * A filter whose params match the default filter's params removes those params from the URL, so the URL only carries a
   * filter that differs from the default. Set a param to null to remove it.
   */
  readonly paramsFromFilter?: Maybe<(filter: F) => SegueRefRawSegueParams>;
}

/**
 * Loads the filter of a keyed entry in an ancestor {@link FilterMap} from the current route params, so a link can open the page on a specific filter.
 *
 * The params' filter becomes the key's default filter when the page loads, and a later change to the params (such as a link to
 * the same page with other params) sets the key's filter. When {@link DbxFilterMapRouteParamsConfig.paramsFromFilter} is set,
 * every change to the key is also written back to the URL, so reloading the page keeps the filter.
 *
 * The params must be declared on the current route (for UIRouter, as query params of an ancestor state, ideally `dynamic: true`
 * so writing them does not reload the state). Do not use it together with {@link DbxFilterMapStorageDirective} on the same key,
 * since both set the key's default filter.
 *
 * @dbxFilter
 * @dbxFilterSlug map-route-params
 * @dbxFilterRelated map, map-storage, map-source-connector
 * @dbxFilterSkillRefs dbx__ref__dbx-component-patterns
 *
 * @example
 * ```html
 * <div dbxFilterMap>
 *   <my-filter-button [dbxFilterMapSourceConnector]="'list'" [dbxFilterMapRouteParams]="routeParamsConfig"></my-filter-button>
 * </div>
 * ```
 *
 * @example
 * ```ts
 * // the route declares the params, e.g. url: '/list?start&end', params: { start: { dynamic: true }, end: { dynamic: true } }
 * readonly routeParamsConfig: DbxFilterMapRouteParamsConfig<MyListFilter> = {
 *   key: 'list',
 *   defaultFilter: {},
 *   filterFromParams: (params) => {
 *     const dateRange = iso8601DayStringRangeParamsToDateRange(params);
 *     return dateRange ? { dateRange } : undefined;
 *   },
 *   paramsFromFilter: (filter) => (filter.dateRange ? { ...dateOrDayStringRangeToISO8601DayStringRange(filter.dateRange) } : { start: null, end: null })
 * };
 * ```
 */
@Directive({
  selector: '[dbxFilterMapRouteParams]',
  exportAs: 'dbxFilterMapRouteParams'
})
export class DbxFilterMapRouteParamsDirective<F> {
  readonly dbxFilterMap = inject(FilterMap<F>);
  readonly dbxRouterService = inject(DbxRouterService);

  /**
   * The key to load and how to read and write its params.
   */
  readonly dbxFilterMapRouteParams = input<Maybe<DbxFilterMapRouteParamsConfig<F>>>();

  readonly config$ = toObservable(this.dbxFilterMapRouteParams).pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));

  constructor() {
    cleanSubscription(this.config$.pipe(switchMap((config) => this._syncFilter(config))).subscribe());
  }

  /**
   * Sets the params' filter as the key's default filter, then returns an observable that keeps the key and the params in sync.
   *
   * @param config - The key to load and how to read and write its params.
   * @returns Observable that sets the key's filter when the params change and, when paramsFromFilter is set, writes the key's filter to the URL, while subscribed.
   */
  private _syncFilter(config: DbxFilterMapRouteParamsConfig<F>): Observable<unknown> {
    const { key, filterFromParams, paramsFromFilter } = config;
    const defaultFilter$ = asObservable(config.defaultFilter).pipe(shareReplay(1));
    const filterForParams = (params: SegueRefRawSegueParams): Observable<Maybe<F>> => {
      const paramsFilter = filterFromParams(params);
      return paramsFilter == null ? defaultFilter$.pipe(first()) : of(paramsFilter);
    };

    this.dbxFilterMap.addDefaultFilterObs(
      key,
      this.dbxRouterService.params$.pipe(
        first(),
        switchMap((params) => filterForParams(params)),
        filterMaybe()
      )
    );

    const keyFilter$ = this.dbxFilterMap.filterForKey(key);

    /**
     * The params the key's filter is written as, or undefined when the filter is not written to the URL.
     *
     * A filter that matches the default filter's params has each of its params set to null, so they are removed from the URL.
     */
    const writeParams$: Observable<Maybe<SegueRefRawSegueParams>> = paramsFromFilter
      ? combineLatest([keyFilter$, defaultFilter$.pipe(map((defaultFilter) => (defaultFilter == null ? undefined : paramsFromFilter(defaultFilter))))]).pipe(
          map(([keyFilter, defaultParams]) => {
            const params = paramsFromFilter(keyFilter);
            return defaultParams != null && areEqualPOJOValues(params, defaultParams) ? Object.fromEntries(Object.keys(params).map((paramKey) => [paramKey, null])) : params;
          }),
          shareReplay(1)
        )
      : of(undefined);

    const isMatchingParams = (params: SegueRefRawSegueParams, otherParams: SegueRefRawSegueParams) => Object.entries(params).every(([paramKey, value]) => (value ?? null) === (otherParams[paramKey] ?? null));

    /**
     * The route's current params, kept by the read pipe below.
     *
     * Read directly rather than with withLatestFrom(params$): the read pipe sets the key's filter while the params are still being
     * emitted, so a withLatestFrom subscribed after it would still hold the previous params and write them back to the URL.
     */
    let currentParams: SegueRefRawSegueParams = {};

    // params that change after the page loads set the key's filter, unless they are the params this directive just wrote
    const readParams$ = this.dbxRouterService.params$.pipe(
      tap((params) => (currentParams = params)),
      map((params) => ({ params, paramsFilter: filterFromParams(params) })),
      distinctUntilChanged((a, b) => areEqualPOJOValues(a.paramsFilter, b.paramsFilter)),
      skip(1), // the first params are loaded as the default filter
      withLatestFrom(writeParams$),
      filter(([{ params }, writtenParams]) => writtenParams == null || !isMatchingParams(writtenParams, params)),
      switchMap(([{ params }]) => filterForParams(params)),
      filterMaybe(),
      tap((paramsFilter) => this.dbxFilterMap.setFilterForKey(key, paramsFilter))
    );

    // only params that differ from the URL are written, which also stops the params read back from the URL being written again
    const writeParamsToUrl$ = writeParams$.pipe(
      filterMaybe(),
      filter((params) => !isMatchingParams(params, currentParams)),
      switchMap((params) => from(this.dbxRouterService.updateParams(params)))
    );

    // the read pipe is subscribed first so currentParams is set before anything is written
    return merge(readParams$, writeParamsToUrl$);
  }
}
