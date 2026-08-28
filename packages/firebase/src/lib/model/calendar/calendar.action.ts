import { type AsyncFirebaseFunctionCreateAction, type AsyncFirebaseFunctionDeleteAction, type AsyncFirebaseFunctionUpdateAction, type FirebaseFunctionCreateAction, type FirebaseFunctionDeleteAction, type FirebaseFunctionUpdateAction } from '../../common';
import { type CalendarDocument } from './calendar';

/**
 * @module calendar.action
 *
 * Type aliases for Calendar server action functions, following the same pattern as the StorageFile and
 * Notification actions. See `@dereekb/firebase-server/model` for the implementations.
 *
 * @template P - the parameter type for the action
 */

/**
 * Synchronous create action targeting a {@link CalendarDocument}.
 */
export type CalendarCreateAction<P extends object> = FirebaseFunctionCreateAction<P, CalendarDocument>;

/**
 * Async create action targeting a {@link CalendarDocument}.
 */
export type AsyncCalendarCreateAction<P extends object> = AsyncFirebaseFunctionCreateAction<P, CalendarDocument>;

/**
 * Synchronous update action targeting a {@link CalendarDocument}.
 */
export type CalendarUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, CalendarDocument>;

/**
 * Async update action targeting a {@link CalendarDocument}.
 */
export type AsyncCalendarUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, CalendarDocument>;

/**
 * Synchronous delete action targeting a {@link CalendarDocument}.
 */
export type CalendarDeleteAction<P extends object> = FirebaseFunctionDeleteAction<P, CalendarDocument>;

/**
 * Async delete action targeting a {@link CalendarDocument}.
 */
export type AsyncCalendarDeleteAction<P extends object> = AsyncFirebaseFunctionDeleteAction<P, CalendarDocument>;
