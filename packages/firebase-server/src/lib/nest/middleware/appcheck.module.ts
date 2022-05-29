import { Logger, MiddlewareConsumer, Module } from '@nestjs/common';
import { FirebaseAppCheckMiddleware } from './appcheck.middleware';

/**
 * Convenience class that mirrors the ConfigureAppCheckMiddlewareModule class in @dereekb/nestjs, but for Firebase apps.
 */
@Module({})
export class ConfigureFirebaseAppCheckMiddlewareModule {
  private readonly logger = new Logger('ConfigureFirebaseAppCheckMiddlewareModule');

  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(FirebaseAppCheckMiddleware).forRoutes('*');
    this.logger.debug('Configured firebase webhook routes with proper middleware.');
  }
}
