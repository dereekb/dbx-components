import { PromiseOrValue } from '@dereekb/util';
import { TaskQueueFunction } from 'firebase-functions/v2/tasks';
import { MakeNestContext, NestApplicationFunctionFactory, NestApplicationPromiseGetter } from '../../nest.provider';

// MARK: TaskQueue Function
export type TaskQueueFunctionHandler<E = any> = (event: E) => PromiseOrValue<void>;
export type NestContextTaskQueueFunctionHandler<C, E = any> = (nest: C, event: E) => PromiseOrValue<void>;
export type NestContextTaskQueueFunctionHandlerBuilder<C, E = any> = (handler: NestContextTaskQueueFunctionHandler<C, E>) => TaskQueueFunctionHandler<E>;
export type TaskQueueFunctionHandlerWithNestContextBuilder<C, E = any> = (nest: NestContextTaskQueueFunctionHandlerBuilder<C, E>) => TaskQueueFunction<E>;

/**
 * Factory function for generating a TaskQueueFunction for a specific task.
 */
export type TaskQueueFunctionHandlerWithNestContextFactory<C> = <E = any>(fn: TaskQueueFunctionHandlerWithNestContextBuilder<C, E>) => NestApplicationFunctionFactory<TaskQueueFunction<E>>;

/**
 * Creates a TaskQueueFunctionHandlerWithNestContextFactory.
 * 
 * @param appFactory 
 * @param makeNestContext 
 * @returns 
 */
export function taskQueueFunctionHandlerWithNestContextFactory<C>(makeNestContext: MakeNestContext<C>): TaskQueueFunctionHandlerWithNestContextFactory<C> {
  return <E = any>(fn: TaskQueueFunctionHandlerWithNestContextBuilder<C, E>) => {
    return (nestAppPromiseGetter: NestApplicationPromiseGetter) => {
      const handlerBuilder: NestContextTaskQueueFunctionHandlerBuilder<C, E> = (handler: NestContextTaskQueueFunctionHandler<C, E>) => {
        const fnHandler: TaskQueueFunctionHandler<E> = (event: E) => nestAppPromiseGetter().then((nest) => handler(makeNestContext(nest), event));
        return fnHandler;
      };

      return fn(handlerBuilder);
    };
  };
}
