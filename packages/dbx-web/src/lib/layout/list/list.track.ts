import { type TrackByFunction } from '@angular/core';
import { type ModelKeyRef, type UniqueModel } from '@dereekb/util';

export const TRACK_BY_MODEL_ID: TrackByFunction<UniqueModel> = (index, model) => model.id;

export function trackByUniqueIdentifier<T extends UniqueModel>(): TrackByFunction<T> {
  return TRACK_BY_MODEL_ID;
}

export const TRACK_BY_MODEL_KEY: TrackByFunction<ModelKeyRef> = (index, model) => model.key;

export function trackByModelKeyRef<T extends ModelKeyRef>(): TrackByFunction<T> {
  return TRACK_BY_MODEL_KEY;
}
