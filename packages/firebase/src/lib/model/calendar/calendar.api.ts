import { type, type Type } from 'arktype';
import { clearable } from '@dereekb/model';
import { type Maybe } from '@dereekb/util';
import { type TargetModelParams } from '../../common';
import { targetModelParamsType } from '../../common/model/model/model.param';
import { callModelFirebaseFunctionMapFactory, type FirebaseFunctionTypeConfigMap, type ModelFirebaseCrudFunction, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap } from '../../client';
import { type CalendarTypes } from './calendar';
import { type CalendarType } from './calendar.id';

/**
 * @module calendar.api
 *
 * The Calendar exposes exactly ONE callable — `calendar/update/rotateIcs`. A published .ics url is a
 * permanent zero-auth bearer credential, and rotating it is the only revocation such a url has, so it has to
 * be reachable by the owner who minted it rather than buried in an admin tool.
 *
 * Event mutation is deliberately NOT part of that surface — a caller already holds a transaction and an
 * accessor when it decides to touch a calendar, so it merges the `calendar.util.ts` templates into its own
 * write instead.
 *
 * The publish-side sweeps (`syncCalendar`, `syncAllFlaggedCalendars`, `flagStaleCalendarsForSync`) stay
 * internal to the scheduled processor. Their arktypes live here only because
 * `firebaseServerActionTransformFunctionFactory` needs one per action.
 */

// MARK: Params
/**
 * Parameters for syncing a single Calendar: pruning it and queueing its ICS for regeneration.
 */
export interface SyncCalendarParams extends TargetModelParams {}

export const syncCalendarParamsType = targetModelParamsType as Type<SyncCalendarParams>;

/**
 * Result of syncing a single Calendar.
 */
export interface SyncCalendarResult {
  /**
   * True if a new ICS StorageFile was created, false if the existing one was re-flagged.
   */
  readonly createdIcsStorageFile: boolean;
  readonly prunedEventCount: number;
  readonly prunedRecurringEventCount: number;
}

/**
 * Parameters for rotating a Calendar's published ICS link.
 */
export interface RotateCalendarIcsParams extends TargetModelParams {}

export const rotateCalendarIcsParamsType = targetModelParamsType as Type<RotateCalendarIcsParams>;

/**
 * Result of rotating a Calendar's published ICS link.
 */
export interface RotateCalendarIcsResult {
  /**
   * True if an existing ICS StorageFile was flagged for delete, revoking the url that named it.
   *
   * False when the calendar had never published one, in which case the rotation is a no-op that still
   * queues a first publish.
   */
  readonly revokedIcsStorageFile: boolean;
  /**
   * True if the immediate re-sync minted the replacement ICS StorageFile.
   */
  readonly createdIcsStorageFile: boolean;
  /**
   * True if the expedited publish finished, meaning the replacement url is already live in `Calendar.iu`.
   *
   * False means only that the publish did not complete INLINE — the replacement is still queued and the
   * regular sweep will publish it. Rotation itself has already succeeded either way, so a caller treats this
   * as "is the new link ready to show yet", never as a failure.
   */
  readonly publishedIcs: boolean;
}

/**
 * Parameters for sweeping every Calendar flagged for sync.
 */
export interface SyncAllFlaggedCalendarsParams {}

export const syncAllFlaggedCalendarsParamsType = /* @__PURE__ */ type({}) as Type<SyncAllFlaggedCalendarsParams>;

/**
 * Result of the flagged-calendar sweep.
 */
export interface SyncAllFlaggedCalendarsResult {
  readonly calendarsVisited: number;
  readonly calendarsSyncedCount: number;
  readonly calendarsFailedCount: number;
}

/**
 * Parameters for the backstop sweep that re-flags Calendars whose published ICS has gone stale.
 */
export interface FlagStaleCalendarsForSyncParams {
  /**
   * Restricts the sweep to a single type. All registered types are swept when absent.
   */
  readonly calendarType?: Maybe<CalendarType>;
}

export const flagStaleCalendarsForSyncParamsType = /* @__PURE__ */ type({
  'calendarType?': clearable('string')
}) as Type<FlagStaleCalendarsForSyncParams>;

/**
 * Result of the backstop sweep.
 */
export interface FlagStaleCalendarsForSyncResult {
  readonly calendarsVisited: number;
  readonly calendarsFlaggedCount: number;
}

// MARK: Keys
// MARK: Functions
/**
 * Custom (non-CRUD) function type map for Calendar. Empty — the only callable is a CRUD update.
 */
export type CalendarFunctionTypeMap = {};

export const calendarFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<CalendarFunctionTypeMap> = {};

/**
 * CRUD function configuration map for the Calendar model.
 *
 * Intentionally minimal. See the module docblock for why rotation is the only operation here.
 */
export type CalendarModelCrudFunctionsConfig = {
  readonly calendar: {
    update: {
      /**
       * Rotates the calendar's public ICS link, revoking the previous one.
       *
       * Flags the current ICS StorageFile for delete and clears the calendar's pointer + url, then re-syncs
       * so a fresh StorageFile — and therefore a fresh url — is minted. Existing subscribers to the old url
       * break by design; that is the revocation.
       */
      rotateIcs: [RotateCalendarIcsParams, RotateCalendarIcsResult];
    };
  };
};

export const calendarModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<CalendarModelCrudFunctionsConfig, CalendarTypes> = {
  calendar: ['update:rotateIcs']
};

/**
 * Client-side callable function map factory for the Calendar's CRUD operations.
 *
 * @example
 * ```ts
 * const functions = calendarFunctionMap(callableFactory);
 * const result = await functions.calendar.updateCalendar.rotateIcs({ key: 'cal/pr_abc123' });
 * ```
 */
export const calendarFunctionMap = callModelFirebaseFunctionMapFactory(calendarFunctionTypeConfigMap, calendarModelCrudFunctionsConfig);

/**
 * Abstract class defining the callable Calendar cloud functions.
 *
 * Register it in an app's functions config map to make it injectable. Use {@link calendarFunctionMap} to
 * create the client-side callable map.
 */
export abstract class CalendarFunctions implements ModelFirebaseFunctionMap<CalendarFunctionTypeMap, CalendarModelCrudFunctionsConfig> {
  abstract calendar: {
    updateCalendar: {
      rotateIcs: ModelFirebaseCrudFunction<RotateCalendarIcsParams, RotateCalendarIcsResult>;
    };
  };
}
