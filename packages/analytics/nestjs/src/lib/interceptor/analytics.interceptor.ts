import { type Maybe } from '@dereekb/util';
import { type AnalyticsEventName } from '@dereekb/analytics';
import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor, SetMetadata, Inject } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';
import { type EventEmitter2 } from '@nestjs/event-emitter';
import { type Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export const ANALYTICS_INTERCEPTOR_METADATA_KEY = 'analyticsevent';

/**
 * Function that extracts analytics event data from a handler result.
 *
 * @param result - The handler's return value.
 * @param context - The NestJS execution context for the current request.
 * @returns An object of event data to attach to the analytics event, or nothing if no data should be emitted.
 */
export type AnalyticsEventDataFunction<T> = (result: T, context: ExecutionContext) => Maybe<object>;

/**
 * Configuration for the {@link EmitAnalyticsEvent} decorator.
 */
export interface AnalyticsEventInterceptorConfig<T> {
  /**
   * The analytics event name to emit.
   */
  readonly name: AnalyticsEventName;
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
 *
 * @param config - The analytics event configuration specifying the event name and optional data extractor.
 * @returns A method decorator that attaches analytics metadata.
 *
 * @example
 * ```ts
 * @EmitAnalyticsEvent({ name: 'User Registered', fn: (result) => ({ userId: result.id }) })
 * @Post('register')
 * async register(@Body() body: RegisterDto) {
 *   return this.authService.register(body);
 * }
 * ```
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
    @Inject(Reflector) readonly reflector: Reflector,
    @Inject(EventEmitter2) readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Intercepts the request pipeline, emitting an analytics event after the handler completes
   * if the method is decorated with {@link EmitAnalyticsEvent}.
   *
   * @param context - The NestJS execution context.
   * @param next - The next handler in the pipeline.
   * @returns An observable that emits the handler result after triggering the analytics event.
   */
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
