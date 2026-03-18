import { Module } from '@nestjs/common';
import { ON_CALL_MODEL_ANALYTICS_SERVICE } from '@dereekb/firebase-server';
import { DemoAnalyticsHandler } from './demo.analytics.handler';

@Module({
  providers: [
    DemoAnalyticsHandler,
    {
      provide: ON_CALL_MODEL_ANALYTICS_SERVICE,
      useExisting: DemoAnalyticsHandler
    }
  ],
  exports: [ON_CALL_MODEL_ANALYTICS_SERVICE]
})
export class DemoAnalyticsModule {}
