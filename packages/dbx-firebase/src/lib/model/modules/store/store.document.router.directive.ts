import { Observable } from 'rxjs';
import { OnDestroy, Directive, Host, Input, OnInit } from '@angular/core';
import { DbxRouterService, AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxFirebaseDocumentStoreDirective } from './store.document.directive';
import { Maybe, ModelKey } from '@dereekb/util';
import { MaybeObservableOrValueGetter, SwitchMapToDefaultFilterFunction } from '@dereekb/rxjs';
import { dbxFirebaseIdRouteParamRedirect } from '../../../router';

/**
 * Used for synchronizing the document store id to the param of the route.
 */
@Directive({
  selector: '[dbxFirebaseDocumentStoreRouteId]'
})
export class DbxFirebaseDocumentStoreRouteIdDirective<T = unknown> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  private _redirectInstance = dbxFirebaseIdRouteParamRedirect(this.dbxRouterService);
  readonly idFromParams$: Observable<Maybe<ModelKey>> = this._redirectInstance.paramValue$;
  readonly id$: Observable<Maybe<ModelKey>> = this._redirectInstance.value$;

  constructor(@Host() readonly dbxFirebaseDocumentStoreDirective: DbxFirebaseDocumentStoreDirective<T>, readonly dbxRouterService: DbxRouterService) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.dbxFirebaseDocumentStoreDirective.store.setId(this.idFromParams$); // use from the params, as the params should get updated eventually to the id$ value
    this._redirectInstance.init();
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._redirectInstance.destroy();
  }

  // MARK: Input
  @Input('dbxFirebaseDocumentStoreRouteId')
  get idParam() {
    return this._redirectInstance.paramKey;
  }

  set idParam(idParam: string) {
    this._redirectInstance.paramKey = idParam;
  }

  @Input()
  set dbxFirebaseDocumentStoreRouteIdDefault(defaultValue: MaybeObservableOrValueGetter<ModelKey>) {
    this._redirectInstance.setDefaultValue(defaultValue);
  }

  /**
   * Whether or not to enable the redirection. Is enabled by default.
   */
  @Input()
  set dbxFirebaseDocumentStoreRouteIdDefaultRedirect(redirect: Maybe<boolean> | '') {
    this._redirectInstance.setRedirectEnabled(redirect !== false); // true by default
  }

  @Input()
  set dbxFirebaseDocumentStoreRouteIdDefaultDecision(decider: string | SwitchMapToDefaultFilterFunction<ModelKey>) {
    this._redirectInstance.setDecider(decider);
  }
}
