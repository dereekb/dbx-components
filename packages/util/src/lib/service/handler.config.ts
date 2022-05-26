import { MapFunction } from '../value/map';
import { ArrayOrValue } from '../array/array';
import { PrimativeKey } from '../key';
import { Handler, HandlerAccessor, HandlerFunction, HandlerSetAccessor } from './handler';

/**
 * Wraps a HandlerAccessor and the item it is bound to in order to be a HandlerSetAccessor.
 */
export interface HandlerBindAccessor<T, K extends PrimativeKey = string> extends HandlerSetAccessor<T, K> {
  readonly accessor: HandlerAccessor<T, K>;
  readonly boundTo: unknown;
}

/**
 * Creates a HandlerBindAccessor<T, K> for the input values.
 *
 * @param bindTo
 * @param accessor
 * @returns
 */
export function handlerBindAccessor<T, K extends PrimativeKey = string>(boundTo: unknown, accessor: HandlerAccessor<T, K>): HandlerBindAccessor<T, K> {
  return {
    accessor,
    boundTo,
    set: (key: ArrayOrValue<K>, handle: HandlerFunction<T>) => {
      accessor.bindSet(boundTo, key, handle);
    }
  };
}

/**
 * Contextual function that configures the context's Handler with the input function for the context's key.
 */
export type HandlerSetFunction<T> = (handlerFunction: HandlerFunction<T>) => void;

/**
 * Creates a HandlerSetFunction.
 *
 * @param accessor
 * @param key
 * @returns
 */
export function handlerSetFunction<T, K extends PrimativeKey = string>(accessor: HandlerSetAccessor<T, K>, key: ArrayOrValue<K>): HandlerSetFunction<T> {
  const fn = (handlerFunction: HandlerFunction<T>) => {
    accessor.set(key, handlerFunction); // set the handler on the pre-defined key.
  };

  fn.key = key;

  return fn;
}

export type HandlerMappedSetFunction<I> = (handlerFunction: HandlerFunction<I>) => void;

export function handlerMappedSetFunction<I, T, K extends PrimativeKey = string>(accessor: HandlerSetAccessor<T, K>, key: ArrayOrValue<K>, mapFn: MapFunction<T, I>): HandlerMappedSetFunction<I> {
  const handlerSet = handlerSetFunction(accessor, key);
  return (handlerFunction: HandlerFunction<I>) => {
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
export type HandlerMappedSetFunctionFactory<I, K extends PrimativeKey = string> = (key: ArrayOrValue<K>) => HandlerMappedSetFunction<I>;

export function handlerMappedSetFunctionFactory<I, T, K extends PrimativeKey = string>(accessor: HandlerSetAccessor<T, K>, mapFn: MapFunction<T, I>): HandlerMappedSetFunctionFactory<I, K> {
  return (key: ArrayOrValue<K>) => handlerMappedSetFunction(accessor, key, mapFn);
}

export type HandlerConfigurerFunction<C extends HandlerBindAccessor<T, K>, T, K extends PrimativeKey = string> = (configurer: C) => void;
export type HandlerConfigurer<C extends HandlerBindAccessor<T, K>, T, K extends PrimativeKey = string> = (bindTo: unknown, configure: HandlerConfigurerFunction<C, T, K>) => void;
export type HandlerConfigurerFactory<C extends HandlerBindAccessor<T, K>, T, K extends PrimativeKey = string> = (handler: Handler<T, K>) => HandlerConfigurer<C, T, K>;

/**
 * Config for handlerConfigurerFactory().
 */
export interface HandlerConfigurerFactoryConfig<C extends HandlerBindAccessor<T, K>, T, K extends PrimativeKey = string> {
  configurerForAccessor: (accessor: HandlerBindAccessor<T, K>) => C;
}

export function handlerConfigurerFactory<C extends HandlerBindAccessor<T, K>, T, K extends PrimativeKey = string>(config: HandlerConfigurerFactoryConfig<C, T, K>): HandlerConfigurerFactory<C, T, K> {
  return (handler: Handler<T, K>) => {
    return (bindTo: unknown, configure: HandlerConfigurerFunction<C, T, K>) => {
      const accessor: HandlerBindAccessor<T, K> = handlerBindAccessor(bindTo, handler);
      const configurer: C = config.configurerForAccessor(accessor);
      configure(configurer);
    };
  };
}
