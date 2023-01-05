import { UnixDateTimeNumber, Maybe, ModelKey, ModelKeyTypeNamePair } from '@dereekb/util';

/**
 * Context in which a model was viewed.
 */
export type ModelViewContext = string;

export interface DbxModelViewTrackerEvent {
  /**
   * Event time
   */
  d?: UnixDateTimeNumber;
  /**
   * Context
   */
  c?: ModelViewContext;
  /**
   * Model info
   */
  m: ModelKeyTypeNamePair;
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
