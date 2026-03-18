import { type Configurable, type Maybe, type PromiseOrValue } from '@dereekb/util';
import { type OnCallModelFunctionAnalyticsDetails, type OnCallAnalyticsContext, type OnCallAnalyticsEmitter } from './analytics.details';
import { type OnCallModelAnalyticsService, type OnCallModelAnalyticsEvent } from './analytics.handler';

// MARK: Emitter Factory
/**
 * Configuration for {@link onCallAnalyticsEmitterInstance}.
 */
export interface OnCallAnalyticsEmitterInstanceConfig {
  readonly service: OnCallModelAnalyticsService;
  readonly context: OnCallAnalyticsContext;
}

/**
 * Factory instance that creates {@link OnCallAnalyticsEmitter} instances for a specific lifecycle stage.
 *
 * Pre-binds the analytics service and dispatch context so each lifecycle stage only needs
 * to provide the lifecycle discriminator.
 *
 * @example
 * ```typescript
 * const emitterFactory = onCallAnalyticsEmitterInstance({ service, context });
 * const triggeredEmitter = emitterFactory('triggered');
 * triggeredEmitter.sendEvent('Handler Starting');
 * ```
 */
export type OnCallAnalyticsEmitterInstance = (lifecycle: OnCallModelAnalyticsEvent['lifecycle']) => OnCallAnalyticsEmitter;

/**
 * Creates an {@link OnCallAnalyticsEmitterInstance} that produces {@link OnCallAnalyticsEmitter} instances
 * for each lifecycle stage, pre-bound to the given service and context.
 *
 * @example
 * ```typescript
 * const emitter = onCallAnalyticsEmitterInstance({ service, context });
 * emitter('triggered').sendEventType('Handler Starting');
 * emitter('success').sendEvent('Widget Created', { id: result.id });
 * ```
 */
export function onCallAnalyticsEmitterInstance(config: OnCallAnalyticsEmitterInstanceConfig): OnCallAnalyticsEmitterInstance {
  const { service, context } = config;

  return (lifecycle: OnCallModelAnalyticsEvent['lifecycle']): OnCallAnalyticsEmitter => {
    const emitter: OnCallAnalyticsEmitter = {
      service,
      context,
      lifecycle,
      sendEvent(event: string, properties?: Record<string, any>): void {
        service.handleAnalyticsEvent({
          event,
          lifecycle,
          call: context.call,
          modelType: context.modelType,
          specifier: context.specifier,
          uid: context.uid,
          auth: context.auth,
          request: context.request,
          properties
        });
      },
      sendEventType(event: string): void {
        emitter.sendEvent(event);
      }
    };

    return emitter;
  };
}

// MARK: Wrap
/**
 * Configuration for {@link callWithAnalytics}.
 */
export interface CallWithAnalyticsConfig<O> {
  readonly service: Maybe<OnCallModelAnalyticsService>;
  readonly details: Maybe<OnCallModelFunctionAnalyticsDetails>;
  readonly context: OnCallAnalyticsContext;
  readonly execute: () => PromiseOrValue<O>;
}

/**
 * Wraps a handler call with analytics lifecycle emission.
 * Always async — awaits the execute function. Fire-and-forget — never blocks response.
 *
 * Creates an {@link OnCallAnalyticsEmitter} per lifecycle stage and passes it to the
 * configured lifecycle callbacks along with the request.
 */
export async function callWithAnalytics<O>(config: CallWithAnalyticsConfig<O>): Promise<O> {
  const { service, details, context, execute } = config;
  let result: O;

  function _safeCall(fn: () => void): void {
    try {
      fn();
    } catch (error) {
      // only log the error, but don't throw
      console.error(`callWithAnalytics: Failed to emit analytics event:`, error);
    }
  }

  if (!service || !details) {
    result = await execute();
  } else {
    const emitter = onCallAnalyticsEmitterInstance({ service, context });
    _safeCall(() => details.onTriggered?.(emitter('triggered'), context.request));

    try {
      result = await execute();
      _safeCall(() => details.onSuccess?.(emitter('success'), context.request, result));
      _safeCall(() => details.onComplete?.(emitter('complete'), context.request, result));
    } catch (error) {
      _safeCall(() => details.onError?.(emitter('error'), context.request, error));
      _safeCall(() => details.onComplete?.(emitter('complete'), context.request, undefined, error));
      throw error;
    }
  }

  return result;
}
