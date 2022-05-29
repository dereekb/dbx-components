import { DEFAULT_WEBHOOK_MIDDLEWARE_ROUTE_INFO } from '@dereekb/nestjs';
import { Logger, MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { FirebaseRawBodyMiddleware } from './rawbody.middleware';

/**
 * Convenience class that mirrors the ConfigureWebhookMiddlewareModule class in @dereekb/nestjs, but for Firebase apps.
 *
 * Requests to /webhook/* have their request.body value set to the rawBody.
 */
@Module({})
export class ConfigureFirebaseWebhookMiddlewareModule {
  private readonly logger = new Logger('ConfigureFirebaseWebhookMiddlewareModule');

  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(FirebaseRawBodyMiddleware).forRoutes(DEFAULT_WEBHOOK_MIDDLEWARE_ROUTE_INFO);
    this.logger.debug('Configured firebase webhook routes with proper middleware.');
  }
}
