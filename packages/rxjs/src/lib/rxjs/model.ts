import { type ModelKeyRef, type UniqueModel } from '@dereekb/util';
import { distinctUntilObjectKeyChange } from './key';

/**
 * `distinctUntilChanged` variant that only emits when the model's `id` property changes.
 */
export function distinctUntilModelIdChange<T extends UniqueModel>() {
  return distinctUntilObjectKeyChange<T>((x) => x.id);
}

/**
 * `distinctUntilChanged` variant that only emits when the model's `key` property changes.
 */
export function distinctUntilModelKeyChange<T extends ModelKeyRef>() {
  return distinctUntilObjectKeyChange<T>((x) => x.key);
}
