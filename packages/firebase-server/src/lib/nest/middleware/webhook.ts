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
    consumer.apply(FirebaseRawBodyMiddleware).forRoutes({
      path: '/webhook/*',
      method: RequestMethod.POST
    });

    this.logger.debug('Configured firebase webhook routes with proper middleware.');
  }
}
