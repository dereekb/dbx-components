import { type PromiseOrValue } from '@dereekb/util';
import { type TaskQueueFunction, type Request } from 'firebase-functions/v2/tasks';
import { type MakeNestContext, type NestApplicationFunctionFactory, type NestApplicationPromiseGetter } from '../../nest.provider';
import { type NestContextRequest } from '../nest';

export type TaskQueueNestContextRequest<N, I> = NestContextRequest<N, Request<I>>;

// MARK: From Firebase/TaskQueue Event
export type TaskQueueFunctionHandler<I = unknown> = (taskRequest: Request<I>) => PromiseOrValue<void>;

// MARK: TaskQueue Function
export type NestContextTaskQueueFunctionHandler<N, I = unknown> = (request: TaskQueueNestContextRequest<N, I>) => PromiseOrValue<void>;
export type NestContextTaskQueueFunctionHandlerBuilder<N, I = unknown> = (handler: NestContextTaskQueueFunctionHandler<N, I>) => TaskQueueFunctionHandler<I>;
export type TaskQueueFunctionHandlerWithNestContextBuilder<N, I = unknown> = (nest: NestContextTaskQueueFunctionHandlerBuilder<N, I>) => TaskQueueFunction<I>;

/**
 * Factory function for generating a TaskQueueFunction for a specific task.
 */
export type TaskQueueFunctionHandlerWithNestContextFactory<N> = <I = unknown>(fn: TaskQueueFunctionHandlerWithNestContextBuilder<N, I>) => NestApplicationFunctionFactory<TaskQueueFunction<I>>;

/**
 * Creates a TaskQueueFunctionHandlerWithNestContextFactory.
 *
 * @param appFactory
 * @param makeNestContext
 * @returns
 */
export function taskQueueFunctionHandlerWithNestContextFactory<N>(makeNestContext: MakeNestContext<N>): TaskQueueFunctionHandlerWithNestContextFactory<N> {
  return <I = unknown>(fn: TaskQueueFunctionHandlerWithNestContextBuilder<N, I>) => {
    return (nestAppPromiseGetter: NestApplicationPromiseGetter) => {
      const handlerBuilder: NestContextTaskQueueFunctionHandlerBuilder<N, I> = (handler: NestContextTaskQueueFunctionHandler<N, I>) => {
        const fnHandler: TaskQueueFunctionHandler<I> = (taskRequest: Request<I>) =>
          nestAppPromiseGetter().then((nestApplication) =>
            handler({
              ...taskRequest,
              nest: makeNestContext(nestApplication)
            })
          );
        return fnHandler;
      };

      return fn(handlerBuilder);
    };
  };
}

// TODO: Add factory that also adds onTaskDispatched usage, as the above is incomplete for full usage and only sets up a function for the request.
