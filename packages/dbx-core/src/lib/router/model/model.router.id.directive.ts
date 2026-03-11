import { type Observable } from 'rxjs';
import { Directive, Input, inject } from '@angular/core';
import { type Maybe, type ModelKey } from '@dereekb/util';
import { type MaybeObservableOrValueGetter, type SwitchMapToDefaultFilterFunction } from '@dereekb/rxjs';
import { dbxRouteModelIdParamRedirect } from './id.param.redirect';
import { DbxRouterService } from '../router/service/router.service';
import { DbxRouteModelIdDirectiveDelegate } from './model.router';
import { clean, cleanSubscription } from '../../rxjs';

/**
 * Directive that reads a model identifier from the current route's parameters and passes it to a {@link DbxRouteModelIdDirectiveDelegate}.
 *
 * Supports configurable parameter key, default value, redirect behavior, and custom decision logic for determining
 * when to use the default value vs. the route parameter.
 *
 * @example
 * ```html
 * <!-- Basic usage: reads "id" param from route and passes to delegate -->
 * <div dbxRouteModelId></div>
 *
 * <!-- Custom param key -->
 * <div [dbxRouteModelId]="'modelId'"></div>
 *
 * <!-- With default value and redirect disabled -->
 * <div dbxRouteModelId [dbxRouteModelIdDefault]="defaultId$" [dbxRouteModelIdDefaultRedirect]="false"></div>
 * ```
 *
 * @see {@link DbxRouteModelIdDirectiveDelegate} for the delegate that receives the id observables
 * @see {@link dbxRouteModelIdParamRedirect} for the underlying redirect logic
 */
@Directive({
  selector: '[dbxRouteModelId]',
  standalone: true
})
export class DbxRouteModelIdDirective {
  readonly dbxRouterService = inject(DbxRouterService);
  readonly dbxRouteModelIdDelegate = inject(DbxRouteModelIdDirectiveDelegate, { host: true });

  private readonly _redirectInstance = clean(dbxRouteModelIdParamRedirect(this.dbxRouterService));

  readonly idFromParams$: Observable<Maybe<ModelKey>> = this._redirectInstance.paramValue$;
  readonly id$: Observable<Maybe<ModelKey>> = this._redirectInstance.value$;

  constructor() {
    cleanSubscription(this.dbxRouteModelIdDelegate.useRouteModelIdParamsObservable(this.idFromParams$, this.id$));
    this._redirectInstance.init();
  }

  // MARK: Input
  @Input('dbxRouteModelId')
  get idParam() {
    return this._redirectInstance.getParamKey();
  }

  set idParam(idParam: string) {
    this._redirectInstance.setParamKey(idParam);
  }

  /**
   * Default model identifier value to use when the route parameter matches the placeholder or is absent.
   */
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

  /**
   * Custom decision function or placeholder string value that determines when to use the default value instead of the route parameter.
   */
  @Input()
  set dbxRouteModelIdDefaultDecision(decider: string | SwitchMapToDefaultFilterFunction<ModelKey>) {
    this._redirectInstance.setDecider(decider);
  }
}
