/**
 * @module system.scheduler
 *
 * Declares the framework-owned `scheduler` {@link SystemState} type, plus the two pure predicates
 * that make up the "has this schedule already run in this hour?" gate.
 *
 * The gate exists so a cron that fires every hour can run a body that should only run every Nth
 * hour, without each individual task having to carry a throttle of its own. Evaluate it ONCE at the
 * top of a schedule function: pass, run the work; fail, return.
 *
 * The stateful half — read, evaluate, and claim the hour against Firestore — lives in
 * `@dereekb/firebase-server/model` as `schedulerSystemStateAccessorFactory()`. Only the shape and
 * the predicates live here, so the predicates can be exercised without an emulator and the
 * converter can be registered from an app's client-shared converter map.
 */

import { roundDownToHour } from '@dereekb/date';
import { type Hours, type Maybe } from '@dereekb/util';
import { type FirestoreDocument, type FirestoreDocumentAccessor, firestoreSubObject, optionalFirestoreDate } from '../../common';
import { type SystemState, type SystemStateDocument, type SystemStateStoredData, type SystemStateStoredDataFieldConverterConfig } from './system';

/**
 * {@link SystemState} type identifier for the scheduler's run-gate state.
 *
 * Also the document id, per the SystemState singleton convention — so this state lives at
 * `sys/scheduler`.
 */
export const SCHEDULER_SYSTEM_STATE_TYPE = 'scheduler';

/**
 * Scheduler state for gating scheduled work to at most one run per hour window.
 *
 * ONE gate, ONE `lat`. This is deliberately not per-task and not per-table state: it answers
 * "has the scheduler already run its Nth-hour body during this hour?" for the app as a whole. Two
 * callers sharing the document with different `everyNHours` values will have whichever one passes
 * first claim the hour for both.
 *
 * @dbxModelSubObject
 */
export interface SchedulerSystemData extends SystemStateStoredData {
  /**
   * Last run at. The single gate anchor — the moment the most recent passing check claimed its hour.
   *
   * @dbxModelVariable lastRunAt
   */
  lat?: Maybe<Date>;
}

/**
 * Firestore field converter for {@link SchedulerSystemData}.
 *
 * Register it in the app's `SystemStateStoredDataConverterMap` under
 * {@link SCHEDULER_SYSTEM_STATE_TYPE}. This is NOT optional: without it the collection falls back to
 * the pass-through converter, `lat` reads back as a raw Firestore `Timestamp` instead of a `Date`,
 * and {@link hasRunInCurrentHour} can never match — so the gate would open on every single call.
 */
export const schedulerSystemDataConverter: SystemStateStoredDataFieldConverterConfig<SchedulerSystemData> = firestoreSubObject<SchedulerSystemData>({
  objectField: {
    fields: {
      lat: optionalFirestoreDate()
    }
  }
});

/**
 * Loads the {@link SystemStateDocument} that stores {@link SchedulerSystemData}, using
 * {@link SCHEDULER_SYSTEM_STATE_TYPE} as the document id.
 *
 * @param accessor - The document accessor for the SystemState collection.
 * @returns The SystemState document for the scheduler state.
 *
 * @example
 * ```ts
 * const doc = loadSchedulerSystemState(systemStateCollection.documentAccessor());
 * const data = await doc.snapshotData();
 * ```
 */
export function loadSchedulerSystemState<D extends FirestoreDocument<SystemState<SystemStateStoredData>>>(accessor: FirestoreDocumentAccessor<SystemState<SystemStateStoredData>, D>): SystemStateDocument<SchedulerSystemData> {
  return accessor.loadDocumentForId(SCHEDULER_SYSTEM_STATE_TYPE) as unknown as SystemStateDocument<SchedulerSystemData>;
}

// MARK: Gate Predicates
/**
 * Whether the date's hour-of-day is an Nth hour, in the ambient timezone.
 *
 * This is a modulo against the hour-of-day, NOT an interval since some epoch — so at hour 12 it is
 * true for N = 1, 2, 3, 4, 6, and 12, and false for N = 5. Only divisors of 24 divide the day
 * evenly; a non-divisor (5, 7, 9, …) will still fire, just with a short window across midnight.
 *
 * An `everyNHours` of zero or less has no meaningful Nth hour and returns false rather than
 * dividing by zero.
 *
 * @param everyNHours - Run every Nth hour of the day.
 * @param date - Moment to test; defaults to now.
 * @returns True when the date's hour-of-day is an Nth hour.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags schedule, hour, throttle, cron, gate, modulo
 * @dbxUtilRelated has-run-in-current-hour
 *
 * @example
 * ```ts
 * isNthHourOfDay(3, new Date('2024-01-01T12:30:00')); // true (12 % 3 === 0)
 * isNthHourOfDay(5, new Date('2024-01-01T12:30:00')); // false (12 % 5 === 2)
 * ```
 */
export function isNthHourOfDay(everyNHours: Hours, date?: Maybe<Date>): boolean {
  return everyNHours > 0 && (date ?? new Date()).getHours() % everyNHours === 0;
}

/**
 * Whether the last run falls inside the same hour as now.
 *
 * This is a same-hour-bucket compare, not an elapsed-time compare: a run at 12:59 and a `now` of
 * 13:01 are two minutes apart but in different hours, so this returns false. That is what makes the
 * gate track the hourly cron rather than drift with it.
 *
 * A null `lastRunAt` means nothing has run, so it returns false.
 *
 * @param lastRunAt - Moment the work last ran.
 * @param now - Moment to compare against; defaults to now.
 * @returns True when both moments fall in the same hour.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags schedule, hour, throttle, cron, gate, window
 * @dbxUtilRelated is-nth-hour-of-day, round-down-to-hour
 *
 * @example
 * ```ts
 * hasRunInCurrentHour(new Date('2024-01-01T12:05:00'), new Date('2024-01-01T12:55:00')); // true
 * hasRunInCurrentHour(new Date('2024-01-01T12:59:00'), new Date('2024-01-01T13:01:00')); // false
 * ```
 */
export function hasRunInCurrentHour(lastRunAt: Maybe<Date>, now?: Maybe<Date>): boolean {
  return lastRunAt != null && roundDownToHour(lastRunAt).getTime() === roundDownToHour(now ?? new Date()).getTime();
}
