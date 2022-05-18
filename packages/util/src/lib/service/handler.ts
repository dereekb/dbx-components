import { PrimativeKey, ReadKeyFunction } from './../key';
import { ArrayOrValue } from './../array/array';
import { PromiseOrValue, setKeysOnMap } from '@dereekb/util';

/**
 * Whether or not the input value was handled.
 */
export type HandleResult = boolean;

/**
 * Used to perform a task on the input value.
 * 
 * If the value is not used/"handled", returns false.
 */
export type HandlerFunction<T> = (value: T) => PromiseOrValue<HandleResult>;

export interface HandlerAccessor<T, K extends PrimativeKey = string> {
  /**
   * Used to read a handler key from the input value.
   */
  readonly readKey: ReadKeyFunction<T, K>;
  /**
   * Adds a new handler function to the current handler.
   * 
   * @param key 
   * @param handle 
   */
  set(key: ArrayOrValue<K>, handle: HandlerFunction<T>): void;
  /**
   * Convenience function for binding a function. Useful for classes.
   * 
   * @param bindTo 
   * @param key 
   * @param handle 
   */
  bindSet(bindTo: any, key: ArrayOrValue<K>, handle: HandlerFunction<T>): void;
}

export type Handler<T, K extends PrimativeKey = string> = HandlerFunction<T> & HandlerAccessor<T, K>;
export type HandlerFactory<T, K extends PrimativeKey = string> = () => Handler<T, K>;

export function handlerFactory<T, K extends PrimativeKey = string>(readKey: ReadKeyFunction<T, K>): HandlerFactory<T, K> {
  return () => {
    const map = new Map<K, HandlerFunction<T>>();

    const set = (key: ArrayOrValue<K>, handle: HandlerFunction<T>) => {
      setKeysOnMap(map, key, handle);
    };

    const bindSet = (bindTo: any, key: ArrayOrValue<K>, handle: HandlerFunction<T>) => {
      const bindHandle = handle.bind(bindTo);
      set(key, bindHandle);
    };

    const fn: Handler<T, K> = ((value: T) => {
      const key = readKey(value);
      const handler = (key != null) ? map.get(key) : undefined;
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
