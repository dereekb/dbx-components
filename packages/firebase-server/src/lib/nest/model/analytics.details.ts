/**
 * Analytics lifecycle configuration for a single onCall model handler.
 * Mirrors the frontend DbxActionAnalyticsConfig pattern.
 */
export interface OnCallModelFunctionAnalyticsDetails<I = any, O = any> {
  /**
   * Analytics event name (e.g., 'Guestbook Created').
   */
  readonly event: string;
  /**
   * Called before handler executes. Return properties to include in the event.
   */
  readonly onTriggered?: OnCallAnalyticsLifecycleFn<I, void>;
  /**
   * Called after successful handler completion. Return properties to include in the event.
   */
  readonly onSuccess?: OnCallAnalyticsLifecycleFn<I, O>;
  /**
   * Called when handler throws. Return properties to include in the event.
   */
  readonly onError?: OnCallAnalyticsErrorFn<I>;
  /**
   * Called always after handler completes (success or error). Return properties to include in the event.
   */
  readonly onComplete?: OnCallAnalyticsCompleteFn<I, O>;
}

/**
 * Context available to all analytics lifecycle functions.
 */
export interface OnCallAnalyticsContext<I = any> {
  readonly call: string;
  readonly modelType: string;
  readonly specifier?: string;
  readonly uid?: string;
  readonly data?: I;
}

/**
 * Lifecycle function for onTriggered/onSuccess.
 */
export type OnCallAnalyticsLifecycleFn<I, O> = (context: OnCallAnalyticsContext<I>, result?: O) => Record<string, any> | undefined;

/**
 * Lifecycle function for onError.
 */
export type OnCallAnalyticsErrorFn<I> = (context: OnCallAnalyticsContext<I>, error: unknown) => Record<string, any> | undefined;

/**
 * Lifecycle function for onComplete.
 */
export type OnCallAnalyticsCompleteFn<I, O> = (context: OnCallAnalyticsContext<I>, result?: O, error?: unknown) => Record<string, any> | undefined;

/**
 * Ref interface for functions carrying _analyticsDetails.
 */
export interface OnCallModelFunctionAnalyticsDetailsRef {
  readonly _analyticsDetails?: OnCallModelFunctionAnalyticsDetails;
}

/**
 * Reads _analyticsDetails from a function if present.
 */
export function readAnalyticsDetails(fn: any): OnCallModelFunctionAnalyticsDetails | undefined {
  return fn?._analyticsDetails;
}
