import { Destroyable } from "@dereekb/util";
import { DbxActionContextStoreSourceInstance } from "./action.store.source";

/**
 * Acts as a reference to a DbxActionContextStoreSourceInstance that can be destroyed.
 * 
 * This is used in cases where the action is passed around and the context it is passed to needs to clean up.
 */
export interface DbxActionContextSourceReference<T = unknown, O = unknown> extends Destroyable {
  readonly sourceInstance: DbxActionContextStoreSourceInstance<T, O>;
}

export function makeDbxActionContextSourceReference<T, O>(sourceInstance: DbxActionContextStoreSourceInstance<T, O>): DbxActionContextSourceReference<T, O> {
  return {
    sourceInstance,
    destroy: () => 0
  };
}
