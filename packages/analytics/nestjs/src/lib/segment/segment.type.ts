import { type TrackParams, type IdentifyParams, type UserTraits } from '@segment/analytics-node';
import { type SegmentServiceAppContext } from './segment.config';

/**
 * Segment event context derived from the SDK's TrackParams context,
 * with an explicit `app` field for better typing.
 */
export type SegmentEventContext = TrackParams['context'] & {
  readonly app?: SegmentServiceAppContext;
};

/**
 * Segment track event parameters derived from the SDK's TrackParams.
 *
 * Picks the commonly used fields without requiring userId/anonymousId
 * (since those are provided separately by the service).
 */
export type SegmentTrackEvent = Pick<TrackParams, 'event' | 'properties' | 'context' | 'timestamp'>;

/**
 * Segment identify parameters derived from the SDK's IdentifyParams.
 */
export type SegmentIdentifyParams = IdentifyParams;

/**
 * Segment identify traits derived from the SDK's UserTraits.
 *
 * Includes standard fields like email, name, plus arbitrary key-value pairs.
 */
export type SegmentIdentifyTraits = UserTraits;
