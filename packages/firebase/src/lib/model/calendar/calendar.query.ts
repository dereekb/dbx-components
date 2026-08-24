import { whereDateIsBefore } from '../../common/firestore/query/constraint.template';
import { type FirestoreQueryConstraint, where } from '../../common/firestore/query/constraint';
import { type Calendar } from './calendar';
import { type CalendarType } from './calendar.id';

/**
 * Returns query constraints for Calendars flagged for sync (`s == true`).
 *
 * This is what the hourly sweep iterates.
 *
 * @returns Firestore query constraints for Calendars flagged for sync.
 *
 * @example
 * ```ts
 * const constraints = calendarsFlaggedForSyncQuery();
 * ```
 */
export function calendarsFlaggedForSyncQuery(): FirestoreQueryConstraint[] {
  return [where<Calendar>('s', '==', true)];
}

/**
 * Input for {@link calendarsDueForResyncQuery}.
 */
export interface CalendarsDueForResyncQueryInput {
  /**
   * The type to sweep. Each type carries its own resync interval, so the backstop sweeps one type at a time.
   */
  readonly calendarType: CalendarType;
  /**
   * Calendars whose last successful publish predates this instant are due.
   */
  readonly before: Date;
}

/**
 * Returns query constraints for Calendars of a type whose last successful publish (`sat`) is older than the
 * given instant.
 *
 * This is the self-healing backstop: it catches a Calendar whose sweep cleared `s` but whose ICS never
 * finished publishing, and it keeps an `expand`-mode calendar from sliding off the end of its expansion
 * window without any extra field or mechanism.
 *
 * NOTE: a Firestore inequality skips documents where the field is absent, so a Calendar that has NEVER
 * published is not matched here. That case is already covered — it still carries `s == true` until its first
 * successful sweep, and the ICS StorageFile's own retry / stuck-detection owns everything after that.
 *
 * @param input - The type to sweep and the staleness cutoff.
 * @returns Firestore query constraints for Calendars due for a resync.
 *
 * @example
 * ```ts
 * const constraints = calendarsDueForResyncQuery({ calendarType: 'demo_profile', before: subDays(new Date(), 7) });
 * ```
 */
export function calendarsDueForResyncQuery(input: CalendarsDueForResyncQueryInput): FirestoreQueryConstraint[] {
  return [where<Calendar>('t', '==', input.calendarType), whereDateIsBefore<Calendar>('sat', input.before)];
}

/**
 * Returns query constraints for every Calendar of a given type.
 *
 * @param calendarType - The type to filter by.
 * @returns Firestore query constraints for Calendars of the given type.
 *
 * @example
 * ```ts
 * const constraints = calendarsForTypeQuery('demo_profile');
 * ```
 */
export function calendarsForTypeQuery(calendarType: CalendarType): FirestoreQueryConstraint[] {
  return [where<Calendar>('t', '==', calendarType)];
}
