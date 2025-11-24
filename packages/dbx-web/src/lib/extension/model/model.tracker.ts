import { type Maybe, type ModelKey, type ModelKeyTypeNamePair, UnixDateTimeSecondsNumber } from '@dereekb/util';

/**
 * String context in which a model was viewed.
 */
export type ModelViewContext = string;

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

export function allDbxModelViewTrackerEventSetModelKeys(eventSet: DbxModelViewTrackerEventSet): ModelKey[] {
  return allDbxModelViewTrackerEventModelKeys(eventSet.e);
}

export function allDbxModelViewTrackerEventModelKeys(events: DbxModelViewTrackerEvent[]): ModelKey[] {
  return events.map((y) => y.m.key);
}
