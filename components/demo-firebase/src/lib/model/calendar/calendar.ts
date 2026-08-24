import { type Calendar, type CalendarId, type CalendarType, type CalendarTypeConfig, calendarIdForModel, type FirebaseAuthUserId, type FirestoreQueryConstraint, firestoreModelKey, where, whereDateIsBefore } from '@dereekb/firebase';
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
 * Params for {@link demoCalendarsDueForResyncQuery}.
 */
export interface DemoCalendarsDueForResyncQueryParams {
  readonly calendarType: CalendarType;
  readonly before: Date;
}

/**
 * Query for the Calendars of a type whose last successful publish predates the given instant.
 *
 * The `@dbxModelFirebaseIndex` tag has to live HERE rather than upstream: the index generator runs with
 * `--component components/demo-firebase`, and this package's scan config only includes `src/lib/**`.
 *
 * @param params - The type to sweep and the staleness cutoff.
 * @returns Firestore query constraints for Calendars due for a resync.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Calendar
 * @dbxModelFirebaseIndexScope COLLECTION
 * @dbxModelFirebaseIndexCategory maintenance
 */
export function demoCalendarsDueForResyncQuery(params: DemoCalendarsDueForResyncQueryParams): FirestoreQueryConstraint[] {
  // spelled out rather than delegating to calendarsDueForResyncQuery(): the index generator reads the
  // constraint calls out of THIS body, and cannot follow a call into an upstream package it does not scan
  return [where<Calendar>('t', '==', params.calendarType), whereDateIsBefore<Calendar>('sat', params.before)];
}

/**
 * Convenience alias naming the demo's Calendar model shape.
 */
export type DemoCalendar = Calendar;
