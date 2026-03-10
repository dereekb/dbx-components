import { type Observable, BehaviorSubject, map, shareReplay, of, switchMap } from 'rxjs';
import { type Destroyable, type Initialized, type Maybe, type ModelKey } from '@dereekb/util';
import { type MaybeObservableOrValueGetter, type SwitchMapToDefaultFilterFunction } from '@dereekb/rxjs';
import { type DbxRouterService } from '../router/service';
import { type DbxRouteParamReader, dbxRouteParamReaderInstance, DbxRouteParamDefaultRedirectInstance } from '../router/util';

/**
 * Default identifier used by dbxRouteModelIdParamRedirect() that corresponds to the id param of the model in the current route.
 */
export const DBX_ROUTE_MODEL_ID_PARAM_DEFAULT_ID_PARAM_KEY = 'id';

/**
 * Default identifier used by dbxRouteModelIdParamRedirect() that corresponds to the key param of the model in the current route.
 */
export const DBX_ROUTE_MODEL_ID_PARAM_DEFAULT_KEY_PARAM_KEY = 'key';

/**
 * Default value used by dbxRouteModelIdParamRedirect() for when a value is not available or provided.
 */
export const DBX_ROUTE_MODEL_ID_PARAM_DEFAULT_USE_PARAM_VALUE = '0';

/**
 * Reads a model identifier from the current route by parameter key, with support for automatic
 * redirect when the parameter matches a placeholder value (e.g., `'0'`).
 *
 * Extends {@link DbxRouteParamReader} with redirect and decision logic so that routes with
 * placeholder identifiers can be automatically resolved to a meaningful default.
 *
 * @example
 * ```ts
 * const redirect = dbxRouteModelIdParamRedirect(routerService);
 * redirect.init();
 *
 * // Observe the resolved id (after redirect logic is applied)
 * redirect.id$.subscribe(id => console.log('Model ID:', id));
 * ```
 *
 * @see {@link DbxRouteParamReader}
 * @see {@link dbxRouteModelIdParamRedirect} for creating instances
 */
export interface DbxRouteModelIdParamRedirect extends DbxRouteParamReader<ModelKey> {
  /**
   * The id value as it is from the current state's params.
   */
  readonly idFromParams$: Observable<Maybe<ModelKey>>;
  /**
   * The id value as it is when considering the default value.
   */
  readonly id$: Observable<Maybe<ModelKey>>;
  setRedirectEnabled(redirect: Maybe<boolean>): void;
  setDecider(decider: string | SwitchMapToDefaultFilterFunction<ModelKey>): void;
}

/**
 * Full lifecycle instance of a {@link DbxRouteModelIdParamRedirect} that supports initialization and destruction.
 *
 * Provides mutable setters for the parameter key, default value, redirect enabled state, and decision function.
 *
 * @see {@link DbxRouteModelIdParamRedirect}
 * @see {@link dbxRouteModelIdParamRedirect} for creating instances
 */
export interface DbxRouteModelIdParamRedirectInstance extends DbxRouteModelIdParamRedirect, DbxRouteParamReader<ModelKey>, Initialized, Destroyable {
  readonly paramValue$: Observable<Maybe<string>>;
  readonly defaultValue$: Observable<Maybe<string>>;
  readonly value$: Observable<Maybe<string>>;

  readonly idFromParams$: Observable<Maybe<ModelKey>>;
  readonly id$: Observable<Maybe<ModelKey>>;

  setParamKey(paramKey: Maybe<string>): void;

  setDefaultValue(defaultValue: MaybeObservableOrValueGetter<string>): void;
  setRedirectEnabled(redirect: Maybe<boolean>): void;

  setDecider(decider: string | SwitchMapToDefaultFilterFunction<ModelKey>): void;
  setParamValue(value: MaybeObservableOrValueGetter<string>): void;
}

