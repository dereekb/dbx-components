import { type ISO8601DateString } from '@dereekb/util';
import { type DateRangeType } from '../date';

/**
 * Serializable request counterpart to {@link FindDateParam}, using ISO 8601
 * strings so it can be sent over the wire.
 */
export interface FindDateParamRequest {
  before?: ISO8601DateString;
  after?: ISO8601DateString;
}

/**
 * Serializable request counterpart to {@link DateItemOccuringFilter}, using
 * an ISO 8601 string for the target instant.
 */
export interface DateItemOccuringFilterRequest {
  occuringAt?: ISO8601DateString;
}

/**
 * Serializable request for filtering by starts/ends boundaries, extending
 * {@link DateItemOccuringFilterRequest} with ISO 8601 string bounds.
 */
export interface DateItemQueryStartsEndsFilterRequest extends DateItemOccuringFilterRequest {
  startsBefore?: ISO8601DateString;
  startsAfter?: ISO8601DateString;
  endsBefore?: ISO8601DateString;
  endsAfter?: ISO8601DateString;
}

/**
 * Serializable request combining starts/ends boundaries with a date range
 * filter, including range type, distance, containment flag, and timezone.
 */
export interface DateItemQueryStartsEndsWithRangeFilterRequest extends DateItemQueryStartsEndsFilterRequest {
  rangeType?: DateRangeType;
  rangeDate?: ISO8601DateString;
  rangeDistance?: number;
  rangeContained?: boolean;
  timezone?: string;
}
