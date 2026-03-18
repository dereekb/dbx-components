import { type PromiseOrValue } from '@dereekb/util';
import { type CloudEvent, type CloudFunction } from 'firebase-functions/v2';
import { type MakeNestContext, type NestApplicationFunctionFactory, type NestApplicationPromiseGetter } from '../../nest.provider';
import { type NestContextRequest } from '../nest';

/**
 * Request type for cloud event handlers that include a typed nest context alongside the cloud event.
 *
 * @typeParam N - The nest context type.
 * @typeParam E - The specific {@link CloudEvent} subtype.
 */
export type CloudEventNestContextRequest<N, E extends CloudEvent<any>> = NestContextRequest<N, E>;

// MARK: From Firebase/Cloud Event
/**
 * A raw handler for a Firebase v2 {@link CloudEvent}.
 *
 * @typeParam E - The specific cloud event subtype.
 * @typeParam O - The return type (typically `void` for event handlers).
 */
export type CloudEventHandler<E extends CloudEvent<any>, O = unknown> = (event: E) => PromiseOrValue<O>;

/**
 * Abstraction over Firebase v2 cloud event function constructors (e.g., `onDocumentWritten`, `onObjectFinalized`).
 *
 * This enables the same factory pattern to work with any event-triggered function type.
 *
 * @typeParam E - The specific cloud event subtype.
 * @typeParam O - The return type.
 */
export interface CloudFunctionBuilder<E extends CloudEvent<any>, O = unknown> {
  (handler: (event: E) => PromiseOrValue<O>): CloudFunction<E>;
}

// MARK: Event
/**
 * A cloud event handler that receives the event augmented with a typed nest context.
 *
 * @typeParam N - The nest context type.
 * @typeParam E - The specific cloud event subtype.
 * @typeParam O - The return type.
 */
export type NestContextCloudEventHandler<N, E extends CloudEvent<any>, O = unknown> = (request: CloudEventNestContextRequest<N, E>) => PromiseOrValue<O>;

/**
 * Builder that wraps a {@link NestContextCloudEventHandler} into a raw {@link CloudEventHandler}
 * by injecting the nest context into each event before delegation.
 */
export type NestContextCloudEventHandlerBuilder<N, E extends CloudEvent<any>, O = unknown> = (handler: NestContextCloudEventHandler<N, E, O>) => CloudEventHandler<E, O>;

/**
 * Convenience alias for a {@link NestContextCloudEventHandler} where the event data type is specified
 * directly rather than as a full {@link CloudEvent} subtype.
 *
 * @typeParam N - The nest context type.
 * @typeParam I - The cloud event data type.
 * @typeParam O - The return type.
 */
export type NestContextCloudEventHandlerWithData<N, I, O = unknown> = NestContextCloudEventHandler<N, CloudEvent<I>, O>;

/**
 * Builder function that receives a {@link NestContextCloudEventHandlerBuilder} and uses it
 * to construct a complete {@link CloudFunction}, typically by calling the Firebase event
 * function constructor (e.g., `onDocumentWritten`) with the wrapped handler.
 */
export type CloudEventHandlerWithNestContextBuilder<N, E extends CloudEvent<any>, O = unknown> = (nest: NestContextCloudEventHandlerBuilder<N, E, O>) => CloudFunction<E>;

/**
 * Utility type that infers the correct {@link CloudEventHandlerWithNestContextBuilder} type
 * from a given {@link CloudFunctionBuilder}, preserving the event and output type parameters.
 */
export type CloudEventHandlerWithNestContextBuilderForBuilder<N, B extends CloudFunctionBuilder<any, any>> = B extends CloudFunctionBuilder<infer E, infer O> ? CloudEventHandlerWithNestContextBuilder<N, E, O> : never;

/**
 * Factory produced by CloudEventHandlerWithNestContextFactory.
 */
export type NestApplicationCloudEventFunctionFactory<E extends CloudEvent<any>> = NestApplicationFunctionFactory<CloudFunction<E>>;

/**
 * Factory function for generating a firebase CloudFunction for a specific event.
 */
export type CloudEventHandlerWithNestContextFactory<N> = <E extends CloudEvent<any>, O = unknown>(fn: CloudEventHandlerWithNestContextBuilder<N, E, O>) => NestApplicationCloudEventFunctionFactory<E>;

/**
 * Creates a {@link CloudEventHandlerWithNestContextFactory} that wires up NestJS application context
 * injection for Firebase v2 event-triggered functions.
 *
 * The returned factory lazily resolves the NestJS application on each event, injects the typed
 * context, and delegates to the handler. This is the event-triggered equivalent of
 * {@link onCallHandlerWithNestContextFactory} for callable functions.
 *
 * @example
 * ```ts
 * const factory = cloudEventHandlerWithNestContextFactory(makeMyContext);
 * const onWrite = factory<DocumentEvent, void>((nestHandler) =>
 *   onDocumentWritten('path/{id}', nestHandler((request) => {
 *     // request.nest is the typed context
 *     request.nest.myService.handleWrite(request.data);
 *   }))
 * );
 * ```
 *
 * @param makeNestContext - Factory that creates the typed context from the NestJS application context.
 * @returns A factory for creating nest-context-aware event function handlers.
 */
export function cloudEventHandlerWithNestContextFactory<N>(makeNestContext: MakeNestContext<N>): CloudEventHandlerWithNestContextFactory<N> {
  return <E extends CloudEvent<any>, O = unknown>(fn: CloudEventHandlerWithNestContextBuilder<N, E, O>) => {
    return (nestAppPromiseGetter: NestApplicationPromiseGetter) => {
      const handlerBuilder: NestContextCloudEventHandlerBuilder<N, E, O> = (handler: NestContextCloudEventHandler<N, E, O>) => {
        const fnHandler: CloudEventHandler<E, O> = (event: E) =>
          nestAppPromiseGetter().then((nestApplication) =>
            handler({
              ...event,
              nestApplication,
              nest: makeNestContext(nestApplication)
            })
          );
        return fnHandler;
      };

      return fn(handlerBuilder);
    };
  };
}
