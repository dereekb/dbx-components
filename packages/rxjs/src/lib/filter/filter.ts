import { type Observable } from 'rxjs';

/**
 * Abstract base class for providing reactive filter state.
 *
 * Implementations expose a `filter$` observable that emits the current filter value,
 * and optionally support initialization from an external observable.
 */
export abstract class FilterSource<F = unknown> {
  /**
   * Observable of the current filter value.
   */
  abstract readonly filter$: Observable<F>;
  /**
   * Optionally initializes this filter source from an external observable.
   *
   * Allows setting the initial/default filter value from an upstream source,
   * which is useful when composing filters hierarchically.
   */
  abstract initWithFilter?(filterObs: Observable<F>): void;
}

/**
 * String identifier used to reference a named filter preset configuration.
 */
export type FilterPresetString = string;

/**
 * Object that contains a {@link FilterPresetString} reference.
 *
 * When a preset value is present, it may either be used as the sole filter configuration
 * or act as a base that is overridden by other filter values.
 */
export interface FilterPresetStringRef<P extends string = string> {
  /**
   * Preset key identifying a named filter configuration.
   */
  preset: P;
}

/**
 * Filter type that optionally includes a preset reference.
 */
export type FilterWithPreset<P extends string = string> = Partial<FilterPresetStringRef<P>>;

/**
 * Makes the preset field optional on a filter that normally includes one.
 */
export type FilterWithPresetOptional<F extends FilterWithPreset<P>, P extends string = string> = Partial<Pick<F, 'preset'>> & Omit<F, 'preset'>;

/**
 * Extracts only the preset field from a filter type, discarding all other filter properties.
 */
export type FilterOnlyWithPresetString<F extends FilterWithPreset<P>, P extends string = string> = Pick<F, 'preset'>;

/**
 * Filter type with the preset field removed, retaining only the concrete filter properties.
 */
export type FilterWithoutPresetString<F extends FilterWithPreset<P>, P extends string = string> = Omit<F, 'preset'>;

/**
 * A {@link FilterSource} whose filter type includes an optional preset reference.
 *
 * Useful for filter UIs that support both preset configurations and custom filter values.
 */
export abstract class PresetFilterSource<F extends FilterWithPreset<P>, P extends string = string> extends FilterSource<F> {}

/**
 * Abstract connector that wires a {@link FilterSource} into a consuming component.
 *
 * Implementations define how to subscribe to a filter source and apply its values.
 */
export abstract class FilterSourceConnector<F = unknown> {
  /**
   * Connects with the input filter source to begin receiving filter updates.
   */
  abstract connectWithSource(filterSource: FilterSource<F>): void;
}
