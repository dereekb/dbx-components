import { UnixDateTimeNumber, ModelKeyTypePair, Maybe } from '@dereekb/util';

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
