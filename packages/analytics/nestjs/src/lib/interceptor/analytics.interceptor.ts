import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export const ANALYTICS_INTERCEPTOR_METADATA_KEY = 'analyticsevent';

/**
 * Function that extracts analytics event data from a handler result.
 */
export type AnalyticsEventDataFunction<T> = (result: T, context: ExecutionContext) => object | undefined;

/**
 * Configuration for the {@link EmitAnalyticsEvent} decorator.
 */
export interface AnalyticsEventInterceptorConfig<T> {
  /**
   * The analytics event name to emit.
   */
  readonly name: string;
  /**
   * Optional function to extract event data from the handler result.
   */
  readonly fn?: AnalyticsEventDataFunction<T>;
}

/**
 * Decorator that marks a controller method for analytics event emission.
 *
 * Used in conjunction with {@link AnalyticsEventInterceptor} to emit events
 * to NestJS EventEmitter2 after the handler completes.
 */
export const EmitAnalyticsEvent = <T>(config: AnalyticsEventInterceptorConfig<T>) => {
  if (!config.name) {
    throw new Error('Analytics event name was not set properly.');
  }

  return SetMetadata(ANALYTICS_INTERCEPTOR_METADATA_KEY, config);
};

/**
 * NestJS interceptor that emits analytics events via EventEmitter2
 * for controller methods decorated with {@link EmitAnalyticsEvent}.
 */
@Injectable()
export class AnalyticsEventInterceptor<T = any> implements NestInterceptor {
  constructor(
    readonly reflector: Reflector,
    readonly eventEmitter: EventEmitter2
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler();
    const config = this.reflector.get<AnalyticsEventInterceptorConfig<T>>(ANALYTICS_INTERCEPTOR_METADATA_KEY, handler);

    return next.handle().pipe(
      tap((result: T) => {
        const eventValues = config.fn ? config.fn(result, context) : undefined;

        if (eventValues != undefined) {
          this.eventEmitter.emit(config.name, eventValues);
        }
      })
    );
  }
}
