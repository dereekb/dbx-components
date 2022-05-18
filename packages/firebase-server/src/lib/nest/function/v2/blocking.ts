import { PromiseOrValue } from '@dereekb/util';
import { BlockingFunction } from 'firebase-functions';
import { MakeNestContext, NestApplicationFunctionFactory, NestApplicationPromiseGetter } from '../../nest.provider';

// MARK: Blocking Function
export type BlockingFunctionHandler<E, O = any> = (event: E) => PromiseOrValue<O>;
export type NestContextBlockingFunctionHandler<C, E, O = any> = (nest: C, event: E) => PromiseOrValue<O>;
export type NestContextBlockingFunctionHandlerBuilder<C, E, O = any> = (handler: NestContextBlockingFunctionHandler<C, E, O>) => BlockingFunctionHandler<E, O>;
export type BlockingFunctionHandlerWithNestContextBuilder<C, E, O = any> = (nest: NestContextBlockingFunctionHandlerBuilder<C, E, O>) => BlockingFunction;

/**
 * Factory function for generating a firebase BlockingFunction for a specific event.
 */
export type BlockingFunctionHandlerWithNestContextFactory<C> = <E, O = any>(fn: BlockingFunctionHandlerWithNestContextBuilder<C, E, O>) => NestApplicationFunctionFactory<BlockingFunction>;

/**
 * Creates a BlockingFunctionHandlerWithNestContextFactory.
 * 
 * @param appFactory 
 * @param makeNestContext 
 * @returns 
 */
export function blockingFunctionHandlerWithNestContextFactory<C>(makeNestContext: MakeNestContext<C>): BlockingFunctionHandlerWithNestContextFactory<C> {
  return <E, O = any>(fn: BlockingFunctionHandlerWithNestContextBuilder<C, E, O>) => {    // NOTE: "any" instead of I is required to satisfy Typescript typing issues.
    return (nestAppPromiseGetter: NestApplicationPromiseGetter) => {
      const handlerBuilder: NestContextBlockingFunctionHandlerBuilder<C, E, O> = (handler: NestContextBlockingFunctionHandler<C, E, O>) => {
        const fnHandler: BlockingFunctionHandler<E, O> = (event: E) => nestAppPromiseGetter().then((nest) => handler(makeNestContext(nest), event));
        return fnHandler;
      };

      return fn(handlerBuilder);
    };
  };
}
