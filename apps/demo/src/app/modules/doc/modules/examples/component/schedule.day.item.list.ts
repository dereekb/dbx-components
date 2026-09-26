import { type DbxValueAsListItem } from '@dereekb/dbx-web';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type ISO8601DayString, type Maybe } from '@dereekb/util';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';

/**
 * Booking state of a single schedule day.
 */
export type ScheduleDayItemState = 'booked' | 'open';

/**
 * The session booked on a schedule day.
 */
export interface ScheduleDaySession {
  readonly title: string;
  readonly locationName: string;
  readonly dateRange: string;
  readonly timeRange: string;
}

export interface ScheduleDayItemValue {
  readonly key: string;
  /**
   * The schedule day. Days are weekdays, sorted ascending.
   */
  readonly day: ISO8601DayString;
  /**
   * Short weekday label, e.g. `Fri`.
   */
  readonly dayLabel: string;
  /**
   * Short date label, e.g. `Sep 25`.
   */
  readonly dateLabel: string;
  readonly state: ScheduleDayItemState;
  /**
   * The booked session. Only set when {@link state} is `'booked'`.
   */
  readonly session?: Maybe<ScheduleDaySession>;
  /**
   * Fired by the row's trailing button — "View Details" for a booked day, "Browse sessions" for an open day.
   */
  readonly anchor: ClickableAnchor;
}

export type ScheduleDayItemValueWithSelection = DbxValueAsListItem<ScheduleDayItemValue>;

export interface ScheduleDayItemSeed {
  readonly day: ISO8601DayString;
  /**
   * The booked session. Days without one are open.
   */
  readonly session?: Maybe<ScheduleDaySession>;
}

const CERAMICS_WORKSHOP_SESSION: ScheduleDaySession = {
  title: 'Wheel-Thrown Ceramics Workshop',
  locationName: 'Studio B · Riverside Arts Center',
  dateRange: '9/23 – 9/29',
  timeRange: '10:00 AM – 1:00 PM MDT'
};

/**
 * Seed days. Gaps between them (the Sep 26–27 weekend, Oct 1–6, Oct 9–13) render the list's gap separators.
 */
export const SCHEDULE_DAY_ITEM_SEEDS: readonly ScheduleDayItemSeed[] = [
  { day: '2026-09-25', session: CERAMICS_WORKSHOP_SESSION },
  { day: '2026-09-28', session: CERAMICS_WORKSHOP_SESSION },
  { day: '2026-09-29', session: CERAMICS_WORKSHOP_SESSION },
  { day: '2026-09-30' },
  {
    day: '2026-10-07',
    session: {
      title: 'Figure Drawing Open Studio',
      locationName: 'Gallery Loft · Riverside Arts Center',
      dateRange: '10/7',
      timeRange: '6:00 PM – 8:30 PM MDT'
    }
  },
  { day: '2026-10-08' },
  {
    day: '2026-10-14',
    session: {
      title: 'Glaze Chemistry Lab',
      locationName: 'Kiln Room · Riverside Arts Center',
      dateRange: '10/14 – 10/15',
      timeRange: '9:00 AM – 12:00 PM MDT'
    }
  },
  { day: '2026-10-15' }
];

/**
 * Builds {@link ScheduleDayItemValue}s from {@link SCHEDULE_DAY_ITEM_SEEDS},
 * giving each day an `anchor.onClick` that fires `onClick(key)`. The example
 * host uses this to wire button clicks into a `signal` for display.
 *
 * @param onClick - Invoked with the day's `key` when its button is clicked.
 * @returns Anchored values ready for the list state.
 */
export function makeScheduleDayItemValues(onClick: (key: string) => void): ScheduleDayItemValue[] {
  return SCHEDULE_DAY_ITEM_SEEDS.map((seed): ScheduleDayItemValue => {
    const date = parseISO(seed.day);

    return {
      key: seed.day,
      day: seed.day,
      dayLabel: format(date, 'EEE'),
      dateLabel: format(date, 'MMM d'),
      state: seed.session ? 'booked' : 'open',
      session: seed.session,
      anchor: { onClick: () => onClick(seed.day) }
    };
  });
}

/**
 * Counts the calendar days strictly between two schedule days.
 *
 * @param previousDay - The earlier day.
 * @param nextDay - The later day.
 * @returns The number of skipped days; `0` when `nextDay` is the day after `previousDay` (or out of order).
 */
export function skippedDaysBetweenScheduleDays(previousDay: ISO8601DayString, nextDay: ISO8601DayString): number {
  return Math.max(0, differenceInCalendarDays(parseISO(nextDay), parseISO(previousDay)) - 1);
}
