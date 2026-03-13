import { Inject, Logger, type MiddlewareConsumer, Module, Optional } from '@nestjs/common';
import { FirebaseAppCheckMiddleware, FirebaseAppCheckMiddlewareConfig } from './appcheck.middleware';
import { GlobalRoutePrefixConfig } from './globalprefix';
import { DEFAULT_BASE_WEBHOOK_PATH } from '@dereekb/nestjs';
import { type SlashPath } from '@dereekb/util';

/**
 * Middleware module that configures `FirebaseAppCheckMiddleware` route coverage
 * based on `FirebaseAppCheckMiddlewareConfig` and `GlobalRoutePrefixConfig`.
 *
 * Uses `.forRoutes()` and `.exclude()` to control which paths require AppCheck,
 * so the middleware itself only needs to handle the per-request `skipAppCheck` flag.
 */
@Module({})
export class ConfigureFirebaseAppCheckMiddlewareModule {
  private readonly logger = new Logger('ConfigureFirebaseAppCheckMiddlewareModule');

  constructor(
    @Optional() @Inject(GlobalRoutePrefixConfig) private readonly globalRoutePrefixConfig?: GlobalRoutePrefixConfig,
    @Optional() @Inject(FirebaseAppCheckMiddlewareConfig) private readonly config?: FirebaseAppCheckMiddlewareConfig
  ) {}

  public configure(consumer: MiddlewareConsumer): void {
    const globalPrefix = this.globalRoutePrefixConfig?.globalApiRoutePrefix;
    const protectNonGlobalPaths = this.config?.protectNonGlobalPaths === true;
    const protectGlobalWebhooksPath = this.config?.protectGlobalWebhooksPath === true;

    // build route patterns to protect
    const forRoutes: string[] = [];

    // global prefix routes are always protected
    if (protectNonGlobalPaths || !globalPrefix) {
      forRoutes.push('{*path}');
    } else {
      forRoutes.push(`${globalPrefix}/{*path}`);
    }

    // add additional protected paths
    const protectedPaths = this.config?.protectedPaths ?? [];

    if (globalPrefix && protectedPaths.includes(globalPrefix as SlashPath)) {
      throw new Error(`FirebaseAppCheckMiddlewareConfig: protectedPaths must not contain the global route prefix "${globalPrefix}" since it is always protected.`);
    }

    for (const path of protectedPaths) {
      forRoutes.push(`${path}/{*path}`);
    }

    // build exclusion patterns
    const excludePatterns: string[] = [];

    if (!protectGlobalWebhooksPath) {
      const webhookPath = globalPrefix ? `${globalPrefix}${DEFAULT_BASE_WEBHOOK_PATH}` : DEFAULT_BASE_WEBHOOK_PATH;
      excludePatterns.push(`${webhookPath}/{*path}`);
    }

    // apply middleware
    let builder = consumer.apply(FirebaseAppCheckMiddleware);

    if (excludePatterns.length > 0) {
      builder = builder.exclude(...excludePatterns);
    }

    builder.forRoutes(...forRoutes);
    this.logger.debug(`Configured AppCheck middleware for routes: ${forRoutes.join(', ')}${excludePatterns.length > 0 ? ` (excluding: ${excludePatterns.join(', ')})` : ''}`);
  }
}
