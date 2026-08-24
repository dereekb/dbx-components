import { type Days, type Maybe, type Milliseconds, type Minutes, MS_IN_DAY } from '@dereekb/util';
import { type CalendarType } from './calendar.id';

/**
 * @module calendar.type
 *
 * The {@link CalendarType} registry: the per-type retention policy and ICS emission config an app declares
 * once and the publish pipeline reads on every sweep.
 *
 * The type and the factory live here, in the model folder rather than in `firebase-server`, so a client-side
 * ICS preview or the future dbx-calendar adapter reads the SAME expansion window the server publishes with.
 * Only the service INSTANCE is constructed server-side, as a NestJS provider — the same split
 * {@link AppNotificationTemplateTypeInfoRecordService} uses.
 */

/**
 * How a {@link Calendar}'s recurring events are represented in its published ICS.
 *
 * - `rrule` emits one VEVENT per series carrying an RRULE, which is compact and lets a subscriber handle
 *   recurrence natively.
 * - `expand` emits one VEVENT per occurrence within the expansion window, which is what
 *   `@dereekb/date`'s iCalendar layer documents as its preferred authoring path: a published feed gets no
 *   chance to correct a client's misinterpretation of a rule before the next poll, 12-24 hours later.
 */
export type CalendarIcsRecurrenceMode = 'rrule' | 'expand';

/**
 * Retention and ICS-emission configuration for a single {@link CalendarType}.
 *
 * Retention is what keeps the embedded-event design inside Firestore's 1 MiB document ceiling without any
 * manual gardening: every sweep prunes before it publishes.
 */
export interface CalendarTypeConfig {
  /**
   * The type this configuration applies to.
   */
  readonly calendarType: CalendarType;
  /**
   * Human-readable name of the type, for tooling and logs.
   */
  readonly name?: Maybe<string>;
  // MARK: retention
  /**
   * How many days of already-ended one-off events to keep. Defaults to {@link DEFAULT_CALENDAR_RETAIN_PAST_EVENT_DAYS}.
   */
  readonly retainPastEventDays?: Maybe<Days>;
  /**
   * Maximum number of stored events, counting one-off and recurring events together.
   * Defaults to {@link DEFAULT_CALENDAR_MAX_EVENTS}.
   */
  readonly maxEvents?: Maybe<number>;
  /**
   * Whether an ended recurrence is eligible for pruning at all. Defaults to true.
   *
   * A forever recurrence is never pruned regardless of this value.
   */
  readonly pruneEndedRecurrences?: Maybe<boolean>;
  /**
   * How many days of already-ended recurrences to keep. Defaults to the resolved {@link retainPastEventDays}.
   */
  readonly retainEndedRecurrenceDays?: Maybe<Days>;
  // MARK: ics
  /**
   * How recurring events are emitted. Defaults to {@link DEFAULT_CALENDAR_ICS_RECURRENCE_MODE}.
   */
  readonly icsRecurrenceMode?: Maybe<CalendarIcsRecurrenceMode>;
  /**
   * How far back the ICS expansion window reaches, used only in `expand` mode.
   * Defaults to {@link DEFAULT_CALENDAR_ICS_EXPANSION_PAST_DAYS}.
   */
  readonly icsExpansionPastDays?: Maybe<Days>;
  /**
   * How far forward the ICS expansion window reaches, used only in `expand` mode.
   * Defaults to {@link DEFAULT_CALENDAR_ICS_EXPANSION_FUTURE_DAYS}.
   */
  readonly icsExpansionFutureDays?: Maybe<Days>;
  /**
   * Emitted as REFRESH-INTERVAL / X-PUBLISHED-TTL.
   *
   * ADVISORY ONLY: Google re-fetches a subscribed feed every ~12-24 hours regardless.
   */
  readonly refreshInterval?: Maybe<Minutes>;
  /**
   * How long a Calendar of this type may go without a successful publish before the backstop sweep re-flags
   * it. Defaults to {@link DEFAULT_CALENDAR_RESYNC_INTERVAL}.
   *
   * This is also what keeps an `expand`-mode calendar from sliding off the end of its expansion window.
   */
  readonly resyncInterval?: Maybe<Milliseconds>;
}

/**
 * Default for {@link CalendarTypeConfig.retainPastEventDays}.
 */
export const DEFAULT_CALENDAR_RETAIN_PAST_EVENT_DAYS: Days = 90;

/**
 * Default for {@link CalendarTypeConfig.maxEvents}.
 *
 * At roughly 300 stored bytes per item this leaves about 6x headroom under Firestore's 1 MiB ceiling.
 */
export const DEFAULT_CALENDAR_MAX_EVENTS = 500;

/**
 * Default for {@link CalendarTypeConfig.icsRecurrenceMode}.
 */
export const DEFAULT_CALENDAR_ICS_RECURRENCE_MODE: CalendarIcsRecurrenceMode = 'rrule';

/**
 * Default for {@link CalendarTypeConfig.icsExpansionPastDays}.
 */
