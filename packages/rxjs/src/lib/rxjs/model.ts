import { type ModelKeyRef, type UniqueModel } from '@dereekb/util';
import { distinctUntilObjectKeyChange } from './key';

/**
 * distinctUntilChanged() that compares id values.
 */
export function distinctUntilModelIdChange<T extends UniqueModel>() {
  return distinctUntilObjectKeyChange<T>((x) => x.id);
}

/**
 * distinctUntilChanged() that compares key values.
 */
export function distinctUntilModelKeyChange<T extends ModelKeyRef>() {
  return distinctUntilObjectKeyChange<T>((x) => x.key);
}
