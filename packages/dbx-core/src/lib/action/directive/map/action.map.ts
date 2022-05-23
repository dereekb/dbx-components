import { ActionContextStoreSource } from '../../action.store.source';

export type ActionKey = string;

/**
 * Map that returns sources for ActionKey values.
 */
export abstract class ActionContextStoreSourceMap<T = unknown, O = unknown> {
  /**
   * Returns a ActionContextStoreSource for the input action key.
   *
   * @param key Action key to retrieve the source for.
   */
  abstract sourceForKey(key: ActionKey): ActionContextStoreSource<T, O>;
}
