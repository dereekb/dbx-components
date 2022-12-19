import { Observable } from 'rxjs';
import { OnDestroy, Directive, Host, Input, OnInit } from '@angular/core';
import { DbxRouterService, AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxFirebaseDocumentStoreDirective } from './store.document.directive';
import { Maybe, ModelKey } from '@dereekb/util';
import { MaybeObservableOrValueGetter, SwitchMapToDefaultFilterFunction } from '@dereekb/rxjs';
import { dbxFirebaseKeyRouteParamRedirect } from '../../../router';
import { TwoWayFlatFirestoreModelKey } from '@dereekb/firebase';

/**
 * Used for synchronizing the document store key to the param of the route. The param is interpreted as a TwoWayFlatFirestoreModelKey.
 */
@Directive({
  selector: '[dbxFirebaseDocumentStoreRouteKey]'
})
export class DbxFirebaseDocumentStoreRouteKeyDirective<T = unknown> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  private _redirectInstance = dbxFirebaseKeyRouteParamRedirect(this.dbxRouterService);
  readonly keyFromParams$: Observable<Maybe<ModelKey>> = this._redirectInstance.paramValue$;
  readonly key$: Observable<Maybe<TwoWayFlatFirestoreModelKey>> = this._redirectInstance.value$;

  constructor(@Host() readonly dbxFirebaseDocumentStoreDirective: DbxFirebaseDocumentStoreDirective<T>, readonly dbxRouterService: DbxRouterService) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.dbxFirebaseDocumentStoreDirective.store.setFlatKey(this.keyFromParams$); // use from the params, as the params should get updated eventually to the key$ value
    this._redirectInstance.init();
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._redirectInstance.destroy();
  }

  // MARK: Input
  @Input('dbxFirebaseDocumentStoreRouteKey')
  get keyParam() {
    return this._redirectInstance.paramKey;
  }

  set keyParam(keyParam: string) {
    this._redirectInstance.paramKey = keyParam;
  }

  @Input()
  set dbxFirebaseDocumentStoreRouteKeyDefault(defaultValue: MaybeObservableOrValueGetter<ModelKey>) {
    this._redirectInstance.setDefaultValue(defaultValue);
  }

  /**
   * Whether or not to enable the redirection. Is enabled by default.
   */
  @Input()
  set dbxFirebaseDocumentStoreRouteKeyDefaultRedirect(redirect: Maybe<boolean> | '') {
    this._redirectInstance.setRedirectEnabled(redirect !== false); // true by default
  }

  @Input()
  set dbxFirebaseDocumentStoreRouteKeyDefaultDecision(decider: string | SwitchMapToDefaultFilterFunction<ModelKey>) {
    this._redirectInstance.setDecider(decider);
  }
}
