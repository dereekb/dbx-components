import { Type, Provider, forwardRef } from '@angular/core';
import { Maybe, ModelKey } from '@dereekb/util';
import { Observable, Subscription } from 'rxjs';

// MARK: Id
/**
 * DbxRouteModelIdDirective delegate that can recieve an observable of the model id from the route.
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
 * Configures providers for a DbxRouteModelIdDirectiveDelegate.
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
 * DbxRouteModelKeyDirective delegate that can recieve an observable of the model id from the route.
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
 * Configures providers for a DbxRouteModelKeyDirectiveDelegate.
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
