import { type ISO8601DateString } from '@dereekb/util';
import { type DateRangeType } from '../date';

export interface FindDateParamRequest {
  before?: ISO8601DateString;
  after?: ISO8601DateString;
}

export interface DateItemOccuringFilterRequest {
  occuringAt?: ISO8601DateString;
}

export interface DateItemQueryStartsEndsFilterRequest extends DateItemOccuringFilterRequest {
  startsBefore?: ISO8601DateString;
  startsAfter?: ISO8601DateString;
  endsBefore?: ISO8601DateString;
  endsAfter?: ISO8601DateString;
}

export interface DateItemQueryStartsEndsWithRangeFilterRequest extends DateItemQueryStartsEndsFilterRequest {
  rangeType?: DateRangeType;
  rangeDate?: ISO8601DateString;
  rangeDistance?: number;
  rangeContained?: boolean;
  timezone?: string;
}
