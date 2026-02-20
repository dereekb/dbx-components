import { Observable } from 'rxjs';
import { OnDestroy, Directive, Input, OnInit, inject } from '@angular/core';
import { Maybe, ModelKey } from '@dereekb/util';
import { MaybeObservableOrValueGetter, SwitchMapToDefaultFilterFunction } from '@dereekb/rxjs';
import { dbxRouteModelIdParamRedirect } from './id.param.redirect';
import { AbstractSubscriptionDirective } from '../../rxjs/rxjs.directive';
import { DbxRouterService } from '../router/service/router.service';
import { DbxRouteModelIdDirectiveDelegate } from './model.router';

/**
 * Used for retrieving the model's id from the current route using the configured parameter and passes it to its delegate.
 */
@Directive({
  selector: '[dbxRouteModelId]',
  standalone: true
})
export class DbxRouteModelIdDirective extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  readonly dbxRouterService = inject(DbxRouterService);
  readonly dbxRouteModelIdDelegate = inject(DbxRouteModelIdDirectiveDelegate, { host: true });

  private readonly _redirectInstance = dbxRouteModelIdParamRedirect(this.dbxRouterService);

  readonly idFromParams$: Observable<Maybe<ModelKey>> = this._redirectInstance.paramValue$;
  readonly id$: Observable<Maybe<ModelKey>> = this._redirectInstance.value$;

  ngOnInit(): void {
    this.sub = this.dbxRouteModelIdDelegate.useRouteModelIdParamsObservable(this.idFromParams$, this.id$);
    this._redirectInstance.init();
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._redirectInstance.destroy();
  }

  // MARK: Input
  @Input('dbxRouteModelId')
  get idParam() {
    return this._redirectInstance.getParamKey();
  }

  set idParam(idParam: string) {
    this._redirectInstance.setParamKey(idParam);
  }

  @Input()
  set dbxRouteModelIdDefault(defaultValue: MaybeObservableOrValueGetter<ModelKey>) {
    this._redirectInstance.setDefaultValue(defaultValue);
  }

  /**
   * Whether or not to enable the redirection. Is enabled by default.
   */
  @Input()
  set dbxRouteModelIdDefaultRedirect(redirect: Maybe<boolean> | '') {
    this._redirectInstance.setRedirectEnabled(redirect !== false); // true by default
  }

  @Input()
  set dbxRouteModelIdDefaultDecision(decider: string | SwitchMapToDefaultFilterFunction<ModelKey>) {
    this._redirectInstance.setDecider(decider);
  }
}
