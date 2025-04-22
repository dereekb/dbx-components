import { Directive, Input, inject, OnInit } from '@angular/core';
import { DbxRouteModelKeyDirective } from '@dereekb/dbx-core';
import { DbxFirebaseDocumentStoreDirective } from './store.document.directive';
import { Maybe, ModelKey } from '@dereekb/util';
import { MaybeObservableOrValueGetter, SwitchMapToDefaultFilterFunction } from '@dereekb/rxjs';

/**
 * Used for synchronizing the document store key to the param of the route. The param is interpreted as a TwoWayFlatFirestoreModelKey.
 *
 * @deprecated use DbxRouteModelKeyDirective ([dbxRouteModelKey]) instead.
 */
@Directive({
  selector: '[dbxFirebaseDocumentStoreRouteKey]'
})
export class DbxFirebaseDocumentStoreRouteKeyDirective<T = unknown> extends DbxRouteModelKeyDirective implements OnInit {
  readonly dbxFirebaseDocumentStoreDirective = inject(DbxFirebaseDocumentStoreDirective<T>, { host: true });

  override ngOnInit(): void {
    super.ngOnInit();
  }

  // MARK: Input
  @Input('dbxFirebaseDocumentStoreRouteKey')
  get dbxFirebaseDocumentStoreRouteKey() {
    return this.keyParam;
  }

  set dbxFirebaseDocumentStoreRouteKey(keyParam: string) {
    this.keyParam = keyParam;
  }

  @Input()
  set dbxFirebaseDocumentStoreRouteKeyDefault(defaultValue: MaybeObservableOrValueGetter<ModelKey>) {
    this.dbxRouteModelKeyDefault = defaultValue;
  }

  /**
   * Whether or not to enable the redirection. Is enabled by default.
   */
  @Input()
  set dbxFirebaseDocumentStoreRouteKeyDefaultRedirect(redirect: Maybe<boolean> | '') {
    this.dbxRouteModelKeyDefaultRedirect = redirect;
  }

  @Input()
  set dbxFirebaseDocumentStoreRouteKeyDefaultDecision(decider: string | SwitchMapToDefaultFilterFunction<ModelKey>) {
    this.dbxRouteModelKeyDefaultDecision = decider;
  }
}
