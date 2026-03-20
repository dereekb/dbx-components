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
 * Creates a {@link HandlerBindAccessor} that automatically binds handler functions to the given object
 * when registering them via `set`.
 *
 * @param boundTo - The object to bind handler functions to.
 * @param accessor - The underlying handler accessor to delegate to.
 * @returns A HandlerBindAccessor wrapping the accessor with automatic binding.
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
 * Creates a {@link HandlerSetFunction} that registers a handler function on a pre-defined key.
 *
 * @param accessor - The handler set accessor to register on.
 * @param key - The key (or keys) to associate the handler with.
 * @returns A function that accepts a handler function and registers it for the given key.
 */
export function handlerSetFunction<T, K extends PrimativeKey = string, R = HandleResult>(accessor: HandlerSetAccessor<T, K, R>, key: ArrayOrValue<K>): HandlerSetFunction<T, R> {
  const fn = (handlerFunction: InternalHandlerFunction<T, R>) => {
    accessor.set(key, handlerFunction); // set the handler on the pre-defined key.
  };

  fn.key = key;

  return fn;
}

/**
 * A function that registers a handler function whose input type differs from the handler's native type,
 * using a mapping function to convert between them.
 */
export type HandlerMappedSetFunction<I, R = HandleResult> = (handlerFunction: InternalHandlerFunction<I, R>) => void;

/**
 * Creates a {@link HandlerMappedSetFunction} that maps the handler's native input type to a different
 * type before invoking the registered handler function.
 *
 * @param accessor - The handler set accessor to register on.
 * @param key - The key (or keys) to associate the handler with.
 * @param mapFn - Function to map from the handler's native type to the handler function's expected type.
 * @returns A function that accepts a mapped handler function and registers it.
 */
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

/**
 * Creates a {@link HandlerMappedSetFunctionFactory} that produces mapped set functions for any given key.
 *
 * @param accessor - The handler set accessor to register on.
 * @param mapFn - Function to map from the handler's native type to the handler function's expected type.
 * @returns A factory that creates HandlerMappedSetFunctions for specific keys.
 */
export function handlerMappedSetFunctionFactory<I, T, K extends PrimativeKey = string, R = HandleResult>(accessor: HandlerSetAccessor<T, K, R>, mapFn: MapFunction<T, I>): HandlerMappedSetFunctionFactory<I, K, R> {
  return (key: ArrayOrValue<K>) => handlerMappedSetFunction(accessor, key, mapFn);
}

/**
 * A function that configures handler bindings via a configurer object.
 */
export type HandlerConfigurerFunction<C extends HandlerBindAccessor<T, K, R>, T, K extends PrimativeKey = string, R = HandleResult> = (configurer: C) => void;

/**
 * A function that binds an object to a handler and invokes a configure callback.
 */
export type HandlerConfigurer<C extends HandlerBindAccessor<T, K, R>, T, K extends PrimativeKey = string, R = HandleResult> = (bindTo: unknown, configure: HandlerConfigurerFunction<C, T, K, R>) => void;

/**
 * Factory that creates a {@link HandlerConfigurer} for a given handler.
 */
export type HandlerConfigurerFactory<C extends HandlerBindAccessor<T, K, R>, T, K extends PrimativeKey = string, R = HandleResult> = (handler: Handler<T, K, R>) => HandlerConfigurer<C, T, K, R>;

/**
 * Configuration for {@link handlerConfigurerFactory}.
 */
export interface HandlerConfigurerFactoryConfig<C extends HandlerBindAccessor<T, K, R>, T, K extends PrimativeKey = string, R = HandleResult> {
  /**
   * Creates a typed configurer from a bind accessor.
   */
  configurerForAccessor: (accessor: HandlerBindAccessor<T, K, R>) => C;
}

/**
 * Creates a {@link HandlerConfigurerFactory} that produces configurers for binding handler functions
 * to a handler instance with automatic `this` binding.
 *
 * @param config - Configuration providing the accessor-to-configurer mapping.
 * @returns A factory that creates HandlerConfigurers for specific handlers.
 */
export function handlerConfigurerFactory<C extends HandlerBindAccessor<T, K, R>, T, K extends PrimativeKey = string, R = HandleResult>(config: HandlerConfigurerFactoryConfig<C, T, K, R>): HandlerConfigurerFactory<C, T, K, R> {
  return (handler: Handler<T, K, R>) => {
    return (bindTo: unknown, configure: HandlerConfigurerFunction<C, T, K, R>) => {
      const accessor: HandlerBindAccessor<T, K, R> = handlerBindAccessor(bindTo, handler);
      const configurer: C = config.configurerForAccessor(accessor);
      configure(configurer);
    };
  };
}
