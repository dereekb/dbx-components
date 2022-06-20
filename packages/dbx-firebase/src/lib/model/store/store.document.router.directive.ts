import { Observable, BehaviorSubject, map, shareReplay, of, switchMap } from 'rxjs';
import { OnDestroy, Directive, Host, Input, OnInit } from '@angular/core';
import { DbxRouterService, AbstractSubscriptionDirective, DbxRouteParamReaderInstance, DbxRouteParamDefaultRedirectInstance } from '@dereekb/dbx-core';
import { DbxFirebaseDocumentStoreDirective } from './store.document.directive';
import { Maybe, ModelKey } from '@dereekb/util';
import { MaybeObservableOrValueGetter, SwitchMapToDefaultFilterFunction } from '@dereekb/rxjs';

export const DBX_FIREBASE_ROUTER_SYNC_DEFAULT_ID_PARAM_KEY = 'id';
export const DBX_FIREBASE_ROUTER_SYNC_USE_DEFAULT_PARAM_VALUE = '0';

/**
 * Used for synchronizing the document store id to the param of the route.
 */
@Directive({
  selector: '[dbxFirebaseDocumentStoreRouteId]'
})
export class DbxFirebaseDocumentStoreRouteIdDirective<T = unknown> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  private _paramReader = new DbxRouteParamReaderInstance<ModelKey>(this.dbxRouterService, DBX_FIREBASE_ROUTER_SYNC_DEFAULT_ID_PARAM_KEY);
  private _paramRedirect = new DbxRouteParamDefaultRedirectInstance<ModelKey>(this._paramReader);
  private _useDefaultParam = new BehaviorSubject<string | SwitchMapToDefaultFilterFunction<ModelKey>>(DBX_FIREBASE_ROUTER_SYNC_USE_DEFAULT_PARAM_VALUE);
  private _useDefaultParam$: Observable<SwitchMapToDefaultFilterFunction<ModelKey>> = this._useDefaultParam.pipe(
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

  readonly idParamKey$ = this._paramReader.paramKey$;
  readonly idFromParams$: Observable<Maybe<ModelKey>> = this._paramReader.paramValue$;
  readonly id$: Observable<Maybe<ModelKey>> = this._paramReader.value$;

  constructor(@Host() readonly dbxFirebaseDocumentStoreDirective: DbxFirebaseDocumentStoreDirective<T>, readonly dbxRouterService: DbxRouterService) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.dbxFirebaseDocumentStoreDirective.store.setId(this.idFromParams$);
    this._paramRedirect.setUseDefaultFilter((value: Maybe<string>) => {
      return this._useDefaultParam$.pipe(switchMap((x) => x(value)));
    });
    this._paramRedirect.init();
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._paramReader.destroy();
    this._paramRedirect.destroy();
    this._useDefaultParam.complete();
  }

  // MARK: Input
  @Input('dbxFirebaseDocumentStoreRouteId')
  get idParam() {
    return this._paramReader.paramKey;
  }

  set idParam(idParam: string) {
    this._paramReader.paramKey = idParam;
  }

  @Input()
  set dbxFirebaseDocumentStoreRouteIdDefault(defaultValue: MaybeObservableOrValueGetter<ModelKey>) {
    this._paramReader.setDefaultValue(defaultValue);
  }

  /**
   * Whether or not to enable the redirection. Is enabled by default.
   */
  @Input()
  set dbxFirebaseDocumentStoreRouteIdDefaultRedirect(redirect: Maybe<boolean> | '') {
    this._paramRedirect.enabled = redirect !== false; // true by default
  }

  @Input()
  set dbxFirebaseDocumentStoreRouteIdDefaultDecision(decider: string | SwitchMapToDefaultFilterFunction<ModelKey>) {
    this._useDefaultParam.next(decider);
  }
}
