import { type MaybeSo, type Maybe, type PromiseOrValue } from '@dereekb/util';
import { type MakeNestContext, type NestApplicationFunctionFactory, type NestApplicationPromiseGetter } from '../../nest.provider';
import { type NestContextRequest } from '../nest';
import { type BlockingFunction } from 'firebase-functions/v1';
import { type BlockingOptions, type beforeUserCreated } from 'firebase-functions/identity';

/**
 * The response type returned by a `beforeUserCreated` blocking function handler.
 *
 * Derived from the Firebase SDK's `beforeUserCreated` handler signature to stay in sync
 * with upstream type changes.
 */
export type BeforeCreateResponse = MaybeSo<Awaited<ReturnType<Parameters<typeof beforeUserCreated>[1]>>>;

/**
 * Request type for blocking function handlers that include a typed nest context alongside the blocking event.
 *
 * @typeParam N - The nest context type.
 * @typeParam E - The blocking event type (e.g., `AuthBlockingEvent`).
 */
export type BlockingFunctionNestContextRequest<N, E extends object> = NestContextRequest<N, E>;

// MARK: From Firebase/Cloud Event
/**
 * A raw blocking function handler that receives the Firebase event and optionally returns a response
 * to modify the authentication flow (e.g., setting custom claims or blocking sign-in).
 *
 * @typeParam E - The blocking event type.
 * @typeParam O - The optional return type that can modify the auth flow.
 */
export type BlockingFunctionHandler<E extends object, O> = (event: E) => PromiseOrValue<O | void>;

/**
 * Ref that holds a reference to the underlying {@link BlockingFunctionHandler}, enabling
 * direct invocation in tests without going through the Firebase trigger machinery.
 */
export type BlockingFunctionHandlerRef<E extends object, O> = { __handler: BlockingFunctionHandler<E, O> };

/**
 * BlockingFunction extension that also contains the handler and typing info.
 */
export type BlockingFunctionWithHandler<E extends object, O> = BlockingFunction & BlockingFunctionHandlerRef<E, O>;
/**
 * A {@link BlockingFunction} that may or may not have a handler ref attached. Used as the return type
 * of builder functions where the handler attachment is optional.
 */
export type BlockingFunctionMaybeWithHandler<E extends object, O> = BlockingFunction & Partial<BlockingFunctionHandlerRef<E, O>>;

/**
 * Abstraction over Firebase blocking function constructors (e.g., `beforeUserCreated`, `beforeUserSignedIn`).
 *
 * Supports both the options-less and options-with overloads, allowing the same builder pattern
 * to work with any blocking function type.
 *
 * @typeParam E - The blocking event type.
 * @typeParam O - The optional return type.
 */
export interface BlockingFunctionBuilder<E extends object, O> {
  (handler: (event: E) => PromiseOrValue<O | void>): BlockingFunction;
  (opts: BlockingOptions, handler: (event: E) => PromiseOrValue<O | void>): BlockingFunction;
}

/**
 * Creates a {@link BlockingFunctionWithHandler} by invoking the builder and attaching the handler ref.
 *
 * The attached `__handler` enables direct handler invocation in tests without triggering
 * the full Firebase blocking function infrastructure.
 *
 * @example
 * ```ts
 * const fn = makeBlockingFunctionWithHandler(
 *   beforeUserCreated,
 *   (event) => ({ displayName: event.data.email?.split('@')[0] }),
 *   { accessToken: true }
 * );
 * // In tests: fn.__handler(mockEvent)
 * ```
 *
 * @param blockingFunctionBuilder - The Firebase blocking function constructor (e.g., `beforeUserCreated`).
 * @param handler - The handler logic to execute on each event.
 * @param opts - Optional {@link BlockingOptions} passed to the builder.
 * @returns A {@link BlockingFunctionWithHandler} with the handler accessible via `__handler`.
 */
export function makeBlockingFunctionWithHandler<E extends object, O>(blockingFunctionBuilder: BlockingFunctionBuilder<E, O>, handler: BlockingFunctionHandler<E, O>, opts?: Maybe<BlockingOptions>): BlockingFunctionWithHandler<E, O> {
  const blockingFn = opts != null ? blockingFunctionBuilder(opts, handler) : blockingFunctionBuilder(handler);
  (blockingFn as BlockingFunctionWithHandler<E, O>).__handler = handler;
  return blockingFn as BlockingFunctionWithHandler<E, O>;
}

