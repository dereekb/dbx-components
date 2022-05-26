import { FilterPreset, FilterWithoutPreset } from './filter';
import { map, OperatorFunction } from 'rxjs';

export type MapFilterWithPresetFn<F extends FilterPreset> = (filter: F) => FilterWithoutPreset<F>;

export function makeMapFilterWithPresetFn<F extends FilterPreset>(fn: MapFilterWithPresetFn<F>): MapFilterWithPresetFn<F> {
  return (filter: F) => {
    if (filter.preset) {
      const result = fn(filter) as F;
      delete result.preset;
      return result;
    } else {
      return filter;
    }
  };
}

export function mapFilterWithPreset<F extends FilterPreset>(fn: MapFilterWithPresetFn<F>): OperatorFunction<F, FilterWithoutPreset<F>> {
  return map(makeMapFilterWithPresetFn(fn));
}
