import { isSameDateDay } from '@dereekb/date';
import { type ClickableFilterPreset, type ClickableFilterPresetOrPartialPreset, type ClickablePartialFilterPreset } from '@dereekb/dbx-core';
import { type FilterWithPreset } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { startOfDay, addDays, endOfWeek, startOfWeek } from 'date-fns';

export type DocInteractionTestFilterPresets = 'johndoe' | 'today' | 'tomorrow' | 'week' | 'next_week' | 'next_two_weeks' | 'next_five_business_days' | 'noicon' | 'delete';

export interface DocInteractionTestFilter extends FilterWithPreset<DocInteractionTestFilterPresets> {
  name?: Maybe<string>;
  date?: Maybe<Date>;
  toDate?: Maybe<Date>;
}

export const DOC_INTERACTION_TEST_PRESETS: ClickableFilterPreset<DocInteractionTestFilter, DocInteractionTestFilterPresets>[] = [
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
    presetValue: () => ({
      date: startOfDay(new Date())
    })
  },
  {
    icon: 'circle',
    title: 'Tomorrow',
    preset: 'tomorrow',
    presetValue: () => ({
      date: startOfDay(addDays(new Date(), 1))
    })
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

export const DOC_INTERACTION_DATE_TEST_PRESETS: ClickableFilterPreset<DocInteractionTestFilter, DocInteractionTestFilterPresets>[] = [
  {
    icon: 'calendar_today',
    title: 'Today',
    preset: 'today',
    presetValue: () => ({
      date: startOfDay(new Date())
    })
  },
  {
    icon: 'calendar_today',
    title: 'Next Five Business Days',
    preset: 'next_five_business_days',
    presetValue: () => ({
      date: startOfDay(new Date()),
      toDate: startOfDay(addDays(new Date(), 7))
    })
  },
  {
    icon: 'calendar_today',
    title: 'Tomorrow',
    preset: 'tomorrow',
    presetValue: () => ({
      date: startOfDay(addDays(new Date(), 1))
    })
  },
  {
    icon: 'event',
    title: 'This Week',
    preset: 'week',
    presetValue: () => ({
      date: startOfWeek(new Date()),
      toDate: endOfWeek(new Date())
    })
  },
  {
    icon: 'event',
    title: 'Next Week',
    preset: 'next_week',
    presetValue: () => ({
      date: startOfWeek(addDays(new Date(), 7)),
      toDate: endOfWeek(addDays(new Date(), 7))
    })
  },
  {
    icon: 'event',
    title: 'Next Two Weeks',
    preset: 'next_two_weeks',
    presetValue: () => ({
      date: startOfDay(new Date()),
      toDate: endOfWeek(addDays(new Date(), 14))
    })
  }
];

export const DOC_INTERACTION_TEST_PARTIAL_PRESETS: ClickablePartialFilterPreset<DocInteractionTestFilter>[] = [
  {
    icon: 'calendar_today',
    title: 'Today',
    partialPresetValue: () => ({
      date: startOfDay(new Date())
    }),
    isActive: (x) => {
      return isSameDateDay(x?.date, new Date());
    }
  },
  {
    icon: 'circle',
    title: 'Tomorrow',
    partialPresetValue: () => ({
      date: startOfDay(addDays(new Date(), 1))
    }),
    isActive: (x) => {
      return isSameDateDay(x?.date, startOfDay(addDays(new Date(), 1)));
    }
  }
];

export const DOC_INTERACTION_TEST_FULL_AND_PARTIAL_PRESETS: ClickableFilterPresetOrPartialPreset<DocInteractionTestFilter, DocInteractionTestFilterPresets>[] = [...DOC_INTERACTION_TEST_PRESETS, ...DOC_INTERACTION_TEST_PARTIAL_PRESETS];
