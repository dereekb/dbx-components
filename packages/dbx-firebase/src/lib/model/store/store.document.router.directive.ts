import { shareReplay } from 'rxjs';
import { Observable, distinctUntilChanged } from 'rxjs';
import { OnDestroy } from '@angular/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { Directive, Host, Input, OnInit } from '@angular/core';
import { DbxRouterService, AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxFirebaseDocumentStoreDirective } from './store.document.directive';
import { Maybe, ModelKey } from '@dereekb/util';

export const DBX_FIREBASE_ROUTER_SYNC_DEFAULT_ID_PARAM_KEY = 'id';

/**
 * Used for synchronizing the document store id to the param of the route.
 */
@Directive({
  selector: '[dbxFirebaseDocumentStoreRouteId]'
})
export class DbxFirebaseDocumentStoreRouteIdDirective<T = unknown> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  private _idParamKey = new BehaviorSubject<string>(DBX_FIREBASE_ROUTER_SYNC_DEFAULT_ID_PARAM_KEY);
  readonly idParamKey$ = this._idParamKey.asObservable();

  readonly idFromParams$: Observable<Maybe<ModelKey>> = combineLatest([this.idParamKey$, this.dbxRouterService.params$]).pipe(
    map(([key, params]) => {
      return (params[key] as Maybe<string>) ?? undefined;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  constructor(
    @Host() readonly dbxFirebaseDocumentStoreDirective: DbxFirebaseDocumentStoreDirective<T>,
    readonly dbxRouterService: DbxRouterService) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.dbxFirebaseDocumentStoreDirective.store.setId(this.idFromParams$);
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._idParamKey.complete();
  }

  // MARK: Input
  @Input('dbxFirebaseDocumentStoreRouteId')
  get idParam() {
    return this._idParamKey.value;
  }

  set idParam(idParam: string) {
    this._idParamKey.next(idParam || DBX_FIREBASE_ROUTER_SYNC_DEFAULT_ID_PARAM_KEY)
  }

}
