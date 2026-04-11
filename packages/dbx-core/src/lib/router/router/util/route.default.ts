import { BehaviorSubject, EMPTY, switchMap, of } from 'rxjs';
import { type DbxRouteParamReaderInstance } from './route.reader';
import { type Destroyable, type Initialized, type Maybe, type DefaultForwardFunctionFactory, defaultForwardFunctionFactory } from '@dereekb/util';
import { SubscriptionObject, switchMapToDefault, type SwitchMapToDefaultFilterFunction, filterMaybe } from '@dereekb/rxjs';

const DEFAULT_REDIRECT_INSTANCE_FORWARD_FACTORY = defaultForwardFunctionFactory<SwitchMapToDefaultFilterFunction<unknown>>((value) => of(value == null));

/**
 * Utility class that works with a {@link DbxRouteParamReaderInstance} to automatically redirect the router
 * when the current parameter value is determined to require a default substitution.
 *
 * When enabled and initialized, it monitors the parameter value and, if the configured filter function
 * indicates the value should be replaced, updates the route to use the default value instead.
 *
 * @typeParam T - The type of the parameter value.
 *
 * @example
 * ```ts
 * const paramReader = dbxRouteParamReaderInstance<string>(routerService, 'id');
 * const redirect = new DbxRouteParamDefaultRedirectInstance(paramReader);
 * redirect.setUseDefaultFilter(value => of(value === '0'));
 * redirect.init();
 * ```
 *
 * @see {@link DbxRouteParamReaderInstance}
 * @see {@link dbxRouteModelIdParamRedirect} for the model-specific usage pattern
 */
export class DbxRouteParamDefaultRedirectInstance<T> implements Initialized, Destroyable {
  private readonly instance: DbxRouteParamReaderInstance<T>;

  private readonly _enabled = new BehaviorSubject<boolean>(true);
  private readonly _useDefaultFilter = new BehaviorSubject<Maybe<SwitchMapToDefaultFilterFunction<T>>>(undefined);
  private readonly _sub = new SubscriptionObject();

  constructor(instance: DbxRouteParamReaderInstance<T>) {
    this.instance = instance;
  }

  init(): void {
    this._sub.subscription = this._enabled
      .pipe(
        switchMap((enabled) => {
          const result = enabled
            ? this.instance.paramValue$.pipe(
                switchMapToDefault(this.instance.defaultValue$, (value) => {
                  return this._useDefaultFilter.pipe(switchMap((fn) => (DEFAULT_REDIRECT_INSTANCE_FORWARD_FACTORY as DefaultForwardFunctionFactory<SwitchMapToDefaultFilterFunction<T>>)(fn)(value)));
                }),
                filterMaybe(), // do not redirect on MaybeNot values
                switchMap((defaultValue) => {
                  return this.redirectWithDefaultValue(defaultValue);
                })
              )
            : EMPTY;

          return result;
        })
      )
      .subscribe();
  }

  destroy(): void {
    this._enabled.complete();
    this._useDefaultFilter.complete();
    this._sub.destroy();
  }

  protected redirectWithDefaultValue(value: Maybe<T>): Promise<boolean> {
    let result: Promise<boolean>;

    if (value != null) {
      // perform a segue once
      result = this.redirectWithValue(value);
    } else {
      // do nothing
      result = Promise.resolve(false);
    }

    return result;
  }

  protected redirectWithValue(value: Maybe<T>): Promise<boolean> {
    return this.instance.dbxRouterService.updateParams({
      [this.instance.getParamKey()]: value
    });
  }

  get enabled(): boolean {
    return this._enabled.value;
  }

  set enabled(enabled: boolean) {
    this._enabled.next(enabled);
  }

  setUseDefaultFilter(useValueFilter: Maybe<SwitchMapToDefaultFilterFunction<T>>): void {
    this._useDefaultFilter.next(useValueFilter);
  }
}
