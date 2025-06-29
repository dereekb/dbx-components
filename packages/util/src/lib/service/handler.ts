import { type PrimativeKey, type ReadKeyFunction } from '../key';
import { type ArrayOrValue } from '../array/array';
import { build } from '../value/build';
import { type Maybe } from '../value/maybe.type';
import { type PromiseOrValue } from '../promise/promise.type';
import { setKeysOnMap } from '../map/map';

/**
 * Key used to signify
 */
export const CATCH_ALL_HANDLE_RESULT_KEY = '__CATCH_ALL_HANDLE_RESULT_KEY__';

/**
 * Whether or not the input value was handled.
 */
export type HandleResult = boolean;

/**
 * An internal type for the result of a handler function.
 *
 * If void is returned, assumes true.
 */
export type InternalHandlerFunctionHandleResult = HandleResult | void;

export type HandlerCatchAllKey = typeof CATCH_ALL_HANDLE_RESULT_KEY;
export type HandlerKey<K extends PrimativeKey = string> = K | HandlerCatchAllKey;

/**
 * Used to perform a task on the input value.
 *
 * If the value is not used/"handled", returns false.
 */
export type HandlerFunction<T, R = HandleResult> = (value: T) => Promise<R>;

/**
 * HandleFunction, but used only by Handler that can return undefined.
 */
export type InternalHandlerFunction<T, R = HandleResult> = (value: T) => PromiseOrValue<R | void>;

export interface HandlerSetAccessor<T, K extends PrimativeKey = string, R = HandleResult> {
  /**
   * Adds a new handler function to the current handler.
   *
   * @param key
   * @param handle
   */
  set(key: ArrayOrValue<HandlerKey<K>>, handle: InternalHandlerFunction<T, R>): void;
  /**
   * Sets the catch-all handler function to the current handler.
   *
   * @param handle
   */
  setCatchAll(handle: InternalHandlerFunction<T, R>): void;
}

export interface HandlerAccessor<T, K extends PrimativeKey = string, R = HandleResult> extends HandlerSetAccessor<T, K, R> {
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
  bindSet(bindTo: unknown, key: ArrayOrValue<HandlerKey<K>>, handle: InternalHandlerFunction<T, R>): void;
}

export type Handler<T, K extends PrimativeKey = string, R = HandleResult> = HandlerFunction<T, R> & HandlerAccessor<T, K, R>;
export type HandlerFactory<T, K extends PrimativeKey = string, R = HandleResult> = () => Handler<T, K, R>;

export interface HandlerFactoryOptions<R = HandleResult> {
  readonly defaultResult: R;
  readonly negativeResult: R;
}

export function handlerFactory<T, K extends PrimativeKey = string>(readKey: ReadKeyFunction<T, K>): HandlerFactory<T, K, HandleResult>;
export function handlerFactory<T, K extends PrimativeKey = string, R = HandleResult>(readKey: ReadKeyFunction<T, K>, options: HandlerFactoryOptions<R>): HandlerFactory<T, K, R>;
export function handlerFactory<T, K extends PrimativeKey = string, R = HandleResult>(readKey: ReadKeyFunction<T, K>, options?: HandlerFactoryOptions<R>): HandlerFactory<T, K, R> {
  const defaultResultValue = (options?.defaultResult ?? true) as R;
  const negativeResultValue = (options?.negativeResult ?? false) as R;

  return () => {
    let catchAll: Maybe<InternalHandlerFunction<T, R>>;
    const map = new Map<K, InternalHandlerFunction<T, R>>();

    const setCatchAll = (handle: InternalHandlerFunction<T, R>) => {
      catchAll = handle;
    };

    const set = (key: ArrayOrValue<K>, handle: InternalHandlerFunction<T, R>) => {
      if (key === CATCH_ALL_HANDLE_RESULT_KEY) {
        setCatchAll(handle);
      } else {
        setKeysOnMap(map, key, handle);
      }
    };

    const bindSet = (bindTo: unknown, key: ArrayOrValue<K>, handle: InternalHandlerFunction<T, R>) => {
      const bindHandle = handle.bind(bindTo);
      set(key, bindHandle);
    };

    const fn = build<Handler<T, K, R>>({
      base: ((value: T) => {
        const key = readKey(value);
        const handler = (key != null ? map.get(key) : undefined) ?? catchAll;
        let handled: Promise<R>;

        if (handler) {
          handled = Promise.resolve(handler(value)).then((x) => x ?? defaultResultValue);
        } else {
          handled = Promise.resolve(negativeResultValue);
        }

        return handled;
      }) as Handler<T, K, R>,
      build: (x) => {
        x.readKey = readKey;
        x.set = set;
        x.bindSet = bindSet;
        x.setCatchAll = setCatchAll;
      }
    });

    return fn;
  };
}

export function makeHandler<T, K extends PrimativeKey = string>(readKey: ReadKeyFunction<T, K>): Handler<T, K> {
  return handlerFactory(readKey)();
}

export function catchAllHandlerKey(): typeof CATCH_ALL_HANDLE_RESULT_KEY {
  return CATCH_ALL_HANDLE_RESULT_KEY;
}
