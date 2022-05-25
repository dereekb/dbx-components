import { PromiseOrValue } from '@dereekb/util';
import { CloudEvent, CloudFunction } from 'firebase-functions/v2';
import { MakeNestContext, NestApplicationFunctionFactory, NestApplicationPromiseGetter } from '../../nest.provider';

// MARK: Event
export type CloudEventHandler<E extends CloudEvent<unknown>, O = unknown> = (event: E) => PromiseOrValue<O>;
export type NestContextCloudEventHandler<C, E extends CloudEvent<unknown>, O = unknown> = (nest: C, event: E) => PromiseOrValue<O>;
export type NestContextCloudEventHandlerBuilder<C, E extends CloudEvent<unknown>, O = unknown> = (handler: NestContextCloudEventHandler<C, E, O>) => CloudEventHandler<E, O>;
export type NestContextCloudEventHandlerWithData<C, I, O = unknown> = NestContextCloudEventHandler<C, CloudEvent<I>, O>;
export type CloudEventHandlerWithNestContextBuilder<C, E extends CloudEvent<unknown>, O = unknown> = (nest: NestContextCloudEventHandlerBuilder<C, E, O>) => CloudFunction<E>;

/**
 * Factory function for generating a firebase CloudFunction for a specific event.
 */
export type CloudEventHandlerWithNestContextFactory<C> = <E extends CloudEvent<unknown>, O = unknown>(fn: CloudEventHandlerWithNestContextBuilder<C, E, O>) => NestApplicationFunctionFactory<CloudFunction<E>>;

/**
 * Creates a CloudEventHandlerWithNestContextFactory.
 * 
 * @param appFactory 
 * @param makeNestContext 
 * @returns 
 */
export function cloudEventHandlerWithNestContextFactory<C>(makeNestContext: MakeNestContext<C>): CloudEventHandlerWithNestContextFactory<C> {
  return <E extends CloudEvent<unknown>, O = unknown>(fn: CloudEventHandlerWithNestContextBuilder<C, E, O>) => {
    return (nestAppPromiseGetter: NestApplicationPromiseGetter) => {
      const handlerBuilder: NestContextCloudEventHandlerBuilder<C, E, O> = (handler: NestContextCloudEventHandler<C, E, O>) => {
        const fnHandler: CloudEventHandler<E, O> = (event: E) => nestAppPromiseGetter().then((nest) => handler(makeNestContext(nest), event));
        return fnHandler;
      };

      return fn(handlerBuilder);
    };
  };
}
