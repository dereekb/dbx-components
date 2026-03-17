import { type CalcomContext } from './calcom.config';
import { CALCOM_API_VERSION_ME, calcomApiVersionHeaders } from '../shared/calcom.api-version';

export interface CalcomUser {
  readonly id: number;
  readonly email: string;
  readonly username: string | null;
  readonly timeZone: string;
  readonly weekStart: string;
  readonly createdDate: string;
  readonly timeFormat: number;
  readonly defaultScheduleId: number | null;
}

export interface CalcomGetMeResponse {
  readonly status: string;
  readonly data: CalcomUser;
}

export function getMe(context: CalcomContext): () => Promise<CalcomGetMeResponse> {
  return () => context.fetchJson('/me', { method: 'GET', headers: calcomApiVersionHeaders(CALCOM_API_VERSION_ME) });
}
