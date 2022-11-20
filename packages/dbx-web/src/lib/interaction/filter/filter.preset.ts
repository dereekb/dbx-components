import { ClickableAnchorLink } from '@dereekb/dbx-core';
import { FilterPresetStringRef, FilterWithoutPresetString, FilterWithPreset, FilterWithPresetOptional, ObservableOrValueGetter } from '@dereekb/rxjs';
import { GetterOrValue } from '@dereekb/util';

export interface ClickableFilterPreset<F extends FilterWithPreset<P>, P extends string = string> extends Pick<ClickableAnchorLink, 'title' | 'icon' | 'disabled'>, FilterPresetStringRef {
  /**
   * GetterOrValue that retrieves the filter for this preset.
   */
  presetValue: GetterOrValue<FilterWithPresetOptional<F>>;
}