// MARK: Blocking Function
/**
 * A blocking function handler that receives the event augmented with a typed nest context.
 *
 * @typeParam N - The nest context type.
 * @typeParam E - The blocking event type.
 * @typeParam O - The optional return type.
 */
export type NestContextBlockingFunctionHandler<N, E extends object, O> = (request: BlockingFunctionNestContextRequest<N, E>) => PromiseOrValue<O | void>;

/**
 * Builder that wraps a {@link NestContextBlockingFunctionHandler} into a raw {@link BlockingFunctionHandler}
 * by injecting the nest context into each event before delegation.
 */
export type NestContextBlockingFunctionHandlerBuilder<N, E extends object, O> = (handler: NestContextBlockingFunctionHandler<N, E, O>) => BlockingFunctionHandler<E, O>;

/**
 * Builder function that receives a {@link NestContextBlockingFunctionHandlerBuilder} and uses it
 * to construct a complete {@link BlockingFunctionMaybeWithHandler}, typically by calling
 * {@link makeBlockingFunctionWithHandler} internally.
 */
export type BlockingFunctionHandlerWithNestContextBuilder<N, E extends object, O> = (nest: NestContextBlockingFunctionHandlerBuilder<N, E, O>) => BlockingFunctionMaybeWithHandler<E, O>;

/**
 * Utility type that infers the correct {@link BlockingFunctionHandlerWithNestContextBuilder} type
 * from a given {@link BlockingFunctionBuilder}, preserving the event and output type parameters.
 */
export type BlockingFunctionHandlerWithNestContextBuilderForBuilder<N, B extends BlockingFunctionBuilder<any, any>> = B extends BlockingFunctionBuilder<infer E, infer O> ? BlockingFunctionHandlerWithNestContextBuilder<N, E, O> : never;

/**
 * Factory produced by BlockingFunctionHandlerWithNestContextFactory.
 */
export type NestApplicationBlockingFunctionFactory<E extends object, O> = NestApplicationFunctionFactory<BlockingFunctionMaybeWithHandler<E, O>>;

/**
 * Factory function for generating a firebase BlockingFunction for a specific event.
 */
export type BlockingFunctionHandlerWithNestContextFactory<N> = <E extends object, O>(fn: BlockingFunctionHandlerWithNestContextBuilder<N, E, O>) => NestApplicationBlockingFunctionFactory<E, O>;

/**
 * Creates a {@link BlockingFunctionHandlerWithNestContextFactory} that wires up the NestJS application
 * context injection for blocking functions (e.g., `beforeUserCreated`, `beforeUserSignedIn`).
 *
 * The returned factory lazily resolves the NestJS application on each invocation, injects the
 * typed context into the event, and delegates to the handler.
 *
 * @example
 * ```ts
 * const factory = blockingFunctionHandlerWithNestContextFactory(makeMyContext);
 * const beforeCreate = factory<AuthBlockingEvent, BeforeCreateResponse>((nestHandler) =>
 *   makeBlockingFunctionWithHandler(beforeUserCreated, nestHandler((request) => {
 *     // request.nest is the typed context
 *     return { displayName: 'new-user' };
 *   }))
 * );
 * ```
 *
 * @param makeNestContext - Factory that creates the typed context from the NestJS application context.
 * @returns A factory for creating nest-context-aware blocking function handlers.
 */
export function blockingFunctionHandlerWithNestContextFactory<N>(makeNestContext: MakeNestContext<N>): BlockingFunctionHandlerWithNestContextFactory<N> {
  return <E extends object, O>(fn: BlockingFunctionHandlerWithNestContextBuilder<N, E, O>) => {
    return (nestAppPromiseGetter: NestApplicationPromiseGetter) => {
      const handlerBuilder: NestContextBlockingFunctionHandlerBuilder<N, E, O> = (handler: NestContextBlockingFunctionHandler<N, E, O>) => {
        const fnHandler: BlockingFunctionHandler<E, O> = (event: E) =>
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
