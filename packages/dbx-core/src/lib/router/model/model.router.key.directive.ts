import { Observable } from 'rxjs';
import { OnDestroy, Directive, Input, OnInit, inject } from '@angular/core';
import { Maybe, ModelKey } from '@dereekb/util';
import { MaybeObservableOrValueGetter, SwitchMapToDefaultFilterFunction } from '@dereekb/rxjs';
import { dbxRouteModelKeyParamRedirect } from './id.param.redirect';
import { AbstractSubscriptionDirective } from '../../subscription/subscription.directive';
import { DbxRouterService } from '../router/service/router.service';
import { DbxRouteModelKeyDirectiveDelegate } from './model.router';

/**
 * Used for retrieving the model's key from the current route using the configured parameter and passes it to its delegate.
 *
 * If the key does not exist in the params, then the p
 */
@Directive({
  selector: '[dbxRouteModelKey]'
})
export class DbxRouteModelKeyDirective extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  readonly dbxRouterService = inject(DbxRouterService);
  readonly dbxRouteModelKeyDelegate = inject(DbxRouteModelKeyDirectiveDelegate, { host: true });

  private readonly _redirectInstance = dbxRouteModelKeyParamRedirect(this.dbxRouterService);

  readonly keyFromParams$: Observable<Maybe<ModelKey>> = this._redirectInstance.paramValue$;
  readonly key$: Observable<Maybe<ModelKey>> = this._redirectInstance.value$;

  ngOnInit(): void {
    this.sub = this.dbxRouteModelKeyDelegate.useRouteModelKeyParamsObservable(this.keyFromParams$, this.key$);
    this._redirectInstance.init();
  }

  override ngOnDestroy(): void {
    this._redirectInstance.destroy();
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
