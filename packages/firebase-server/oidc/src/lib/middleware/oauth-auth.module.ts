import { type MiddlewareConsumer, Module, Logger } from '@nestjs/common';
import { OAuthBearerTokenMiddleware } from './oauth-auth.middleware';

/**
 * Configuration for the OAuth auth middleware module.
 */
export interface ConfigureOAuthAuthMiddlewareModuleConfig {
  /**
   * Route patterns to apply the middleware to.
   * Defaults to applying to all routes ('*').
   */
  readonly routes?: string[];
}

/**
 * Configurable middleware module that applies OAuth bearer token verification
 * to specified routes.
 *
 * Follows the same pattern as `ConfigureFirebaseAppCheckMiddlewareModule`.
 *
 * Usage:
 * ```ts
 * @Module({
 *   imports: [OAuthModule.forRoot(config), ConfigureOAuthAuthMiddlewareModule]
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class ConfigureOAuthAuthMiddlewareModule {
  private readonly logger = new Logger('ConfigureOAuthAuthMiddlewareModule');

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(OAuthBearerTokenMiddleware).forRoutes('mcp/*path');
    this.logger.debug('Configured OAuth bearer token middleware for mcp routes.');
  }
}
