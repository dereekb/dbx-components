import { type PromiseOrValue } from '@dereekb/util';
import { type CloudEvent, type CloudFunction } from 'firebase-functions/v2';
import { type MakeNestContext, type NestApplicationFunctionFactory, type NestApplicationPromiseGetter } from '../../nest.provider';
import { type NestContextRequest } from '../nest';

export type CloudEventNestContextRequest<N, E extends CloudEvent<unknown>> = NestContextRequest<N, E>;

// MARK: From Firebase/Cloud Event
export type CloudEventHandler<E extends CloudEvent<unknown>, O = unknown> = (event: E) => PromiseOrValue<O>;

export interface CloudFunctionBuilder<E extends CloudEvent<unknown>, O = unknown> {
  (handler: (event: E) => PromiseOrValue<O>): CloudFunction<E>;
}

// MARK: Event
export type NestContextCloudEventHandler<N, E extends CloudEvent<unknown>, O = unknown> = (request: CloudEventNestContextRequest<N, E>) => PromiseOrValue<O>;

export type NestContextCloudEventHandlerBuilder<N, E extends CloudEvent<unknown>, O = unknown> = (handler: NestContextCloudEventHandler<N, E, O>) => CloudEventHandler<E, O>;
export type NestContextCloudEventHandlerWithData<N, I, O = unknown> = NestContextCloudEventHandler<N, CloudEvent<I>, O>;
export type CloudEventHandlerWithNestContextBuilder<N, E extends CloudEvent<unknown>, O = unknown> = (nest: NestContextCloudEventHandlerBuilder<N, E, O>) => CloudFunction<E>;
export type CloudEventHandlerWithNestContextBuilderForBuilder<N, B extends CloudFunctionBuilder<any, any>> = B extends CloudFunctionBuilder<infer E, infer O> ? CloudEventHandlerWithNestContextBuilder<N, E, O> : never;

/**
 * Factory function for generating a firebase CloudFunction for a specific event.
 */
export type CloudEventHandlerWithNestContextFactory<N> = <E extends CloudEvent<unknown>, O = unknown>(fn: CloudEventHandlerWithNestContextBuilder<N, E, O>) => NestApplicationFunctionFactory<CloudFunction<E>>;

/**
 * Creates a CloudEventHandlerWithNestContextFactory.
 *
 * @param appFactory
 * @param makeNestContext
 * @returns
 */
export function cloudEventHandlerWithNestContextFactory<N>(makeNestContext: MakeNestContext<N>): CloudEventHandlerWithNestContextFactory<N> {
  return <E extends CloudEvent<unknown>, O = unknown>(fn: CloudEventHandlerWithNestContextBuilder<N, E, O>) => {
    return (nestAppPromiseGetter: NestApplicationPromiseGetter) => {
      const handlerBuilder: NestContextCloudEventHandlerBuilder<N, E, O> = (handler: NestContextCloudEventHandler<N, E, O>) => {
        const fnHandler: CloudEventHandler<E, O> = (event: E) =>
          nestAppPromiseGetter().then((nestApplication) =>
            handler({
              ...event,
              nest: makeNestContext(nestApplication)
            })
          );
        return fnHandler;
      };

      return fn(handlerBuilder);
    };
  };
}
