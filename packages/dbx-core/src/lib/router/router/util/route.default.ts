import { BehaviorSubject, EMPTY, switchMap, of } from 'rxjs';
import { DbxRouteParamReaderInstance } from './route.reader';
import { Destroyable, Initialized, Maybe, DefaultForwardFunctionFactory, defaultForwardFunctionFactory } from '@dereekb/util';
import { SubscriptionObject, switchMapToDefault, SwitchMapToDefaultFilterFunction, filterMaybe } from '@dereekb/rxjs';

const DEFAULT_REDIRECT_INSTANCE_FORWARD_FACTORY = defaultForwardFunctionFactory<SwitchMapToDefaultFilterFunction<unknown>>((value) => of(value == null));

/**
 * Utility class used in conjuction with a DbxRouteParamReaderInstance to redirect when the default param does not equal the
 */
export class DbxRouteParamDefaultRedirectInstance<T> implements Initialized, Destroyable {
  private _enabled = new BehaviorSubject<boolean>(true);
  private _useDefaultFilter = new BehaviorSubject<Maybe<SwitchMapToDefaultFilterFunction<T>>>(undefined);
  private _sub = new SubscriptionObject();

  constructor(readonly instance: DbxRouteParamReaderInstance<T>) {}

  init(): void {
    this._sub.subscription = this._enabled
      .pipe(
        switchMap((enabled) => {
          if (enabled) {
            return this.instance.paramValue$.pipe(
              switchMapToDefault(this.instance.defaultValue$, (value) => {
                return this._useDefaultFilter.pipe(switchMap((fn) => (DEFAULT_REDIRECT_INSTANCE_FORWARD_FACTORY as DefaultForwardFunctionFactory<SwitchMapToDefaultFilterFunction<T>>)(fn)(value)));
              }),
              filterMaybe(), // do not redirect on MaybeNot values
              switchMap((defaultValue) => {
                return this.redirectWithDefaultValue(defaultValue);
              })
            );
          } else {
            return EMPTY;
          }
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
    if (value != null) {
      // perform a segue once
      return this.redirectWithValue(value);
    } else {
      // do nothing
      return Promise.resolve(false);
    }
  }

  protected redirectWithValue(value: Maybe<T>): Promise<boolean> {
    return this.instance.dbxRouterService.updateParams({
      [this.instance.paramKey]: value
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
