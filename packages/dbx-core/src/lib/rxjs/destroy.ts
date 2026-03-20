import { type DestroyFunction, DestroyFunctionObject, type Maybe } from '@dereekb/util';
import { clean } from './clean';

/**
 * Creates a new DestroyFunctionObject that is automatically destroyed when the context is destroyed.
 *
 * Must be run within an Angular injection context.
 *
 * @example
 * // Pass a destroy function directly:
 * cleanDestroy(() => resource.release());
 *
 * @example
 * // Create first, then set the destroy function later:
 * readonly _destroy = cleanDestroy();
 * this._destroy.setDestroyFunction(() => resource.release());
 *
 * @param input - Optional destroy function to wrap.
 * @returns A DestroyFunctionObject that will be automatically destroyed when the context is destroyed.
 */
export function cleanDestroy(input?: Maybe<DestroyFunction>): DestroyFunctionObject {
  const destroyFunction = new DestroyFunctionObject(input);
  clean(destroyFunction);
  return destroyFunction;
}
