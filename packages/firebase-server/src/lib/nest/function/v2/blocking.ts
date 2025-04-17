import { type PromiseOrValue } from '@dereekb/util';
import { type BlockingFunction } from 'firebase-functions/v1';
import { type MakeNestContext, type NestApplicationFunctionFactory, type NestApplicationPromiseGetter } from '../../nest.provider';
import { type NestContextRequest } from '../nest';

export type BlockingFunctionNestContextRequest<N, E extends object> = NestContextRequest<N, E>;

// MARK: From Firebase/Cloud Event
export type BlockingFunctionHandler<E extends object, O = unknown> = (event: E) => PromiseOrValue<O>;

// MARK: Blocking Function
export type NestContextBlockingFunctionHandler<N, E extends object, O = unknown> = (request: BlockingFunctionNestContextRequest<N, E>) => PromiseOrValue<O>;
export type NestContextBlockingFunctionHandlerBuilder<N, E extends object, O = unknown> = (handler: NestContextBlockingFunctionHandler<N, E, O>) => BlockingFunctionHandler<E, O>;
export type BlockingFunctionHandlerWithNestContextBuilder<N, E extends object, O = unknown> = (nest: NestContextBlockingFunctionHandlerBuilder<N, E, O>) => BlockingFunction;

/**
 * Factory function for generating a firebase BlockingFunction for a specific event.
 */
export type BlockingFunctionHandlerWithNestContextFactory<N> = <E extends object, O = unknown>(fn: BlockingFunctionHandlerWithNestContextBuilder<N, E, O>) => NestApplicationFunctionFactory<BlockingFunction>;

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
