import { PrimativeKey, ReadKeyFunction } from './../key';
import { ArrayOrValue } from './../array/array';
import { Maybe, PromiseOrValue, setKeysOnMap } from '@dereekb/util';

/**
 * Key used to signify 
 */
export const CATCH_ALL_HANDLE_RESULT_KEY = '__CATCH_ALL_HANDLE_RESULT_KEY__';

/**
 * Whether or not the input value was handled.
 */
export type HandleResult = boolean;

export type HandlerCatchAllKey = typeof CATCH_ALL_HANDLE_RESULT_KEY;
export type HandlerKey<K extends PrimativeKey = string> = K | HandlerCatchAllKey;

/**
 * Used to perform a task on the input value.
 * 
 * If the value is not used/"handled", returns false.
 */
export type HandlerFunction<T> = (value: T) => PromiseOrValue<HandleResult>;

export interface HandlerSetAccessor<T, K extends PrimativeKey = string> {

  /**
   * Adds a new handler function to the current handler.
   * 
   * @param key 
   * @param handle 
   */
  set(key: ArrayOrValue<HandlerKey<K>>, handle: HandlerFunction<T>): void;

}

export interface HandlerAccessor<T, K extends PrimativeKey = string> extends HandlerSetAccessor<T, K> {

  /**
   * Used to read a handler key from the input value.
   */
  readonly readKey: ReadKeyFunction<T, K>;

  /**
   * Convenience function for binding a function. Useful for use within classes that pass their function and still need to be bound for when the function runs.
   * 
   * @param bindTo 
   * @param key 
   * @param handle 
   */
  bindSet(bindTo: any, key: ArrayOrValue<HandlerKey<K>>, handle: HandlerFunction<T>): void;

}

export type Handler<T, K extends PrimativeKey = string> = HandlerFunction<T> & HandlerAccessor<T, K>;
export type HandlerFactory<T, K extends PrimativeKey = string> = () => Handler<T, K>;

export function handlerFactory<T, K extends PrimativeKey = string>(readKey: ReadKeyFunction<T, K>): HandlerFactory<T, K> {
  return () => {
    let catchAll: Maybe<HandlerFunction<T>>;
    const map = new Map<K, HandlerFunction<T>>();

    const set = (key: ArrayOrValue<K>, handle: HandlerFunction<T>) => {
      if (key === CATCH_ALL_HANDLE_RESULT_KEY) {
        catchAll = handle;
      } else {
        setKeysOnMap(map, key, handle);
      }
    };

    const bindSet = (bindTo: any, key: ArrayOrValue<K>, handle: HandlerFunction<T>) => {
      const bindHandle = handle.bind(bindTo);
      set(key, bindHandle);
    };

    const fn: Handler<T, K> = ((value: T) => {
      const key = readKey(value);
      const handler = ((key != null) ? map.get(key) : undefined) ?? catchAll;
      let handled: PromiseOrValue<boolean> = false;

      if (handler) {
        handled = handler(value);
      }

      return handled;
    }) as any;

    (fn as any).readKey = readKey;
    fn.set = set;
    fn.bindSet = bindSet;

    return fn;
  };
}

export function makeHandler<T, K extends PrimativeKey = string>(readKey: ReadKeyFunction<T, K>): Handler<T, K> {
  return handlerFactory(readKey)();
}

export function catchAllHandlerKey(): typeof CATCH_ALL_HANDLE_RESULT_KEY {
  return CATCH_ALL_HANDLE_RESULT_KEY;
}
