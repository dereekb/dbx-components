import { FilterPresetStringRef, FilterWithPreset, FilterWithPresetOptional } from '@dereekb/rxjs';
import { EmptyObject, GetterOrValue } from '@dereekb/util';
import { ClickableAnchorLink } from '../router/anchor/anchor';

export interface ClickableFilterPreset<F extends FilterWithPreset<P>, P extends string = string> extends Pick<ClickableAnchorLink, 'title' | 'icon' | 'disabled'>, FilterPresetStringRef {
  /**
   * GetterOrValue that retrieves the filter for this preset.
   *
   * A null value or empty object is used for reset.
   */
  presetValue: GetterOrValue<FilterWithPresetOptional<F>> | EmptyObject | null;
}
