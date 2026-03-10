import { type TrackByFunction } from '@angular/core';
import { type ModelKeyRef, type UniqueModel } from '@dereekb/util';

/**
 * Angular {@link TrackByFunction} that tracks {@link UniqueModel} items by their `id` property.
 */
export const TRACK_BY_MODEL_ID: TrackByFunction<UniqueModel> = (index, model) => model.id;

/**
 * Returns a {@link TrackByFunction} that tracks items by their unique `id` property.
 *
 * @example
 * ```ts
 * readonly trackBy = trackByUniqueIdentifier<MyModel>();
 * ```
 */
export function trackByUniqueIdentifier<T extends UniqueModel>(): TrackByFunction<T> {
  return TRACK_BY_MODEL_ID;
}

/**
 * Angular {@link TrackByFunction} that tracks {@link ModelKeyRef} items by their `key` property.
 */
export const TRACK_BY_MODEL_KEY: TrackByFunction<ModelKeyRef> = (index, model) => model.key;

/**
 * Returns a {@link TrackByFunction} that tracks items by their model `key` property.
 *
 * @example
 * ```ts
 * readonly trackBy = trackByModelKeyRef<MyModelRef>();
 * ```
 */
export function trackByModelKeyRef<T extends ModelKeyRef>(): TrackByFunction<T> {
  return TRACK_BY_MODEL_KEY;
}
