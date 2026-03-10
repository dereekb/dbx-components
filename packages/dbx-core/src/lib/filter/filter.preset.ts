import { type FilterPresetStringRef, type FilterWithPreset, type FilterWithPresetOptional } from '@dereekb/rxjs';
import { type EmptyObject, type GetterOrValue, type Maybe, objectHasKey, objectHasKeys } from '@dereekb/util';
import { type ClickableAnchorLink } from '../router/anchor/anchor';

/**
 * A clickable preset that applies a predefined filter value when selected.
 *
 * Combines display properties (title, icon, disabled) with a filter preset value.
 * A `null` or empty `presetValue` resets the filter.
 *
 * @typeParam F - The filter type, which must include a preset field.
 * @typeParam P - The preset string identifier type.
 *
 * @example
 * ```typescript
 * const preset: ClickableFilterPreset<MyFilter> = {
 *   preset: 'active',
 *   title: 'Active Items',
 *   icon: 'check',
 *   presetValue: { status: 'active', preset: 'active' },
 * };
 * ```
 */
export interface ClickableFilterPreset<F extends FilterWithPreset<P>, P extends string = string> extends Pick<ClickableAnchorLink, 'title' | 'icon' | 'disabled'>, FilterPresetStringRef<P> {
  /**
   * GetterOrValue that retrieves the filter for this preset.
   *
   * A null value or empty object is used for reset.
   */
  readonly presetValue: GetterOrValue<FilterWithPresetOptional<F>> | EmptyObject | null;
}

/**
 * Type guard that checks if an object is a {@link ClickableFilterPreset}.
 */
export function isClickableFilterPreset<F extends FilterWithPreset<P>, P extends string = string>(preset: object): preset is ClickableFilterPreset<F, P> {
  return objectHasKey(preset, 'presetValue');
}

/**
 * A clickable preset that applies a partial filter modification when selected,
 * with an `isActive` predicate to determine whether the preset is currently active.
 *
 * Unlike {@link ClickableFilterPreset}, this merges a partial value rather than replacing the full filter.
 *
 * @typeParam F - The filter type.
 */
export interface ClickablePartialFilterPreset<F> extends Pick<ClickableAnchorLink, 'title' | 'icon' | 'disabled'> {
  /**
   * GetterOrValue that retrieves the partial filter value.
   *
   * A null value or empty object is used for no change.
   */
  readonly partialPresetValue: GetterOrValue<Partial<F>> | EmptyObject | null;
  /**
   * The current value to test against. Returns true if this partial preset is considered active.
   */
  readonly isActive: (currentFilter: Maybe<Partial<F>>) => boolean;
}

/**
 * Type guard that checks if an object is a {@link ClickablePartialFilterPreset}.
 */
export function isClickablePartialFilterPreset<F>(preset: object): preset is ClickablePartialFilterPreset<F> {
  return objectHasKeys(preset, ['partialPresetValue', 'isActive']);
}

/**
 * Convenience type for either a ClickableFilterPreset or a ClickablePartialFilterPreset of the same type.
 */
export type ClickableFilterPresetOrPartialPreset<F extends FilterWithPreset<P>, P extends string = string> = ClickableFilterPreset<F, P> | ClickablePartialFilterPreset<F>;
