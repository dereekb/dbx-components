import { type MapFunction } from '../value/map';
import { type ArrayOrValue } from '../array/array';
import { type PrimativeKey } from '../key';
import { type HandleResult, type InternalHandlerFunction, type Handler, type HandlerAccessor, type HandlerFunction, type HandlerSetAccessor } from './handler';

/**
 * Wraps a HandlerAccessor and the item it is bound to in order to be a HandlerSetAccessor.
 */
export interface HandlerBindAccessor<T, K extends PrimativeKey = string, R = HandleResult> extends HandlerSetAccessor<T, K, R> {
  readonly accessor: HandlerAccessor<T, K, R>;
  readonly boundTo: unknown;
}

/**
 * Creates a HandlerBindAccessor<T, K> for the input values.
 *
 * @param bindTo
 * @param accessor
 * @returns
 */
export function handlerBindAccessor<T, K extends PrimativeKey = string, R = HandleResult>(boundTo: unknown, accessor: HandlerAccessor<T, K, R>): HandlerBindAccessor<T, K, R> {
  return {
    accessor,
    boundTo,
    set: (key: ArrayOrValue<K>, handle: HandlerFunction<T, R>) => {
      accessor.bindSet(boundTo, key, handle);
    },
    setCatchAll: (handle: HandlerFunction<T, R>) => {
      accessor.setCatchAll(handle);
    }
  };
}

/**
 * Contextual function that configures the context's Handler with the input function for the context's key.
 */
export type HandlerSetFunction<T, R = HandleResult> = (handlerFunction: InternalHandlerFunction<T, R>) => void;

/**
 * Creates a HandlerSetFunction.
 *
 * @param accessor
 * @param key
 * @returns
 */
export function handlerSetFunction<T, K extends PrimativeKey = string, R = HandleResult>(accessor: HandlerSetAccessor<T, K, R>, key: ArrayOrValue<K>): HandlerSetFunction<T, R> {
  const fn = (handlerFunction: InternalHandlerFunction<T, R>) => {
    accessor.set(key, handlerFunction); // set the handler on the pre-defined key.
  };

  fn.key = key;

  return fn;
}

export type HandlerMappedSetFunction<I, R = HandleResult> = (handlerFunction: InternalHandlerFunction<I, R>) => void;

export function handlerMappedSetFunction<I, T, K extends PrimativeKey = string, R = HandleResult>(accessor: HandlerSetAccessor<T, K, R>, key: ArrayOrValue<K>, mapFn: MapFunction<T, I>): HandlerMappedSetFunction<I, R> {
  const handlerSet = handlerSetFunction(accessor, key);
  return (handlerFunction: InternalHandlerFunction<I, R>) => {
    // set an intermediary function that calls the target function. We don't use an arrow function so we have access to the "this", if bound.
    handlerSet(function (this: unknown, value: T) {
      const mapped = mapFn(value); // fowards "this" to the next call.
      return handlerFunction.call(this, mapped);
    });
  };
}

/**
 * Factory for a HandlerMappedSetFunction<I>.
 */
export type HandlerMappedSetFunctionFactory<I, K extends PrimativeKey = string, R = HandleResult> = (key: ArrayOrValue<K>) => HandlerMappedSetFunction<I, R>;

export function handlerMappedSetFunctionFactory<I, T, K extends PrimativeKey = string, R = HandleResult>(accessor: HandlerSetAccessor<T, K, R>, mapFn: MapFunction<T, I>): HandlerMappedSetFunctionFactory<I, K, R> {
  return (key: ArrayOrValue<K>) => handlerMappedSetFunction(accessor, key, mapFn);
}

export type HandlerConfigurerFunction<C extends HandlerBindAccessor<T, K, R>, T, K extends PrimativeKey = string, R = HandleResult> = (configurer: C) => void;
export type HandlerConfigurer<C extends HandlerBindAccessor<T, K, R>, T, K extends PrimativeKey = string, R = HandleResult> = (bindTo: unknown, configure: HandlerConfigurerFunction<C, T, K, R>) => void;
export type HandlerConfigurerFactory<C extends HandlerBindAccessor<T, K, R>, T, K extends PrimativeKey = string, R = HandleResult> = (handler: Handler<T, K, R>) => HandlerConfigurer<C, T, K, R>;

/**
 * Config for handlerConfigurerFactory().
 */
export interface HandlerConfigurerFactoryConfig<C extends HandlerBindAccessor<T, K, R>, T, K extends PrimativeKey = string, R = HandleResult> {
  configurerForAccessor: (accessor: HandlerBindAccessor<T, K, R>) => C;
}

export function handlerConfigurerFactory<C extends HandlerBindAccessor<T, K, R>, T, K extends PrimativeKey = string, R = HandleResult>(config: HandlerConfigurerFactoryConfig<C, T, K, R>): HandlerConfigurerFactory<C, T, K, R> {
  return (handler: Handler<T, K, R>) => {
    return (bindTo: unknown, configure: HandlerConfigurerFunction<C, T, K, R>) => {
      const accessor: HandlerBindAccessor<T, K, R> = handlerBindAccessor(bindTo, handler);
      const configurer: C = config.configurerForAccessor(accessor);
      configure(configurer);
    };
  };
}
