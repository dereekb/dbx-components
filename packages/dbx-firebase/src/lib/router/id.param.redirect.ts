import { Observable, BehaviorSubject, map, shareReplay, of, switchMap } from 'rxjs';
import { DbxRouterService, DbxRouteParamReaderInstance, DbxRouteParamDefaultRedirectInstance, DbxRouteParamReader } from '@dereekb/dbx-core';
import { Destroyable, Initialized, Maybe, ModelKey } from '@dereekb/util';
import { MaybeObservableOrValueGetter, SwitchMapToDefaultFilterFunction } from '@dereekb/rxjs';

export const DBX_FIREBASE_ID_ROUTER_PARAM_DEFAULT_ID_PARAM_KEY = 'id';
export const DBX_FIREBASE_ID_ROUTER_PARAM_DEFAULT_KEY_PARAM_KEY = 'key';
export const DBX_FIREBASE_ID_ROUTER_PARAM_DEFAULT_USE_PARAM_VALUE = '0';

/**
 * Used to read an id with a specific key from the current route.
 *
 * Can be configured to redirect to a default route if a specific value is seen.
 */
export interface DbxFirebaseIdRouteParamRedirect extends DbxRouteParamReader<ModelKey> {
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
 * DbxFirebaseIdRouteParamRedirect instance
 */
export class DbxFirebaseIdRouteParamRedirectInstance implements DbxFirebaseIdRouteParamRedirect, DbxRouteParamReader<ModelKey>, Initialized, Destroyable {
  private _paramReader = new DbxRouteParamReaderInstance<ModelKey>(this.dbxRouterService, this.defaultParamKey);
  private _paramRedirect = new DbxRouteParamDefaultRedirectInstance<ModelKey>(this._paramReader);
  private _useDefaultParamDecider = new BehaviorSubject<string | SwitchMapToDefaultFilterFunction<ModelKey>>(DBX_FIREBASE_ID_ROUTER_PARAM_DEFAULT_USE_PARAM_VALUE);

  private _useDefaultParam$: Observable<SwitchMapToDefaultFilterFunction<ModelKey>> = this._useDefaultParamDecider.pipe(
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

  readonly paramValue$: Observable<Maybe<string>> = this._paramReader.paramValue$;
  readonly defaultValue$: Observable<Maybe<string>> = this._paramReader.defaultValue$;
  readonly value$: Observable<Maybe<string>> = this._paramReader.value$;

  readonly idFromParams$: Observable<Maybe<ModelKey>> = this.paramValue$;
  readonly id$: Observable<Maybe<ModelKey>> = this.value$;

  constructor(readonly dbxRouterService: DbxRouterService, private readonly defaultParamKey = DBX_FIREBASE_ID_ROUTER_PARAM_DEFAULT_ID_PARAM_KEY) {}

  init(): void {
    this._paramRedirect.setUseDefaultFilter((value: Maybe<string>) => {
      return this._useDefaultParam$.pipe(switchMap((x) => x(value)));
    });
    this._paramRedirect.init();
  }

  destroy(): void {
    this._paramReader.destroy();
    this._paramRedirect.destroy();
    this._useDefaultParamDecider.complete();
  }

  get paramKey(): string {
    return this._paramReader.paramKey;
  }

  set paramKey(paramKey: string) {
    this._paramReader.paramKey = paramKey || this.defaultParamKey;
  }

  setDefaultValue(defaultValue: MaybeObservableOrValueGetter<string>): void {
    this._paramReader.setDefaultValue(defaultValue);
  }

  setRedirectEnabled(redirect: Maybe<boolean>): void {
    this._paramRedirect.enabled = redirect !== false;
  }

  setDecider(decider: string | SwitchMapToDefaultFilterFunction<ModelKey>): void {
    this._useDefaultParamDecider.next(decider);
  }

  setParamValue(value: MaybeObservableOrValueGetter<string>): void {
    this._paramReader.setParamValue(value);
  }
}

export function dbxFirebaseIdRouteParamRedirect(dbxRouterService: DbxRouterService, defaultParamKey?: string): DbxFirebaseIdRouteParamRedirectInstance {
  return new DbxFirebaseIdRouteParamRedirectInstance(dbxRouterService, defaultParamKey);
}

export function dbxFirebaseKeyRouteParamRedirect(dbxRouterService: DbxRouterService, defaultParamKey: string = DBX_FIREBASE_ID_ROUTER_PARAM_DEFAULT_KEY_PARAM_KEY): DbxFirebaseIdRouteParamRedirectInstance {
  return new DbxFirebaseIdRouteParamRedirectInstance(dbxRouterService, defaultParamKey);
}
