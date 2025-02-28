import { Directive, Input } from '@angular/core';
import { DbxRouteModelIdDirective } from '@dereekb/dbx-core';
import { Maybe, ModelKey } from '@dereekb/util';
import { MaybeObservableOrValueGetter, SwitchMapToDefaultFilterFunction } from '@dereekb/rxjs';

/**
 * Used for synchronizing the document store id to the param of the route.
 *
 * @deprecated use DbxRouteModelIdDirective instead.
 */
@Directive({
  selector: '[dbxFirebaseDocumentStoreRouteId]'
})
export class DbxFirebaseDocumentStoreRouteIdDirective<T = unknown> extends DbxRouteModelIdDirective {
  // MARK: Input
  @Input('dbxFirebaseDocumentStoreRouteId')
  get dbxFirebaseDocumentStoreRouteId() {
    return this.idParam;
  }

  set dbxFirebaseDocumentStoreRouteId(idParam: string) {
    this.idParam = idParam;
  }

  @Input()
  set dbxFirebaseDocumentStoreRouteIdDefault(defaultValue: MaybeObservableOrValueGetter<ModelKey>) {
    this.dbxRouteModelIdDefault = defaultValue;
  }

  /**
   * Whether or not to enable the redirection. Is enabled by default.
   */
  @Input()
  set dbxFirebaseDocumentStoreRouteIdDefaultRedirect(redirect: Maybe<boolean> | '') {
    this.dbxRouteModelIdDefaultRedirect = redirect;
  }

  @Input()
  set dbxFirebaseDocumentStoreRouteIdDefaultDecision(decider: string | SwitchMapToDefaultFilterFunction<ModelKey>) {
    this.dbxRouteModelIdDefaultDecision = decider;
  }
}
