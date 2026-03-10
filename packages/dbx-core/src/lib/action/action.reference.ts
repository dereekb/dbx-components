import { type Destroyable } from '@dereekb/util';
import { type DbxActionContextStoreSourceInstance } from './action.store.source';

/**
 * Acts as a reference to a DbxActionContextStoreSourceInstance that can be destroyed.
 *
 * This is used in cases where the action is passed around and the context it is passed to needs to clean up.
 */
export interface DbxActionContextSourceReference<T = unknown, O = unknown> extends Destroyable {
  readonly sourceInstance: DbxActionContextStoreSourceInstance<T, O>;
}

/**
 * Creates a simple {@link DbxActionContextSourceReference} wrapper around a source instance.
 *
 * The returned reference has a no-op `destroy()` method, making it suitable for cases
 * where the caller does not own the lifecycle of the source instance.
 *
 * @typeParam T - The input value type.
 * @typeParam O - The output result type.
 * @param sourceInstance - The source instance to wrap.
 * @returns A destroyable reference to the source instance.
 */
export function makeDbxActionContextSourceReference<T, O>(sourceInstance: DbxActionContextStoreSourceInstance<T, O>): DbxActionContextSourceReference<T, O> {
  return {
    sourceInstance,
    destroy: () => 0
  };
}
