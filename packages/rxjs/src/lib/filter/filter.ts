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
 * Preset identifier.
 */
export type FilterPresetString = string;

/**
 * An object that contains a FilterPresetString.
 *
 * When a preset value is present, it may either be used as the sole filter variable, or act as a base that is overwritten by other values.
 */
export interface FilterPresetStringRef<P extends string = string> {
  /**
   * Preset key.
   */
  preset: P;
}

export type FilterWithPreset<P extends string = string> = Partial<FilterPresetStringRef<P>>;

export type FilterWithPresetOptional<F extends FilterWithPreset<P>, P extends string = string> = Partial<Pick<F, 'preset'>> & Omit<F, 'preset'>;

/**
 * A FilterPreset with only the preset.
 */
export type FilterOnlyWithPresetString<F extends FilterWithPreset<P>, P extends string = string> = Pick<F, 'preset'>;

/**
 * A FilterPreset without a preset value available.
 */
export type FilterWithoutPresetString<F extends FilterWithPreset<P>, P extends string = string> = Omit<F, 'preset'>;

/**
 * A FilterSource that has a filter with a FilterPreset potentially available.
 */
export abstract class PresetFilterSource<F extends FilterWithPreset<P>, P extends string = string> extends FilterSource<F> {}

/**
 * A FilterSourceConnector connects with a Source for a function.
 */
export abstract class FilterSourceConnector<F = unknown> {
  /**
   * Coonnects with the input source.
   */
  abstract connectWithSource(filterSource: FilterSource<F>): void;
}
