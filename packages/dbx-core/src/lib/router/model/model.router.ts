import { type Type, type Provider, forwardRef } from '@angular/core';
import { type Maybe, type ModelKey } from '@dereekb/util';
import { type Observable, type Subscription } from 'rxjs';

// MARK: Id
/**
 * Abstract delegate that receives model identifier observables from a {@link DbxRouteModelIdDirective}.
 *
 * Implement this class and register it as a provider to receive the id parameter read from the current route.
 * The directive will call {@link useRouteModelIdParamsObservable} during initialization.
 *
 * @example
 * ```ts
 * @Directive({
 *   selector: '[myModelLoader]',
 *   providers: provideDbxRouteModelIdDirectiveDelegate(MyModelLoaderDirective)
 * })
 * class MyModelLoaderDirective extends DbxRouteModelIdDirectiveDelegate {
 *   useRouteModelIdParamsObservable(idFromParams$: Observable<Maybe<ModelKey>>, computedId$: Observable<Maybe<ModelKey>>): Subscription {
 *     return computedId$.subscribe(id => this.loadModel(id));
 *   }
 * }
 * ```
 *
 * @see {@link DbxRouteModelIdDirective} for the directive that provides the id observables
 * @see {@link provideDbxRouteModelIdDirectiveDelegate} for registering the delegate provider
 */
export abstract class DbxRouteModelIdDirectiveDelegate {
  /**
   * Passes the param value and computed value from the DbxRouteModelIdDirective to this delegate.
   *
   * @param idFromParamsObs
   * @param computedIdObs
   */
  abstract useRouteModelIdParamsObservable(idFromParamsObs: Observable<Maybe<ModelKey>>, computedIdObs: Observable<Maybe<ModelKey>>): Subscription;
}

/**
 * Creates Angular DI providers that register the given source type as a {@link DbxRouteModelIdDirectiveDelegate}.
 *
 * @typeParam S - The concrete delegate class type to register.
 * @param sourceType - The class to provide as the delegate.
 * @returns An array of Angular providers.
 *
 * @see {@link DbxRouteModelIdDirectiveDelegate}
 */
export function provideDbxRouteModelIdDirectiveDelegate<S extends DbxRouteModelIdDirectiveDelegate>(sourceType: Type<S>): Provider[] {
  const providers: Provider[] = [
    {
      provide: DbxRouteModelIdDirectiveDelegate,
      useExisting: forwardRef(() => sourceType)
    }
  ];

  return providers;
}

// MARK: Key
/**
 * Abstract delegate that receives model key observables from a {@link DbxRouteModelKeyDirective}.
 *
 * Implement this class and register it as a provider to receive the key parameter read from the current route.
 * The directive will call {@link useRouteModelKeyParamsObservable} during initialization.
 *
 * @example
 * ```ts
 * @Directive({
 *   selector: '[myModelKeyLoader]',
 *   providers: provideDbxRouteModelKeyDirectiveDelegate(MyModelKeyLoaderDirective)
 * })
 * class MyModelKeyLoaderDirective extends DbxRouteModelKeyDirectiveDelegate {
 *   useRouteModelKeyParamsObservable(keyFromParams$: Observable<Maybe<ModelKey>>, computedKey$: Observable<Maybe<ModelKey>>): Subscription {
 *     return computedKey$.subscribe(key => this.loadModel(key));
 *   }
 * }
 * ```
 *
 * @see {@link DbxRouteModelKeyDirective} for the directive that provides the key observables
 * @see {@link provideDbxRouteModelKeyDirectiveDelegate} for registering the delegate provider
 */
export abstract class DbxRouteModelKeyDirectiveDelegate {
  /**
   * Passes the param value and computed value from the DbxRouteModelKeyDirective to this delegate.
   *
   * @param keyFromParamsObs
   * @param computedKeyObs
   */
  abstract useRouteModelKeyParamsObservable(keyFromParamsObs: Observable<Maybe<ModelKey>>, computedKeyObs: Observable<Maybe<ModelKey>>): Subscription;
}

/**
 * Creates Angular DI providers that register the given source type as a {@link DbxRouteModelKeyDirectiveDelegate}.
 *
 * @typeParam S - The concrete delegate class type to register.
 * @param sourceType - The class to provide as the delegate.
 * @returns An array of Angular providers.
 *
 * @see {@link DbxRouteModelKeyDirectiveDelegate}
 */
export function provideDbxRouteModelKeyDirectiveDelegate<S extends DbxRouteModelKeyDirectiveDelegate>(sourceType: Type<S>): Provider[] {
  const providers: Provider[] = [
    {
      provide: DbxRouteModelKeyDirectiveDelegate,
      useExisting: forwardRef(() => sourceType)
    }
  ];

  return providers;
}
