import { HandlerBindAccessor, HandlerMappedSetFunction, Handler, handlerFactory, handlerConfigurerFactory, handlerMappedSetFunctionFactory } from '@dereekb/util';
import { ZoomWebhookEventType } from './webhook.zoom.type';
import { ZoomWebhookEvent, UntypedZoomWebhookEvent } from './webhook.zoom.type.common';
import {
  ZOOM_WEBHOOK_MEETING_CREATED_EVENT_TYPE,
  ZOOM_WEBHOOK_MEETING_DELETED_EVENT_TYPE,
  ZOOM_WEBHOOK_MEETING_ENDED_EVENT_TYPE,
  ZOOM_WEBHOOK_MEETING_PERMANENTLY_DELETED_EVENT_TYPE,
  ZOOM_WEBHOOK_MEETING_STARTED_EVENT_TYPE,
  ZOOM_WEBHOOK_MEETING_UPDATED_EVENT_TYPE,
  ZoomWebhookMeetingCreatedEventPayload,
  ZoomWebhookMeetingDeletedEventPayload,
  ZoomWebhookMeetingEndedEventPayload,
  ZoomWebhookMeetingPermanentlyDeletedEventPayload,
  ZoomWebhookMeetingStartedEventPayload,
  ZoomWebhookMeetingUpdatedEventPayload
} from './webhook.zoom.type.meeting';

/**
 * Creates a ZoomWebhookEvent and treats the data as the input type.
 *
 * @param event
 * @returns
 */
export function zoomWebhookEvent<T>(event: UntypedZoomWebhookEvent): ZoomWebhookEvent<T> {
  return {
    event: event.event,
    event_ts: event.event_ts,
    payload: event.payload as unknown as T
  };
}

// MARK: Handler
export type ZoomEventHandler = Handler<UntypedZoomWebhookEvent, ZoomWebhookEventType>;
export const zoomEventHandlerFactory = handlerFactory<UntypedZoomWebhookEvent>((x) => x.event);

export type ZoomHandlerMappedSetFunction<T> = HandlerMappedSetFunction<ZoomWebhookEvent<T>>;

export interface ZoomEventHandlerConfigurer extends HandlerBindAccessor<UntypedZoomWebhookEvent, ZoomWebhookEventType> {
  // Meetings
  handleMeetingCreated: ZoomHandlerMappedSetFunction<ZoomWebhookMeetingCreatedEventPayload>;
  handleMeetingUpdated: ZoomHandlerMappedSetFunction<ZoomWebhookMeetingUpdatedEventPayload>;
  handleMeetingDeleted: ZoomHandlerMappedSetFunction<ZoomWebhookMeetingDeletedEventPayload>;
  handleMeetingStarted: ZoomHandlerMappedSetFunction<ZoomWebhookMeetingStartedEventPayload>;
  handleMeetingEnded: ZoomHandlerMappedSetFunction<ZoomWebhookMeetingEndedEventPayload>;
  handleMeetingPermanentlyDeleted: ZoomHandlerMappedSetFunction<ZoomWebhookMeetingPermanentlyDeletedEventPayload>;
}

export const zoomEventHandlerConfigurerFactory = handlerConfigurerFactory<ZoomEventHandlerConfigurer, UntypedZoomWebhookEvent>({
  configurerForAccessor: (accessor: HandlerBindAccessor<UntypedZoomWebhookEvent, ZoomWebhookEventType>) => {
    // eslint-disable-next-line
    const fnWithKey = handlerMappedSetFunctionFactory<ZoomWebhookEvent<any>, any>(accessor, zoomWebhookEvent);

    const configurer: ZoomEventHandlerConfigurer = {
      ...accessor,
      // Meetings
      handleMeetingCreated: fnWithKey(ZOOM_WEBHOOK_MEETING_CREATED_EVENT_TYPE),
      handleMeetingUpdated: fnWithKey(ZOOM_WEBHOOK_MEETING_UPDATED_EVENT_TYPE),
      handleMeetingDeleted: fnWithKey(ZOOM_WEBHOOK_MEETING_DELETED_EVENT_TYPE),
      handleMeetingStarted: fnWithKey(ZOOM_WEBHOOK_MEETING_STARTED_EVENT_TYPE),
      handleMeetingEnded: fnWithKey(ZOOM_WEBHOOK_MEETING_ENDED_EVENT_TYPE),
      handleMeetingPermanentlyDeleted: fnWithKey(ZOOM_WEBHOOK_MEETING_PERMANENTLY_DELETED_EVENT_TYPE)
    };

    return configurer;
  }
});
