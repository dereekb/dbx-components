import { type Maybe, type PromiseOrValue } from '@dereekb/util';
import { type MakeNestContext, type NestApplicationFunctionFactory, type NestApplicationPromiseGetter } from '../../nest.provider';
import { type NestContextRequest } from '../nest';
import { type BlockingFunction } from 'firebase-functions/v1';
import { type BlockingOptions } from 'firebase-functions/identity';

export type BlockingFunctionNestContextRequest<N, E extends object> = NestContextRequest<N, E>;

// MARK: From Firebase/Cloud Event
export type BlockingFunctionHandler<E extends object, O> = (event: E) => PromiseOrValue<O | void>;
export type BlockingFunctionHandlerRef<E extends object, O> = { __handler: BlockingFunctionHandler<E, O> };

/**
 * BlockingFunction extension that also contains the handler and typing info.
 */
export type BlockingFunctionWithHandler<E extends object, O> = BlockingFunction & BlockingFunctionHandlerRef<E, O>;
export type BlockingFunctionMaybeWithHandler<E extends object, O> = BlockingFunction & Partial<BlockingFunctionHandlerRef<E, O>>;

export interface BlockingFunctionBuilder<E extends object, O> {
  (handler: (event: E) => PromiseOrValue<O | void>): BlockingFunction;
  (opts: BlockingOptions, handler: (event: E) => PromiseOrValue<O | void>): BlockingFunction;
}

/**
 * Creates a BlockingFunctionWithHandler from the input.
 *
 * @param blockingFunctionBuilder
 * @param handler
 * @returns
 */
export function makeBlockingFunctionWithHandler<E extends object, O>(blockingFunctionBuilder: BlockingFunctionBuilder<E, O>, handler: BlockingFunctionHandler<E, O>, opts?: Maybe<BlockingOptions>): BlockingFunctionWithHandler<E, O> {
  const blockingFn = opts != null ? blockingFunctionBuilder(opts, handler) : blockingFunctionBuilder(handler);
  (blockingFn as BlockingFunctionWithHandler<E, O>).__handler = handler;
  return blockingFn as BlockingFunctionWithHandler<E, O>;
}

// MARK: Blocking Function
export type NestContextBlockingFunctionHandler<N, E extends object, O> = (request: BlockingFunctionNestContextRequest<N, E>) => PromiseOrValue<O | void>;
export type NestContextBlockingFunctionHandlerBuilder<N, E extends object, O> = (handler: NestContextBlockingFunctionHandler<N, E, O>) => BlockingFunctionHandler<E, O>;
export type BlockingFunctionHandlerWithNestContextBuilder<N, E extends object, O> = (nest: NestContextBlockingFunctionHandlerBuilder<N, E, O>) => BlockingFunctionMaybeWithHandler<E, O>;
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
 * Creates a BlockingFunctionHandlerWithNestContextFactory.
 *
 * @param appFactory
 * @param makeNestContext
 * @returns
 */
export function blockingFunctionHandlerWithNestContextFactory<N>(makeNestContext: MakeNestContext<N>): BlockingFunctionHandlerWithNestContextFactory<N> {
  return <E extends object, O>(fn: BlockingFunctionHandlerWithNestContextBuilder<N, E, O>) => {
    return (nestAppPromiseGetter: NestApplicationPromiseGetter) => {
      const handlerBuilder: NestContextBlockingFunctionHandlerBuilder<N, E, O> = (handler: NestContextBlockingFunctionHandler<N, E, O>) => {
        const fnHandler: BlockingFunctionHandler<E, O> = (event: E) =>
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