export const DEFAULT_CALENDAR_ICS_EXPANSION_PAST_DAYS: Days = 90;

/**
 * Default for {@link CalendarTypeConfig.icsExpansionFutureDays}.
 */
export const DEFAULT_CALENDAR_ICS_EXPANSION_FUTURE_DAYS: Days = 400;

/**
 * Default for {@link CalendarTypeConfig.resyncInterval}: seven days.
 */
export const DEFAULT_CALENDAR_RESYNC_INTERVAL: Milliseconds = 7 * MS_IN_DAY;

/**
 * The {@link CalendarType} of {@link DEFAULT_CALENDAR_TYPE_CONFIG}, used for a type the app never registered.
 */
export const UNKNOWN_CALENDAR_TYPE: CalendarType = 'unknown';

/**
 * The configuration applied to a Calendar whose type the app did not register.
 *
 * An unregistered type falls back rather than throwing on purpose: a scheduled sweep over every calendar in
 * the app must not be taken down by one badly-typed document.
 */
export const DEFAULT_CALENDAR_TYPE_CONFIG: CalendarTypeConfig = {
  calendarType: UNKNOWN_CALENDAR_TYPE
};

/**
 * Record of {@link CalendarTypeConfig} keyed by {@link CalendarType}.
 */
export type CalendarTypeConfigRecord = Record<CalendarType, CalendarTypeConfig>;

/**
 * Creates a {@link CalendarTypeConfigRecord} from an array of configs.
 *
 * @param configs - The configs to index.
 * @returns A record keyed by calendar type.
 * @throws {Error} When two configs declare the same {@link CalendarType}.
 *
 * @example
 * ```ts
 * const record = calendarTypeConfigRecord([{ calendarType: 'demo_profile', maxEvents: 100 }]);
 * ```
 */
export function calendarTypeConfigRecord(configs: CalendarTypeConfig[]): CalendarTypeConfigRecord {
  const record: CalendarTypeConfigRecord = {};

  configs.forEach((x) => {
    const { calendarType } = x;

    if (record[calendarType]) {
      throw new Error(`calendarTypeConfigRecord(): duplicate CalendarType in record: ${calendarType}`);
    }

    record[calendarType] = x;
  });

  return record;
}

/**
 * Runtime service for resolving a {@link CalendarTypeConfig} from a {@link CalendarType}.
 *
 * Built from a {@link CalendarTypeConfigRecord} via {@link appCalendarTypeConfigService}.
 */
export abstract class AppCalendarTypeConfigService {
  /**
   * All registered configs for this app.
   */
  abstract readonly appCalendarTypeConfigRecord: CalendarTypeConfigRecord;

  /**
   * Returns the config for the given type, falling back to the service's default when it is not registered.
   *
   * @param calendarType - The type to look up.
   */
  abstract configForCalendarType(calendarType: CalendarType): CalendarTypeConfig;

  /**
   * Returns every registered {@link CalendarType}.
   *
   * This is what the backstop sweep iterates, since each type carries its own resync interval.
   */
  abstract getAllKnownCalendarTypes(): CalendarType[];

  /**
   * Returns every registered {@link CalendarTypeConfig}.
   */
  abstract getAllKnownCalendarTypeConfigs(): CalendarTypeConfig[];
}

/**
 * Reference to an {@link AppCalendarTypeConfigService} instance, for dependency injection.
 */
export interface AppCalendarTypeConfigServiceRef {
  readonly appCalendarTypeConfigService: AppCalendarTypeConfigService;
}

/**
 * Creates an {@link AppCalendarTypeConfigService} from the given record.
 *
 * @param appCalendarTypeConfigRecord - The complete calendar type registry for the application.
 * @param defaultConfig - Config used for an unregistered type. Defaults to {@link DEFAULT_CALENDAR_TYPE_CONFIG}.
 * @returns The service.
 *
 * @example
 * ```ts
 * const service = appCalendarTypeConfigService(calendarTypeConfigRecord(DEMO_CALENDAR_TYPE_CONFIGS));
 * const config = service.configForCalendarType('demo_profile');
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function appCalendarTypeConfigService(appCalendarTypeConfigRecord: CalendarTypeConfigRecord, defaultConfig: CalendarTypeConfig = DEFAULT_CALENDAR_TYPE_CONFIG): AppCalendarTypeConfigService {
  const allKnownCalendarTypes = Object.keys(appCalendarTypeConfigRecord);
  const allKnownCalendarTypeConfigs = allKnownCalendarTypes.map((x) => appCalendarTypeConfigRecord[x]);

  return {
    appCalendarTypeConfigRecord,
    configForCalendarType(calendarType: CalendarType) {
      return appCalendarTypeConfigRecord[calendarType] ?? defaultConfig;
    },
    getAllKnownCalendarTypes() {
      return [...allKnownCalendarTypes];
    },
    getAllKnownCalendarTypeConfigs() {
      return [...allKnownCalendarTypeConfigs];
    }
  };
}
