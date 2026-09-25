import { isSameDateDay } from '@dereekb/date';
import { type ClickableFilterPreset, type ClickableFilterPresetOrPartialPreset, type ClickablePartialFilterPreset } from '@dereekb/dbx-core';
import { type ValueSelectionOption } from '@dereekb/dbx-form';
import { type FilterWithPreset } from '@dereekb/rxjs';
import { filterUndefinedValues, getValueFromGetter, type LabeledValue, type Maybe } from '@dereekb/util';
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

// MARK: Merged Filter
export type DocInteractionTestCategory = 'music' | 'sports' | 'art' | 'food';

/**
 * Filter that combines the date fields from DocInteractionTestFilter with the "attributes" fields edited by a second filter popover.
 */
export interface DocInteractionTestMergedFilter extends DocInteractionTestFilter {
  minPrice?: Maybe<number>;
  categories?: Maybe<DocInteractionTestCategory[]>;
}

export const DOC_INTERACTION_TEST_MIN_PRICE_OPTIONS: ValueSelectionOption<number>[] = [
  { label: 'Any', clear: true },
  { label: '$25+', value: 25 },
  { label: '$50+', value: 50 },
  { label: '$100+', value: 100 },
  { label: '$200+', value: 200 }
];

export const DOC_INTERACTION_TEST_CATEGORY_OPTIONS: LabeledValue<DocInteractionTestCategory>[] = [
  { label: 'Music', value: 'music' },
  { label: 'Sports', value: 'sports' },
  { label: 'Art', value: 'art' },
  { label: 'Food', value: 'food' }
];

/**
 * Returns only the attribute fields that are set on the filter.
 *
 * @param filter - Filter to read the attribute fields from.
 * @returns The minPrice and categories fields that are set.
 */
export function docInteractionTestAttributesFilter(filter: Maybe<DocInteractionTestMergedFilter>): DocInteractionTestMergedFilter {
  return filterUndefinedValues({
    minPrice: filter?.minPrice ?? undefined,
    categories: filter?.categories?.length ? filter.categories : undefined
  });
}

/**
 * Counts the attribute selections on the filter: one for a minimum price, plus one per selected category.
 *
 * @param filter - Filter to count the selections of.
 * @returns The number of attribute selections.
 */
export function docInteractionTestAttributesFilterSelectionCount(filter: Maybe<DocInteractionTestMergedFilter>): number {
  return (filter?.minPrice == null ? 0 : 1) + (filter?.categories?.length ?? 0);
}

/**
 * Re-resolves a date filter that was set from one of the DOC_INTERACTION_DATE_TEST_PRESETS, so a saved "Today" filter is today again when loaded later.
 *
 * Filters without a known preset are returned as-is.
 *
 * @param filter - Filter that was loaded from storage.
 * @returns The filter with its preset values re-resolved.
 */
export function refreshDocInteractionTestDatePresetFilter(filter: DocInteractionTestFilter): DocInteractionTestFilter {
  const preset = filter.preset ? DOC_INTERACTION_DATE_TEST_PRESETS.find((x) => x.preset === filter.preset) : undefined;
  const presetValue = preset ? (getValueFromGetter(preset.presetValue) as Maybe<DocInteractionTestFilter>) : undefined;
  return presetValue ? { ...presetValue, preset: filter.preset } : filter;
}
