import { Observable } from 'rxjs';
import { Directive, Input, inject } from '@angular/core';
import { Maybe, ModelKey } from '@dereekb/util';
import { MaybeObservableOrValueGetter, SwitchMapToDefaultFilterFunction } from '@dereekb/rxjs';
import { dbxRouteModelKeyParamRedirect } from './id.param.redirect';
import { clean, cleanSubscription } from '../../rxjs';
import { DbxRouterService } from '../router/service/router.service';
import { DbxRouteModelKeyDirectiveDelegate } from './model.router';

/**
 * Used for retrieving the model's key from the current route using the configured parameter and passes it to its delegate.
 *
 * If the key does not exist in the params, then the p
 */
@Directive({
  selector: '[dbxRouteModelKey]',
  standalone: true
})
export class DbxRouteModelKeyDirective {
  readonly dbxRouterService = inject(DbxRouterService);
  readonly dbxRouteModelKeyDelegate = inject(DbxRouteModelKeyDirectiveDelegate, { host: true });

  private readonly _redirectInstance = clean(dbxRouteModelKeyParamRedirect(this.dbxRouterService));

  readonly keyFromParams$: Observable<Maybe<ModelKey>> = this._redirectInstance.paramValue$;
  readonly key$: Observable<Maybe<ModelKey>> = this._redirectInstance.value$;

  constructor() {
    cleanSubscription(this.dbxRouteModelKeyDelegate.useRouteModelKeyParamsObservable(this.keyFromParams$, this.key$));
    this._redirectInstance.init();
  }

  // MARK: Input
  @Input('dbxRouteModelKey')
  get keyParam() {
    return this._redirectInstance.getParamKey();
  }

  set keyParam(idParam: string) {
    this._redirectInstance.setParamKey(idParam);
  }

  @Input()
  set dbxRouteModelKeyDefault(defaultValue: MaybeObservableOrValueGetter<ModelKey>) {
    this._redirectInstance.setDefaultValue(defaultValue);
  }

  /**
   * Whether or not to enable the redirection. Is enabled by default.
   */
  @Input()
  set dbxRouteModelKeyDefaultRedirect(redirect: Maybe<boolean> | '') {
    this._redirectInstance.setRedirectEnabled(redirect !== false); // true by default
  }

  @Input()
  set dbxRouteModelKeyDefaultDecision(decider: string | SwitchMapToDefaultFilterFunction<ModelKey>) {
    this._redirectInstance.setDecider(decider);
  }
}
