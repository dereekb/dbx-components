import { isPromiseLike, type PromiseOrValue } from '@dereekb/util';
import { type OnCallModelFunctionAnalyticsDetails, type OnCallAnalyticsContext } from './analytics.details';
import { type OnCallModelAnalyticsHandler, type OnCallModelAnalyticsEvent } from './analytics.handler';

/**
 * Wraps a handler call with analytics lifecycle emission.
 * Handles both sync and async results. Fire-and-forget — never blocks response.
 */
export function wrapWithAnalytics<O>(handler: OnCallModelAnalyticsHandler, details: OnCallModelFunctionAnalyticsDetails, context: OnCallAnalyticsContext, execute: () => PromiseOrValue<O>): PromiseOrValue<O> {
  // 1. onTriggered (pre-call)
  _emitLifecycle(handler, details, 'triggered', context, details.onTriggered?.(context));

  try {
    const result = execute();

    if (isPromiseLike(result)) {
      return (result as Promise<O>).then(
        (resolved) => {
          _emitLifecycle(handler, details, 'success', context, details.onSuccess?.(context, resolved));
          _emitLifecycle(handler, details, 'complete', context, details.onComplete?.(context, resolved));
          return resolved;
        },
        (error) => {
          _emitLifecycle(handler, details, 'error', context, details.onError?.(context, error), error);
          _emitLifecycle(handler, details, 'complete', context, details.onComplete?.(context, undefined, error), error);
          throw error;
        }
      );
    } else {
      // Sync success
      _emitLifecycle(handler, details, 'success', context, details.onSuccess?.(context, result));
      _emitLifecycle(handler, details, 'complete', context, details.onComplete?.(context, result));
      return result;
    }
  } catch (error) {
    // Sync error
    _emitLifecycle(handler, details, 'error', context, details.onError?.(context, error), error);
    _emitLifecycle(handler, details, 'complete', context, details.onComplete?.(context, undefined, error), error);
    throw error;
  }
}

function _emitLifecycle(handler: OnCallModelAnalyticsHandler, details: OnCallModelFunctionAnalyticsDetails, lifecycle: OnCallModelAnalyticsEvent['lifecycle'], context: OnCallAnalyticsContext, properties?: Record<string, any>, error?: unknown): void {
  try {
    handler.handleAnalyticsEvent({
      event: details.event,
      lifecycle,
      ...context,
      properties,
      error
    });
  } catch {
    // Fire-and-forget: never let analytics break the request
  }
}
