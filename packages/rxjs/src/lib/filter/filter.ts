import { Observable } from 'rxjs';

/**
 * Source that provides a filter observable.
 */
export abstract class FilterSource<F = object> {
  /**
   * Provided filter.
   */
  abstract readonly filter$: Observable<F>;
  /**
   * (Optional) Function that allows initializing a filter source from an observable.
   *
   * This lets the filter set its initial value, etc.
   */
  abstract initWithFilter?(filterObs: Observable<F>): void;
}

/**
 * An object that contains a preset identifier for the filter.
 */
export interface FilterPreset<P = string> {
  preset?: P;
}

/**
 * A FilterPreset with only the preset.
 */
export type FilterOnlyWithPreset<F extends FilterPreset> = Pick<F, 'preset'>;

/**
 * A FilterPreset without a preset value available.
 */
export type FilterWithoutPreset<F extends FilterPreset> = Omit<F, 'preset'>;

/**
 * A FilterSource that has a filter with a FilterPreset potentially available.
 */
export abstract class PresetFilterSource<F extends FilterPreset> extends FilterSource<F> {}

/**
 * A FilterSourceConnector connects with a Source for a function.
 */
export abstract class FilterSourceConnector<F = unknown> {
  /**
   * Coonnects with the input source.
   */
  abstract connectWithSource(filterSource: FilterSource<F>): void;
}
