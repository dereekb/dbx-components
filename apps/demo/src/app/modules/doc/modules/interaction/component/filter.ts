import { ClickableFilterPreset } from '@dereekb/dbx-core';
import { FilterWithPreset } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { startOfDay, addDays } from 'date-fns';

export type DocInteractionTestFilterPresets = 'today';

export interface DocInteractionTestFilter extends FilterWithPreset<DocInteractionTestFilterPresets> {
  name?: Maybe<string>;
  date?: Maybe<Date>;
}

export const DOC_INTERACTION_TEST_PRESETS: ClickableFilterPreset<DocInteractionTestFilter>[] = [
  {
    icon: 'person',
    title: 'John Doe',
    preset: 'johndoe',
    presetValue: {
      name: 'John Doe'
    }
  },
  {
    icon: 'calendar_today',
    title: 'Today',
    preset: 'today',
    presetValue: {
      date: startOfDay(new Date())
    }
  },
  {
    icon: 'circle',
    title: 'Tomorrow',
    preset: 'tomorrow',
    presetValue: {
      date: startOfDay(addDays(new Date(), 1))
    }
  },
  {
    title: 'No Icon',
    preset: 'noicon',
    presetValue: {
      name: 'No Icon'
    }
  },
  {
    title: 'Reset With Empty',
    preset: 'delete',
    presetValue: {}
  },
  {
    title: 'Reset With Null',
    preset: 'delete',
    presetValue: null
  }
];
