import { Inject, type MiddlewareConsumer, Module, Logger, Optional } from '@nestjs/common';
import { OAuthBearerTokenMiddleware } from './oauth-auth.middleware';
import { type SlashPath } from '@dereekb/util';

// MARK: Config
/**
 * Configuration for `OAuthBearerTokenMiddleware` route protection.
 *
 * Works in reverse of `FirebaseAppCheckMiddlewareConfig`: instead of protecting
 * all routes and ignoring some, this only protects explicitly specified paths.
 * Routes under the global API prefix (protected by AppCheck) are excluded.
 *
 * @example
 * ```ts
 * // Provide in your module:
 * { provide: OAuthAuthMiddlewareConfig, useValue: { protectedPaths: ['/mcp'] } }
 * ```
 */
export abstract class OAuthAuthMiddlewareConfig {
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
 * to paths specified in `OAuthAuthMiddlewareConfig`.
 *
 * Only protects explicitly listed paths — all other routes pass through.
 * This is the inverse of `ConfigureFirebaseAppCheckMiddlewareModule`, which
 * protects everything and ignores specific paths.
 *
 * @example
 * ```ts
 * @Module({
 *   imports: [ConfigureOAuthAuthMiddlewareModule],
 *   providers: [
 *     { provide: OAuthAuthMiddlewareConfig, useValue: { protectedPaths: ['/mcp'] } }
 *   ]
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class ConfigureOAuthAuthMiddlewareModule {
  private readonly logger = new Logger('ConfigureOAuthAuthMiddlewareModule');

  constructor(@Optional() @Inject(OAuthAuthMiddlewareConfig) private readonly config?: OAuthAuthMiddlewareConfig) {}

  configure(consumer: MiddlewareConsumer): void {
    const protectedPaths = this.config?.protectedPaths ?? [];

    if (protectedPaths.length > 0) {
      const routes = protectedPaths.map((path) => `${path}/*path`);
      consumer.apply(OAuthBearerTokenMiddleware).forRoutes(...routes);
      this.logger.debug(`Configured OAuth bearer token middleware for routes: ${protectedPaths.join(', ')}`);
    }
  }
}
