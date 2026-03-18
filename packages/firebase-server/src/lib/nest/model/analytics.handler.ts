import { type InjectionToken } from '@nestjs/common';
import { type AuthData } from '../../type';

/**
 * Event emitted by the dispatch chain to the analytics service.
 */
export interface OnCallModelAnalyticsEvent {
  readonly event: string;
  readonly lifecycle: 'triggered' | 'success' | 'error' | 'complete';
  readonly call: string;
  readonly modelType: string;
  readonly specifier?: string;
  readonly uid?: string;
  readonly auth?: AuthData;
  readonly request?: any;
  readonly properties?: Record<string, any>;
  readonly error?: unknown;
}

/**
 * Abstract analytics service that apps implement to process analytics events.
 *
 * Analogous to {@link DbxAnalyticsService} on the frontend.
 * Apps extend this class and provide it via {@link ON_CALL_MODEL_ANALYTICS_SERVICE}.
 */
export abstract class OnCallModelAnalyticsService {
  abstract handleAnalyticsEvent(event: OnCallModelAnalyticsEvent): void;
}

/**
 * Default injection token for the analytics service.
 * Apps provide this in their NestJS module to enable analytics in the onCall dispatch chain.
 */
export const ON_CALL_MODEL_ANALYTICS_SERVICE = 'ON_CALL_MODEL_ANALYTICS_SERVICE' as InjectionToken<OnCallModelAnalyticsService>;

/**
 * @deprecated Use {@link OnCallModelAnalyticsService} instead.
 */
export type OnCallModelAnalyticsHandler = OnCallModelAnalyticsService;

/**
 * @deprecated Use {@link ON_CALL_MODEL_ANALYTICS_SERVICE} instead.
 */
export const ON_CALL_MODEL_ANALYTICS_HANDLER = ON_CALL_MODEL_ANALYTICS_SERVICE;
