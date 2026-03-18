import { Module } from '@nestjs/common';
import { SegmentServiceModule } from '@dereekb/analytics/nestjs';
import { FirebaseServerAnalyticsServiceListener } from '../analytics.service.listener';
import { FirebaseServerAnalyticsSegmentListenerService } from './segment.listener.service';

/**
 * A pre-configured dependency module that can be imported into the {@link appAnalyticsModuleMetadata} call.
 *
 * This module provides the {@link FirebaseServerAnalyticsSegmentListenerService} as the {@link FirebaseServerAnalyticsServiceListener} implementation and exports {@link SegmentServiceModule} for use in the app.
 */
@Module({
  imports: [SegmentServiceModule],
  providers: [
    FirebaseServerAnalyticsSegmentListenerService,
    {
      provide: FirebaseServerAnalyticsServiceListener,
      useExisting: FirebaseServerAnalyticsSegmentListenerService
    }
  ],
  exports: [SegmentServiceModule, FirebaseServerAnalyticsServiceListener]
})
export class FirebaseServerAnalyticsSegmentModule {}
