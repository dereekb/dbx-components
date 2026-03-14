import { type Observable } from 'rxjs';
import { Directive, Input, inject } from '@angular/core';
import { type Maybe, type ModelKey } from '@dereekb/util';
import { type MaybeObservableOrValueGetter, type SwitchMapToDefaultFilterFunction } from '@dereekb/rxjs';
import { dbxRouteModelKeyParamRedirect } from './id.param.redirect';
import { clean, cleanSubscription } from '../../rxjs';
import { DbxRouterService } from '../router/service/router.service';
import { DbxRouteModelKeyDirectiveDelegate } from './model.router';

/**
 * Directive that reads a model key from the current route's parameters and passes it to a {@link DbxRouteModelKeyDirectiveDelegate}.
 *
 * Functions identically to {@link DbxRouteModelIdDirective} but uses a "key" parameter (defaulting to `'key'`)
 * instead of "id". Supports configurable parameter key, default value, redirect behavior, and custom decision logic.
 *
 * @example
 * ```html
 * <!-- Basic usage: reads "key" param from route and passes to delegate -->
 * <div dbxRouteModelKey></div>
 *
 * <!-- Custom param key -->
 * <div [dbxRouteModelKey]="'slug'"></div>
 *
 * <!-- With default value and redirect disabled -->
 * <div dbxRouteModelKey [dbxRouteModelKeyDefault]="defaultKey$" [dbxRouteModelKeyDefaultRedirect]="false"></div>
 * ```
 *
 * @see {@link DbxRouteModelKeyDirectiveDelegate} for the delegate that receives the key observables
 * @see {@link dbxRouteModelKeyParamRedirect} for the underlying redirect logic
 * @see {@link DbxRouteModelIdDirective} for the id-based equivalent
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

  /**
   * Default model key value to use when the route parameter matches the placeholder or is absent.
   */
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

  /**
   * Custom decision function or placeholder string value that determines when to use the default value instead of the route parameter.
   */
  @Input()
  set dbxRouteModelKeyDefaultDecision(decider: string | SwitchMapToDefaultFilterFunction<ModelKey>) {
    this._redirectInstance.setDecider(decider);
  }
}
