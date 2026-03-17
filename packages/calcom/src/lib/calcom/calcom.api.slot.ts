import { type Maybe } from '@dereekb/util';
import { makeUrlSearchParams } from '@dereekb/util/fetch';
import { type CalcomContext, type CalcomPublicContext } from './calcom.config';
import { CALCOM_API_VERSION_SLOTS, calcomApiVersionHeaders } from '../shared/calcom.api-version';

export interface CalcomGetAvailableSlotsInput {
  readonly startTime: string;
  readonly endTime: string;
  readonly eventTypeId?: Maybe<number>;
  readonly eventTypeSlug?: Maybe<string>;
  readonly username?: Maybe<string>;
  readonly timeZone?: Maybe<string>;
  readonly duration?: Maybe<number>;
  readonly format?: Maybe<string>;
}

export interface CalcomSlot {
  readonly time: string;
}

export interface CalcomGetAvailableSlotsResponse {
  readonly status: string;
  readonly data: {
    readonly slots: Record<string, CalcomSlot[]>;
  };
}

export function getAvailableSlots(context: CalcomContext | CalcomPublicContext): (input: CalcomGetAvailableSlotsInput) => Promise<CalcomGetAvailableSlotsResponse> {
  return (input) => {
    const params = makeUrlSearchParams(input);
    return context.fetchJson(`/slots?${params}`, { method: 'GET', headers: calcomApiVersionHeaders(CALCOM_API_VERSION_SLOTS) });
  };
}
