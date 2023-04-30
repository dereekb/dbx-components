import { FilterPresetStringRef, FilterWithPreset, FilterWithPresetOptional } from '@dereekb/rxjs';
import { EmptyObject, GetterOrValue, Maybe } from '@dereekb/util';
import { ClickableAnchorLink } from '../router/anchor/anchor';

export interface ClickableFilterPreset<F extends FilterWithPreset<P>, P extends string = string> extends Pick<ClickableAnchorLink, 'title' | 'icon' | 'disabled'>, FilterPresetStringRef<P> {
  /**
   * GetterOrValue that retrieves the filter for this preset.
   *
   * A null value or empty object is used for reset.
   */
  readonly presetValue: GetterOrValue<FilterWithPresetOptional<F>> | EmptyObject | null;
}

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
