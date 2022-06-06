import { Logger, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { RouteInfo } from '@nestjs/common/interfaces';
import { JsonBodyMiddleware } from './json.middleware';
import { RawBodyMiddleware } from './rawbody.middleware';

export const DEFAULT_BASE_WEBHOOK_PATH = '/webhook';

export const DEFAULT_WEBHOOK_MIDDLEWARE_ROUTE_INFO: RouteInfo = {
  path: `${DEFAULT_BASE_WEBHOOK_PATH}/*`,
  method: RequestMethod.POST
};

/**
 * Convenience class that configures a nestjs module (typically the root app module) to apply the proper middleware for handling webhooks.
 */
export abstract class AppModuleWithWebhooksEnabled implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumeWebhooksWithRawBodyMiddleware(consumer);
  }
}

/**
 * Convenience class that extends AppWithWebhooksEnabled.
 */
@Module({})
export class ConfigureWebhookMiddlewareModule extends AppModuleWithWebhooksEnabled {
  private readonly logger = new Logger('ConfigureWebhookMiddlewareModule');

  public override configure(consumer: MiddlewareConsumer): void {
    super.configure(consumer);
    this.logger.debug('Configured webhook routes with proper middleware.');
  }
}

/**
 * Configures a MiddlewareConsumer to use RawBodyMiddleware for all POST requests to /webhook/*. All other routes are consumed with the JsonBodyMiddleware.
 *
 * This is required for various webhooks that require the full body to properly parse content.
 *
 * Be sure to also set bodyParsing: false in the nest app options.
 *
 * @param consumer
 */
export function consumeWebhooksWithRawBodyMiddleware(consumer: MiddlewareConsumer) {
  // Configure the app to not parse the body for our webhook routes.
  // https://stackoverflow.com/questions/54346465/access-raw-body-of-stripe-webhook-in-nest-js
  consumer.apply(RawBodyMiddleware).forRoutes(DEFAULT_WEBHOOK_MIDDLEWARE_ROUTE_INFO).apply(JsonBodyMiddleware).forRoutes('*');
}
