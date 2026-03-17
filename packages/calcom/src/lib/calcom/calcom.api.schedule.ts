import { type CalcomContext } from './calcom.config';
import { CALCOM_API_VERSION_SCHEDULES, calcomApiVersionHeaders } from '../shared/calcom.api-version';

export interface CalcomAvailabilityRule {
  readonly days: string[];
  readonly startTime: string;
  readonly endTime: string;
}

export interface CalcomSchedule {
  readonly id: number;
  readonly name: string;
  readonly timeZone: string;
  readonly availability: CalcomAvailabilityRule[];
  readonly isDefault: boolean;
  readonly overrides: Record<string, CalcomAvailabilityRule[]>;
}

export interface CalcomGetSchedulesResponse {
  readonly status: string;
  readonly data: CalcomSchedule[];
}

export function getSchedules(context: CalcomContext): () => Promise<CalcomGetSchedulesResponse> {
  return () => context.fetchJson('/schedules', { method: 'GET', headers: calcomApiVersionHeaders(CALCOM_API_VERSION_SCHEDULES) });
}
