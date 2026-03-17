import { Inject, Injectable, Logger } from '@nestjs/common';
import { SegmentApi } from './segment.api';
import { SegmentServiceConfig } from './segment.config';
import { type SegmentEventContext, type SegmentTrackEvent, type SegmentIdentifyParams } from './segment.type';

/**
 * High-level Segment analytics service.
 *
 * Handles track and identify calls, merging application context and
 * supporting log-only mode for development/testing.
 */
@Injectable()
export class SegmentService {
  private readonly logger = new Logger('SegmentService');

  constructor(
    @Inject(SegmentApi) public readonly segmentApi: SegmentApi,
    @Inject(SegmentServiceConfig) public readonly config: SegmentServiceConfig
  ) {}

  /**
   * Tracks an event for a user. Requires a userId.
   */
  track(userId: string, event: SegmentTrackEvent): void {
    if (!userId) {
      throw new Error('No userId was provided to track().');
    }

    if (!this.config.logOnly) {
      this.segmentApi.analytics.track({
        userId,
        event: event.event,
        properties: event.properties,
        timestamp: event.timestamp,
        context: {
          ...event.context,
          ...this._appContext()
        }
      });
    } else {
      this.logger.debug(`Segment (Log Only) - Track: ${userId} ${event.event}`);
    }
  }

  /**
   * Tracks an event only if userId is provided. No-op otherwise.
   */
  tryTrack(userId: string | undefined, event: SegmentTrackEvent): void {
    if (userId) {
      this.track(userId, event);
    }
  }

  /**
   * Identifies a user with optional traits.
   */
  identify(params: SegmentIdentifyParams): void {
    if (!this.config.logOnly) {
      this.segmentApi.analytics.identify({
        ...params,
        context: {
          ...params.context,
          ...this._appContext()
        }
      });
    } else {
      this.logger.debug(`Segment (Log Only) - Identify: ${params.userId}`);
    }
  }

  private _appContext(): SegmentEventContext | undefined {
    const appContext = this.config.appContext;

    if (appContext) {
      return { app: appContext };
    }

    return undefined;
  }
}
