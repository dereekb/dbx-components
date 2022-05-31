import { PromiseOrValue, Maybe, ModelKey } from '@dereekb/util';

/**
 * Interface used to load models given a key.
 */
export interface ModelLoader<C, T> {
  loadModelForKey(key: ModelKey, context: C): PromiseOrValue<Maybe<T>>;
}
