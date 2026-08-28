import { type Calendar, type CalendarId, type CalendarType, type CalendarTypeConfig, calendarIdForModel, type FirebaseAuthUserId, firestoreModelKey } from '@dereekb/firebase';
import { MS_IN_DAY } from '@dereekb/util';
import { profileIdentity } from '../profile';

/**
 * The {@link CalendarType} of the calendar attached to a demo Profile.
 */
export const DEMO_PROFILE_CALENDAR_TYPE: CalendarType = 'demo_profile';

/**
 * Every {@link CalendarTypeConfig} the demo app registers.
 *
 * Kept small on purpose: retention is what keeps the embedded-event design inside Firestore's 1 MiB
 * ceiling, and short windows make the retention behaviour observable in the emulator scenario specs.
 */
export const DEMO_CALENDAR_TYPE_CONFIGS: CalendarTypeConfig[] = [
  {
    calendarType: DEMO_PROFILE_CALENDAR_TYPE,
    name: 'Profile Calendar',
    retainPastEventDays: 30,
    maxEvents: 100,
    refreshInterval: 60,
    resyncInterval: MS_IN_DAY
  }
];

/**
 * The {@link CalendarId} of a user's profile calendar.
 *
 * The Calendar's document id IS the two-way flat key of the profile it belongs to, so "pr/abc123" owns
 * "cal/pr_abc123" — loadable directly with no query and no lookup field.
 *
 * @param userId - The Firebase Auth user id.
 * @returns The calendar id.
 */
export function demoProfileCalendarId(userId: FirebaseAuthUserId): CalendarId {
  return calendarIdForModel(firestoreModelKey(profileIdentity, userId));
}

/**
 * Convenience alias naming the demo's Calendar model shape.
 */
export type DemoCalendar = Calendar;
