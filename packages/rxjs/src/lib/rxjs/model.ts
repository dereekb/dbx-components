import { type ModelKeyRef, type UniqueModel } from '@dereekb/util';
import { distinctUntilObjectKeyChange } from './key';

/**
 * `distinctUntilChanged` variant that only emits when the model's `id` property changes.
 *
 * @returns operator that suppresses consecutive emissions with the same model `id`
 */
export function distinctUntilModelIdChange<T extends UniqueModel>() {
  return distinctUntilObjectKeyChange<T>((x) => x.id);
}

/**
 * `distinctUntilChanged` variant that only emits when the model's `key` property changes.
 *
 * @returns operator that suppresses consecutive emissions with the same model `key`
 */
export function distinctUntilModelKeyChange<T extends ModelKeyRef>() {
  return distinctUntilObjectKeyChange<T>((x) => x.key);
}
