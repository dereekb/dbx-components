import { type InjectionToken } from '@nestjs/common';

/**
 * Event emitted by the dispatch chain to the analytics handler.
 */
export interface OnCallModelAnalyticsEvent {
  readonly event: string;
  readonly lifecycle: 'triggered' | 'success' | 'error' | 'complete';
  readonly call: string;
  readonly modelType: string;
  readonly specifier?: string;
  readonly uid?: string;
  readonly properties?: Record<string, any>;
  readonly error?: unknown;
}

/**
 * Abstract handler that apps implement to process analytics events.
 */
export abstract class OnCallModelAnalyticsHandler {
  abstract handleAnalyticsEvent(event: OnCallModelAnalyticsEvent): void;
}

/**
 * Default injection token for the analytics handler.
 * Apps provide this in their NestJS module to enable analytics in the onCall dispatch chain.
 */
export const ON_CALL_MODEL_ANALYTICS_HANDLER = 'ON_CALL_MODEL_ANALYTICS_HANDLER' as InjectionToken<OnCallModelAnalyticsHandler>;
