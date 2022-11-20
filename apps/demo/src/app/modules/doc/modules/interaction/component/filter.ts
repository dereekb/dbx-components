import { FilterPresetStringRef, FilterWithPreset } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';

export type DocInteractionTestFilterPresets = 'today';

export interface DocInteractionTestFilter extends FilterWithPreset<DocInteractionTestFilterPresets> {
  name?: Maybe<string>;
  date?: Maybe<Date>;
}
