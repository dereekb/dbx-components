import { FilterPresetStringRef, FilterWithoutPresetString, FilterWithPreset } from './filter';
import { map, OperatorFunction } from 'rxjs';

export type MapFilterWithPresetFn<F extends FilterWithPreset> = (filter: F) => FilterWithoutPresetString<F>;

export function makeMapFilterWithPresetFn<F extends FilterWithPreset>(fn: MapFilterWithPresetFn<F>): MapFilterWithPresetFn<F> {
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

export function mapFilterWithPreset<F extends FilterWithPreset>(fn: MapFilterWithPresetFn<F>): OperatorFunction<F, FilterWithoutPresetString<F>> {
  return map(makeMapFilterWithPresetFn(fn));
}
