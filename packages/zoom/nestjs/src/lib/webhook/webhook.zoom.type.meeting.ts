import { PastZoomMeeting, ZoomMeeting, ZoomMeetingIssue } from '@dereekb/zoom';
import { ZoomWebhookAccountIdAndObjectPayloadData, ZoomWebhookEvent, ZoomWebhookOldObjectRef, ZoomWebhookOperationAndObjectPayloadData, ZoomWebhookTimestampRef } from './webhook.zoom.type.common';

export type ZoomWebhookMeetingEventType = ZoomWebhookMeetingAlertEventType | ZoomWebhookMeetingCreatedEventType | ZoomWebhookMeetingUpdatedEventType | ZoomWebhookMeetingDeletedEventType | ZoomWebhookMeetingStartedEventType | ZoomWebhookMeetingEndedEventType | ZoomWebhookMeetingPermanentlyDeletedEventType;

export type BasicZoomWebhookMeetingZoomEventPayloadObject = Pick<ZoomMeeting, 'id' | 'uuid' | 'host_id' | 'topic' | 'type' | 'start_time' | 'duration' | 'timezone'>;

// MARK: Meeting Alert
export const ZOOM_WEBHOOK_MEETING_ALERT_EVENT_TYPE = 'meeting.alert';
export type ZoomWebhookMeetingAlertEventType = typeof ZOOM_WEBHOOK_MEETING_ALERT_EVENT_TYPE;
export type ZoomWebhookMeetingAlertEventPayloadObject = BasicZoomWebhookMeetingZoomEventPayloadObject & {
  readonly issues: ZoomMeetingIssue[];
};
export type ZoomWebhookMeetingAlertEventPayload = ZoomWebhookAccountIdAndObjectPayloadData<ZoomWebhookMeetingAlertEventPayloadObject>;
export type ZoomWebhookMeetingAlertEvent = ZoomWebhookEvent<ZoomWebhookMeetingAlertEventPayload, ZoomWebhookMeetingAlertEventType>;

// MARK: Meeting Created
export const ZOOM_WEBHOOK_MEETING_CREATED_EVENT_TYPE = 'meeting.created';
export type ZoomWebhookMeetingCreatedEventType = typeof ZOOM_WEBHOOK_MEETING_CREATED_EVENT_TYPE;
export type ZoomWebhookMeetingCreatedEventPayloadObject = BasicZoomWebhookMeetingZoomEventPayloadObject & Pick<ZoomMeeting, 'join_url' | 'password' | 'pmi' | 'occurrences' | 'settings' | 'recurrence' | 'tracking_fields'>;
export type ZoomWebhookMeetingCreatedEventPayload = ZoomWebhookOperationAndObjectPayloadData<ZoomWebhookMeetingCreatedEventPayloadObject>;
export type ZoomWebhookMeetingCreatedEvent = ZoomWebhookEvent<ZoomWebhookMeetingCreatedEventPayload, ZoomWebhookMeetingCreatedEventType>;

// MARK: Meeting Updated
export const ZOOM_WEBHOOK_MEETING_UPDATED_EVENT_TYPE = 'meeting.updated';
export type ZoomWebhookMeetingUpdatedEventType = typeof ZOOM_WEBHOOK_MEETING_UPDATED_EVENT_TYPE;
export type ZoomWebhookMeetingUpdatedEventPayloadObject = BasicZoomWebhookMeetingZoomEventPayloadObject & Pick<ZoomMeeting, 'join_url' | 'agenda' | 'registration_url' | 'occurrences' | 'settings' | 'recurrence' | 'tracking_fields'>;
export type ZoomWebhookMeetingUpdatedEventPayload = ZoomWebhookOperationAndObjectPayloadData<ZoomWebhookMeetingUpdatedEventPayloadObject> & ZoomWebhookTimestampRef & ZoomWebhookOldObjectRef<ZoomWebhookMeetingUpdatedEventPayloadObject>;
export type ZoomWebhookMeetingUpdatedEvent = ZoomWebhookEvent<ZoomWebhookMeetingUpdatedEventPayload, ZoomWebhookMeetingUpdatedEventType>;

// MARK: Meeting Deleted
export const ZOOM_WEBHOOK_MEETING_DELETED_EVENT_TYPE = 'meeting.deleted';
export type ZoomWebhookMeetingDeletedEventType = typeof ZOOM_WEBHOOK_MEETING_DELETED_EVENT_TYPE;
export type ZoomWebhookMeetingDeletedEventPayloadObject = BasicZoomWebhookMeetingZoomEventPayloadObject & Pick<ZoomMeeting, 'occurrences'>;
export type ZoomWebhookMeetingDeletedEventPayload = ZoomWebhookOperationAndObjectPayloadData<ZoomWebhookMeetingDeletedEventPayloadObject>;
export type ZoomWebhookMeetingDeletedEvent = ZoomWebhookEvent<ZoomWebhookMeetingDeletedEventPayload, ZoomWebhookMeetingDeletedEventType>;

// MARK: Meeting Started
export const ZOOM_WEBHOOK_MEETING_STARTED_EVENT_TYPE = 'meeting.started';
export type ZoomWebhookMeetingStartedEventType = typeof ZOOM_WEBHOOK_MEETING_STARTED_EVENT_TYPE;
export type ZoomWebhookMeetingStartedEventPayloadObject = Pick<ZoomMeeting, 'uuid' | 'id' | 'host_id' | 'topic' | 'type' | 'start_time' | 'timezone'>;
export type ZoomWebhookMeetingStartedEventPayload = ZoomWebhookAccountIdAndObjectPayloadData<ZoomWebhookMeetingStartedEventPayloadObject>;
export type ZoomWebhookMeetingStartedEvent = ZoomWebhookEvent<ZoomWebhookMeetingStartedEventPayload, ZoomWebhookMeetingStartedEventType>;

// MARK: Meeting Ended
export const ZOOM_WEBHOOK_MEETING_ENDED_EVENT_TYPE = 'meeting.ended';
export type ZoomWebhookMeetingEndedEventType = typeof ZOOM_WEBHOOK_MEETING_ENDED_EVENT_TYPE;
export type ZoomWebhookMeetingEndedEventPayloadObject = BasicZoomWebhookMeetingZoomEventPayloadObject & Pick<PastZoomMeeting, 'end_time'>;
export type ZoomWebhookMeetingEndedEventPayload = ZoomWebhookAccountIdAndObjectPayloadData<ZoomWebhookMeetingEndedEventPayloadObject>;
export type ZoomWebhookMeetingEndedEvent = ZoomWebhookEvent<ZoomWebhookMeetingEndedEventPayload, ZoomWebhookMeetingEndedEventType>;

// MARK: Meeting Permanently Deleted
export const ZOOM_WEBHOOK_MEETING_PERMANENTLY_DELETED_EVENT_TYPE = 'meeting.permanently_deleted';
export type ZoomWebhookMeetingPermanentlyDeletedEventType = typeof ZOOM_WEBHOOK_MEETING_PERMANENTLY_DELETED_EVENT_TYPE;
export type ZoomWebhookMeetingPermanentlyDeletedEventPayloadObject = ZoomWebhookMeetingDeletedEventPayloadObject;
export type ZoomWebhookMeetingPermanentlyDeletedEventPayload = ZoomWebhookAccountIdAndObjectPayloadData<ZoomWebhookMeetingPermanentlyDeletedEventPayloadObject>;
export type ZoomWebhookMeetingPermanentlyDeletedEvent = ZoomWebhookEvent<ZoomWebhookMeetingPermanentlyDeletedEventPayload, ZoomWebhookMeetingPermanentlyDeletedEventType>;
