import { Observable } from 'rxjs';
import { OnDestroy, Directive, Host, Input, OnInit } from '@angular/core';
import { DbxRouterService, AbstractSubscriptionDirective, DbxRouteParamReaderInstance } from '@dereekb/dbx-core';
import { DbxFirebaseDocumentStoreDirective } from './store.document.directive';
import { Maybe, ModelKey } from '@dereekb/util';
import { MaybeObservableOrValueGetter } from '@dereekb/rxjs';

export const DBX_FIREBASE_ROUTER_SYNC_DEFAULT_ID_PARAM_KEY = 'id';

/**
 * Used for synchronizing the document store id to the param of the route.
 */
@Directive({
  selector: '[dbxFirebaseDocumentStoreRouteId]'
})
export class DbxFirebaseDocumentStoreRouteIdDirective<T = unknown> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  private _paramReader = new DbxRouteParamReaderInstance<ModelKey>(this.dbxRouterService, DBX_FIREBASE_ROUTER_SYNC_DEFAULT_ID_PARAM_KEY);

  readonly idParamKey$ = this._paramReader.paramKey$;
  readonly idFromParams$: Observable<Maybe<ModelKey>> = this._paramReader.paramValue$;
  readonly id$: Observable<Maybe<ModelKey>> = this._paramReader.value$;

  constructor(@Host() readonly dbxFirebaseDocumentStoreDirective: DbxFirebaseDocumentStoreDirective<T>, readonly dbxRouterService: DbxRouterService) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.dbxFirebaseDocumentStoreDirective.store.setId(this.idFromParams$);
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._paramReader.destroy();
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
}
