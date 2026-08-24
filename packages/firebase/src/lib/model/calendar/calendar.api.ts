import { type, type Type } from 'arktype';
import { clearable } from '@dereekb/model';
import { type Maybe } from '@dereekb/util';
import { type TargetModelParams } from '../../common';
import { targetModelParamsType } from '../../common/model/model/model.param';
import { type CalendarType } from './calendar.id';

/**
 * @module calendar.api
 *
 * ARKTYPE PARAM/RESULT TYPES ONLY.
 *
 * There is deliberately no CRUD config map and no `CalendarFunctions` class here: the Calendar is driven
 * INTERNALLY, so nothing is registered in an app's callable function map. This file exists only because
 * `firebaseServerActionTransformFunctionFactory` needs an arktype per action, and the only actions are the
 * three publish-side sweeps.
 *
 * Event mutation is not an action at all — a caller already holds a transaction and an accessor when it
 * decides to touch a calendar, so it merges the `calendar.util.ts` templates into its own write instead.
 */

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
