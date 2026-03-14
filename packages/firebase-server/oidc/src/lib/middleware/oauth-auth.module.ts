import { Inject, type MiddlewareConsumer, Module, Logger, Optional } from '@nestjs/common';
import { OidcAuthBearerTokenMiddleware } from './oauth-auth.middleware';
import { type SlashPath } from '@dereekb/util';

// MARK: Config
/**
 * Configuration for `OidcAuthBearerTokenMiddleware` route protection.
 *
 * Works in reverse of `FirebaseAppCheckMiddlewareConfig`: instead of protecting
 * all routes and ignoring some, this only protects explicitly specified paths.
 * Routes under the global API prefix (protected by AppCheck) are excluded.
 *
 * @example
 * ```ts
 * // Provide in your module:
 * { provide: OidcAuthMiddlewareConfig, useValue: { protectedPaths: ['/mcp'] } }
 * ```
 */
export abstract class OidcAuthMiddlewareConfig {
  /**
   * Path prefixes that require OAuth bearer token verification.
   *
   * Only requests matching one of these prefixes will be checked.
   * Paths under the global API route prefix should not be included
   * since those are protected by AppCheck.
   */
  readonly protectedPaths!: SlashPath[];
}

// MARK: Module
/**
 * Middleware module that applies OAuth bearer token verification
 * to paths specified in `OidcAuthMiddlewareConfig`.
 *
 * Only protects explicitly listed paths — all other routes pass through.
 * This is the inverse of `ConfigureFirebaseAppCheckMiddlewareModule`, which
 * protects everything and ignores specific paths.
 *
 * @example
 * ```ts
 * @Module({
 *   imports: [ConfigureOidcAuthMiddlewareModule],
 *   providers: [
 *     { provide: OidcAuthMiddlewareConfig, useValue: { protectedPaths: ['/mcp'] } }
 *   ]
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class ConfigureOidcAuthMiddlewareModule {
  private readonly logger = new Logger('ConfigureOidcAuthMiddlewareModule');

  constructor(@Optional() @Inject(OidcAuthMiddlewareConfig) private readonly config?: OidcAuthMiddlewareConfig) {}

  configure(consumer: MiddlewareConsumer): void {
    const protectedPaths = this.config?.protectedPaths ?? [];

    if (protectedPaths.length > 0) {
      const routes = protectedPaths.map((path) => `${path}/*path`);
      consumer.apply(OidcAuthBearerTokenMiddleware).forRoutes(...routes);
      this.logger.debug(`Configured OAuth bearer token middleware for routes: ${protectedPaths.join(', ')}`);
    }
  }
}
