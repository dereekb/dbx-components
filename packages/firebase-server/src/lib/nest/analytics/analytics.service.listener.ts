import { type OnCallModelAnalyticsEvent } from '../model/analytics.handler';

/**
 * Listener for {@link FirebaseServerAnalyticsService}.
 * Events are forwarded from FirebaseServerAnalyticsService to this listener
 * for processing by an analytics provider (e.g., Segment).
 */
export abstract class FirebaseServerAnalyticsServiceListener {
  abstract handleOnCallAnalyticsEvent(event: OnCallModelAnalyticsEvent): void;
}
