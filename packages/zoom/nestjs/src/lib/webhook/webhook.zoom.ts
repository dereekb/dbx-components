import { HandlerBindAccessor, HandlerMappedSetFunction, Handler, handlerFactory, handlerConfigurerFactory, handlerMappedSetFunctionFactory } from '@dereekb/util';
import { ZoomMeeting, ZoomWebhookTimestamp } from '@dereekb/zoom';

/**
 * Creates a ZoomWebhookEvent and treats the data as the input type.
 *
 * @param event
 * @returns
 */
export function zoomWebhookEvent<T>(event: RawZoomWebhookEvent): ZoomWebhookEvent<T> {
  return {
    event: event.event,
    event_ts: event.event_ts,
    payload: event.payload as unknown as T
  };
}

// MARK: Handler
export type ZoomEventHandler = Handler<RawZoomWebhookEvent, ZoomWebhookEventType>;
export const zoomEventHandlerFactory = handlerFactory<RawZoomWebhookEvent>((x) => x.event);

export type ZoomHandlerMappedSetFunction<T> = HandlerMappedSetFunction<ZoomWebhookEvent<T>>;

export interface ZoomEventHandlerConfigurer extends HandlerBindAccessor<RawZoomWebhookEvent, ZoomWebhookEventType> {
  // Meetings
}

export const zoomEventHandlerConfigurerFactory = handlerConfigurerFactory<ZoomEventHandlerConfigurer, RawZoomWebhookEvent>({
  configurerForAccessor: (accessor: HandlerBindAccessor<RawZoomWebhookEvent>) => {
    // eslint-disable-next-line
    const fnWithKey = handlerMappedSetFunctionFactory<ZoomWebhookEvent<any>, any>(accessor, zoomWebhookEvent);

    const configurer: ZoomEventHandlerConfigurer = {
      ...accessor,
      // Meetings
      handleMeetingStarted: fnWithKey(ZoomWebhookEventType.MEETING_STARTED)
    };

    return configurer;
  }
});
