import { ActionContextStoreSource } from "@dereekb/ngx-core";

export type ActionKey = string;

/**
 * Map that returns sources for ActionKey values.
 */
export abstract class ActionContextStoreSourceMap<T = any, O = any> {
  /**
   * Returns a ActionContextStoreSource for the input action key.
   *
   * @param key Action key to retrieve the source for.
   */
  abstract sourceForKey(key: ActionKey): ActionContextStoreSource<T, O>;
}
