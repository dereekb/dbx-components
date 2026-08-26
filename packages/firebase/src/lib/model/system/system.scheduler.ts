/**
 * @module system.scheduler
 *
 * Declares the framework-owned `scheduler` {@link SystemState} type, plus the pure predicates and
 * the moment-bound read object that make up the "has this schedule already run in this hour?" gate.
 *
 * The gate exists so a cron that fires every hour can run a body that should only run every Nth
 * hour, without each individual task having to carry a throttle of its own. Evaluate it ONCE at the
 * top of a schedule function: pass, run the work; fail, return.
 *
 * The stateful half — read, evaluate, and claim the hour against Firestore — lives in
 * `@dereekb/firebase-server/model` as `schedulerSystemStateAccessorFactory()`. Only the shape, the
 * predicates, and {@link schedulerSystemStateRead} live here, so the evaluation can be exercised
 * without an emulator and the converter can be registered from an app's client-shared converter
 * map.
 */

import { roundDownToHour } from '@dereekb/date';
import { type HourOfDay, type Hours, type Maybe } from '@dereekb/util';
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

/**
 * The zero-based index of the date's hour within the day's every-N-hours schedule, or null when the
 * hour is not an Nth hour.
 *
 * At hour 12 with N=3 the day's matching hours are 0, 3, 6, 9, 12 — so the index is 4. Use it to
 * rotate work across a day's windows ("do the expensive pass only on index 0") without each caller
 * re-deriving the arithmetic from the hour-of-day.
 *
 * Returns null rather than a number for a non-matching hour, so a falsy check cannot confuse
 * "index 0" — the first window of the day — with "no window".
 *
 * @param everyNHours - Run every Nth hour of the day.
 * @param date - Moment to test; defaults to now.
 * @returns The zero-based window index, or null when the hour is not an Nth hour.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags schedule, hour, throttle, cron, gate, index, window
 * @dbxUtilRelated is-nth-hour-of-day
 *
 * @example
 * ```ts
 * nthHourOfDayIndex(3, new Date('2024-01-01T12:30:00')); // 4 (0, 3, 6, 9, 12)
 * nthHourOfDayIndex(3, new Date('2024-01-01T13:30:00')); // null (13 % 3 !== 0)
 * ```
 */
export function nthHourOfDayIndex(everyNHours: Hours, date?: Maybe<Date>): Maybe<number> {
  const dateToUse = date ?? new Date();
  return isNthHourOfDay(everyNHours, dateToUse) ? dateToUse.getHours() / everyNHours : null;
}

// MARK: Gate Read
/**
 * A read of the scheduler's gate state, evaluated against a single moment.
 *
 * Holds the `now` and the `lastRunAt` it was built from, so every question below is answered against
 * the same moment. Asking about N=2 and then N=3 cannot straddle an hour boundary mid-evaluation,
 * and no question re-reads the document.
 *
 * This is the pure half of the gate. The Firestore-backed half — read, evaluate, and CLAIM the hour
 * in a transaction — is `schedulerSystemStateAccessorFactory()` in `@dereekb/firebase-server/model`.
 */
export interface SchedulerSystemStateRead {
  /**
   * The moment this read was taken at.
   */
  readonly now: Date;
  /**
   * The hour-of-day of {@link SchedulerSystemStateRead.now}, in the ambient timezone.
   */
  readonly hourOfDay: HourOfDay;
  /**
   * The moment the most recent passing check claimed its hour, or null if the gate has never been
   * claimed.
   */
  readonly lastRunAt: Maybe<Date>;
  /**
   * Whether {@link SchedulerSystemStateRead.lastRunAt} falls inside the same hour as `now` — that is,
   * whether the gate has already been claimed during this hour.
   */
  readonly hasRunInCurrentHour: boolean;
  /**
   * Whether the gate is open for the given interval: `now` is an Nth hour of the day AND the gate
   * has not already been claimed during this hour.
   *
   * This is a pure evaluation — it does NOT claim the hour. Use
   * `SchedulerSystemStateAccessor.checkAndClaim()` to actually gate work.
   *
   * @param everyNHours - Run every Nth hour of the day.
   * @returns True when the gate is open.
   */
  isOpen(everyNHours: Hours): boolean;
  /**
   * {@link isNthHourOfDay} bound to this read's `now`.
   *
   * Unlike {@link SchedulerSystemStateRead.isOpen} this ignores `lastRunAt` entirely, which is what
   * makes it the right sub-gate for work running INSIDE an already-claimed hour: the hour is spent
   * either way, so each task only needs to ask whether this is its hour.
   *
   * @param everyNHours - Run every Nth hour of the day.
   * @returns True when this read's hour-of-day is an Nth hour.
   */
  isNthHourOfDay(everyNHours: Hours): boolean;
  /**
   * {@link nthHourOfDayIndex} bound to this read's `now`.
   *
   * @param everyNHours - Run every Nth hour of the day.
   * @returns The zero-based window index, or null when this read's hour is not an Nth hour.
   */
  nthHourOfDayIndex(everyNHours: Hours): Maybe<number>;
}

/**
 * Configuration for {@link schedulerSystemStateRead}.
 */
export interface SchedulerSystemStateReadConfig {
  /**
   * The moment to evaluate the gate against. Defaults to the current time.
   */
  readonly now?: Maybe<Date>;
  /**
   * The `lat` read off the scheduler document, or null/undefined when it has never been claimed.
   */
  readonly lastRunAt: Maybe<Date>;
}

/**
 * Creates a {@link SchedulerSystemStateRead} from a moment and a last-run.
 *
 * Every predicate on the result closes over the single `now` resolved here, so a caller can ask
 * about any number of intervals off one read without drifting across an hour boundary.
 *
 * @param config - The moment and the document's last-run.
 * @returns The evaluated read.
 *
 * @example
 * ```ts
 * const read = schedulerSystemStateRead({ now, lastRunAt });
 *
 * read.isOpen(3); // should the every-3-hours body run?
 * read.isNthHourOfDay(6); // is this also a 6th hour, for a sub-gated task?
 * ```
 */
export function schedulerSystemStateRead(config: SchedulerSystemStateReadConfig): SchedulerSystemStateRead {
  const { now: inputNow, lastRunAt: inputLastRunAt } = config;
  const now = inputNow ?? new Date();
  const lastRunAt = inputLastRunAt ?? null;
  const hasRun = hasRunInCurrentHour(lastRunAt, now);

  return {
    now,
    hourOfDay: now.getHours(),
    lastRunAt,
    hasRunInCurrentHour: hasRun,
    isOpen: (everyNHours: Hours) => isNthHourOfDay(everyNHours, now) && !hasRun,
    isNthHourOfDay: (everyNHours: Hours) => isNthHourOfDay(everyNHours, now),
    nthHourOfDayIndex: (everyNHours: Hours) => nthHourOfDayIndex(everyNHours, now)
  };
}
