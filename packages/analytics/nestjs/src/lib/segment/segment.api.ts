import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Analytics } from '@segment/analytics-node';
import { SegmentServiceConfig } from './segment.config';

/**
 * Injectable wrapper around the Segment Analytics Node SDK.
 *
 * Manages the Analytics client lifecycle, including flushing on module destroy.
 */
@Injectable()
export class SegmentApi implements OnModuleDestroy {
  readonly analytics: Analytics;

  constructor(@Inject(SegmentServiceConfig) public readonly config: SegmentServiceConfig) {
    this.analytics = new Analytics({ writeKey: this.config.writeKey });
  }

  get logOnly(): boolean {
    return this.config.logOnly;
  }

  async onModuleDestroy(): Promise<void> {
    await this.analytics.closeAndFlush();
  }
}
