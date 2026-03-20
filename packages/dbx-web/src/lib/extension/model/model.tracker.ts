import { type Maybe, type ModelKey, type ModelKeyTypeNamePair, type UnixDateTimeSecondsNumber } from '@dereekb/util';

/**
 * String identifier for the context in which a model was viewed (e.g., "list", "detail").
 */
export type ModelViewContext = string;

/**
 * Represents a single model view event, recording when and in what context a specific model was viewed.
 */
export interface DbxModelViewTrackerEvent {
  /**
   * Event time
   */
  readonly d?: UnixDateTimeSecondsNumber;
  /**
   * Context
   */
  readonly c?: Maybe<ModelViewContext>;
  /**
   * Model info
   */
  readonly m: ModelKeyTypeNamePair;
  readonly folder?: Maybe<string>;
}

/**
 * A set of model view tracker events with a timestamp of the latest event, used for storage and retrieval.
 */
export interface DbxModelViewTrackerEventSet {
  /**
   * The latest date/time number.
   */
  readonly l: UnixDateTimeSecondsNumber;
  /**
   * List of events.
   */
  readonly e: DbxModelViewTrackerEvent[];
}

/**
 * Extracts all model keys from a {@link DbxModelViewTrackerEventSet}.
 *
 * @example
 * ```typescript
 * const keys = allDbxModelViewTrackerEventSetModelKeys(eventSet);
 * ```
 *
 * @param eventSet - The event set from which to extract model keys
 * @returns Array of model keys from all events in the set
 */
export function allDbxModelViewTrackerEventSetModelKeys(eventSet: DbxModelViewTrackerEventSet): ModelKey[] {
  return allDbxModelViewTrackerEventModelKeys(eventSet.e);
}

/**
 * Extracts all model keys from an array of {@link DbxModelViewTrackerEvent}.
 *
 * @example
 * ```typescript
 * const keys = allDbxModelViewTrackerEventModelKeys(events);
 * ```
 *
 * @param events - Array of view tracker events from which to extract model keys
 * @returns Array of model keys, one per event
 */
export function allDbxModelViewTrackerEventModelKeys(events: DbxModelViewTrackerEvent[]): ModelKey[] {
  return events.map((y) => y.m.key);
}
