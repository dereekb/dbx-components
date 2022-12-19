import { UnixDateTimeNumber, ModelKeyTypePair, Maybe, ModelKey } from '@dereekb/util';

export interface DbxModelViewTrackerEvent {
  d?: UnixDateTimeNumber;
  m: ModelKeyTypePair;
  folder?: Maybe<string>;
}

export interface DbxModelViewTrackerEventSet {
  /**
   * The latest date/time number.
   */
  l: UnixDateTimeNumber;
  /**
   * List of events.
   */
  e: DbxModelViewTrackerEvent[];
}

export function allDbxModelViewTrackerEventSetModelKeys(eventSet: DbxModelViewTrackerEventSet): ModelKey[] {
  return allDbxModelViewTrackerEventModelKeys(eventSet.e);
}

export function allDbxModelViewTrackerEventModelKeys(events: DbxModelViewTrackerEvent[]): ModelKey[] {
  return events.map((y) => y.m.key);
}