/**
 * Creates a {@link DbxRouteModelIdParamRedirectInstance} configured to read a "key" parameter from the current route.
 *
 * This is a convenience wrapper around {@link dbxRouteModelIdParamRedirect} that defaults the parameter key to `'key'`.
 *
 * @param dbxRouterService - The router service to read parameters from.
 * @param defaultParamKey - The route parameter key to read. Defaults to `'key'`.
 * @returns A new redirect instance.
 *
 * @see {@link dbxRouteModelIdParamRedirect}
 */
export function dbxRouteModelKeyParamRedirect(dbxRouterService: DbxRouterService, defaultParamKey: string = DBX_ROUTE_MODEL_ID_PARAM_DEFAULT_KEY_PARAM_KEY): DbxRouteModelIdParamRedirectInstance {
  return dbxRouteModelIdParamRedirect(dbxRouterService, defaultParamKey);
}

/**
 * Creates a {@link DbxRouteModelIdParamRedirectInstance} that reads a model identifier from the current route
 * and optionally redirects when the value matches a placeholder (defaulting to `'0'`).
 *
 * The instance must be initialized via `init()` to activate the redirect behavior, and destroyed via `destroy()`
 * when no longer needed.
 *
 * @param dbxRouterService - The router service to read parameters from and perform redirects with.
 * @param defaultParamKey - The route parameter key to read. Defaults to `'id'`.
 * @returns A new redirect instance.
 *
 * @see {@link DbxRouteModelIdParamRedirectInstance}
 * @see {@link dbxRouteModelKeyParamRedirect} for the key-based variant
 */
export function dbxRouteModelIdParamRedirect(dbxRouterService: DbxRouterService, defaultParamKey: string = DBX_ROUTE_MODEL_ID_PARAM_DEFAULT_ID_PARAM_KEY): DbxRouteModelIdParamRedirectInstance {
  const _paramReader = dbxRouteParamReaderInstance<ModelKey>(dbxRouterService, defaultParamKey);
  const _paramRedirect = new DbxRouteParamDefaultRedirectInstance<ModelKey>(_paramReader);
  const _useDefaultParamDecider = new BehaviorSubject<string | SwitchMapToDefaultFilterFunction<ModelKey>>(DBX_ROUTE_MODEL_ID_PARAM_DEFAULT_USE_PARAM_VALUE);

  const _useDefaultParam$: Observable<SwitchMapToDefaultFilterFunction<ModelKey>> = _useDefaultParamDecider.pipe(
    map((x) => {
      let result: SwitchMapToDefaultFilterFunction<ModelKey>;

      if (typeof x === 'string') {
        result = (value: Maybe<ModelKey>) => of(value === x);
      } else {
        result = x;
      }

      return result;
    }),
    shareReplay(1)
  );

  const setParamKey = (paramKey: Maybe<string>) => {
    _paramReader.setParamKey(paramKey || defaultParamKey);
  };

  const paramValue$ = _paramReader.paramValue$;
  const value$ = _paramReader.value$;

  const result: DbxRouteModelIdParamRedirectInstance = {
    paramValue$,
    defaultValue$: _paramReader.defaultValue$,
    value$,
    idFromParams$: paramValue$,
    id$: value$,

    init(): void {
      _paramRedirect.setUseDefaultFilter((value: Maybe<string>) => {
        return _useDefaultParam$.pipe(switchMap((x) => x(value)));
      });

      _paramRedirect.init();
    },

    destroy(): void {
      _paramReader.destroy();
      _paramRedirect.destroy();
      _useDefaultParamDecider.complete();
    },

    getParamKey(): string {
      return _paramReader.getParamKey();
    },

    setParamKey,

    setDefaultValue(defaultValue: MaybeObservableOrValueGetter<string>): void {
      _paramReader.setDefaultValue(defaultValue);
    },

    setRedirectEnabled(redirect: Maybe<boolean>): void {
      _paramRedirect.enabled = redirect !== false;
    },

    setDecider(decider: string | SwitchMapToDefaultFilterFunction<ModelKey>): void {
      _useDefaultParamDecider.next(decider);
    },

    setParamValue(value: MaybeObservableOrValueGetter<string>): void {
      _paramReader.setParamValue(value);
    }
  };

  return result;
}
