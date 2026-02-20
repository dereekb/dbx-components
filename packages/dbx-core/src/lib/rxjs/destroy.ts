import { type DestroyFunction, DestroyFunctionObject, type Maybe } from '@dereekb/util';
import { clean } from './clean';

/**
 * Creates a new DestroyFunctionObject that is automatically destroyed when the context is destroyed.
 *
 * Must be run within an Angular injection context.
 */
export function cleanDestroy(input?: Maybe<DestroyFunction>): DestroyFunctionObject {
  const destroyFunction = new DestroyFunctionObject(input);
  clean(destroyFunction);
  return destroyFunction;
}
