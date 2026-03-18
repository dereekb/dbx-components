import { type Maybe } from '@dereekb/util';
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
   *
   * In log-only mode, events are logged to the console instead of being sent to Segment.
   *
   * @param userId - the user to associate with the event
   * @param event - the track event containing event name, properties, and optional context
   *
   * @throws {Error} When userId is falsy.
   *
   * @example
   * ```ts
   * segmentService.track('uid_123', {
   *   event: 'Item Purchased',
   *   properties: { itemId: 'sku_abc', price: 29.99 }
   * });
   * ```
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
   * Tracks an event only if userId is provided. No-op if userId is nullish.
   *
   * Convenience wrapper around {@link track} for cases where the user may not be authenticated.
   *
   * @param userId - the user to associate with the event, or nullish to skip
   * @param event - the track event containing event name, properties, and optional context
   */
  tryTrack(userId: Maybe<string>, event: SegmentTrackEvent): void {
    if (userId) {
      this.track(userId, event);
    }
  }

  /**
   * Identifies a user with optional traits, syncing user properties to Segment.
   *
   * In log-only mode, the identify call is logged to the console instead of being sent.
   *
   * @param params - the identify parameters including userId and optional traits
   *
   * @example
   * ```ts
   * segmentService.identify({
   *   userId: 'uid_123',
   *   traits: { plan: 'premium', role: 'admin' }
   * });
   * ```
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
    let result: SegmentEventContext | undefined;

    if (appContext) {
      result = { app: appContext };
    }

    return result;
  }
}
