import { Injectable, Optional, Inject } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { type Maybe } from '@dereekb/util';
import { type OnCallModelAnalyticsService, ON_CALL_MODEL_ANALYTICS_SERVICE, noopOnCallModelAnalyticsService } from './analytics.handler';

/**
 * Globally-registered resolver for the optional {@link OnCallModelAnalyticsService}.
 *
 * Calling `app.get()` directly for an optional provider through the NestFactory proxy is unsafe:
 * the proxy wraps every method call in `ExceptionsZone`, which invokes `process.exit(1)` when
 * the provider is missing — **before** any surrounding `try/catch` can intercept the error.
 *
 * This resolver sidesteps the issue by using `@Optional() @Inject()` at construction time,
 * which NestJS handles gracefully (injecting `undefined` when the token is absent).
 * When no service is registered, a no-op fallback from {@link noopOnCallModelAnalyticsService}
 * is used instead.
 *
 * For custom analytics tokens, it falls back to `ModuleRef.get()` which is not proxied
 * and throws a normal catchable exception.
 *
 * Register this provider globally via {@link buildNestServerRootModule} so that
 * `app.get(OnCallModelAnalyticsResolver)` always succeeds through the proxy.
 *
 * @example
 * ```typescript
 * // Inside onCallModel dispatch:
 * const resolver = app.get(OnCallModelAnalyticsResolver);
 * const analytics = resolver.getAnalyticsService();
 * ```
 */
@Injectable()
export class OnCallModelAnalyticsResolver {
  private readonly _service: OnCallModelAnalyticsService;

  constructor(
    private readonly moduleRef: ModuleRef,
    @Optional() @Inject(ON_CALL_MODEL_ANALYTICS_SERVICE) service?: OnCallModelAnalyticsService
  ) {
    this._service = service ?? noopOnCallModelAnalyticsService();
  }

  /**
   * Returns the analytics service for the given token, or the default
   * {@link ON_CALL_MODEL_ANALYTICS_SERVICE} if no custom token is specified.
   *
   * @param token - Optional custom injection token override. When omitted or equal to
   *   {@link ON_CALL_MODEL_ANALYTICS_SERVICE}, returns the constructor-injected service.
   * @returns The resolved analytics service.
   */
  getAnalyticsService(token?: Maybe<string>): OnCallModelAnalyticsService {
    const result = token != null && token !== ON_CALL_MODEL_ANALYTICS_SERVICE ? this.moduleRef.get(token, { strict: false }) : this._service;
    return result;
  }
}
