import { ZoomMeeting } from '@dereekb/zoom';
import { ZoomWebhookAccountIdAndObjectPayloadData, ZoomWebhookEvent } from './webhook.zoom.type.common';

export type ZoomWebhookMeetingEventType = ZoomWebhookMeetingCreatedEventType | ZoomWebhookMeetingStartedEventType | ZoomWebhookMeetingEndedEventType;

// MARK: Meeting Created
export const ZOOM_WEBHOOK_MEETING_CREATED_EVENT_TYPE = 'meeting.created';
export type ZoomWebhookMeetingCreatedEventType = typeof ZOOM_WEBHOOK_MEETING_CREATED_EVENT_TYPE;
export type ZoomWebhookMeetingCreatedEventPayloadObject = Pick<ZoomMeeting, 'uuid' | 'id' | 'host_id' | 'topic' | 'type' | 'start_time' | 'duration' | 'timezone' | 'join_url' | 'password' | 'pmi' | 'occurrences' | 'settings' | 'recurrence'>;
export type ZoomWebhookMeetingCreatedEventPayload = ZoomWebhookAccountIdAndObjectPayloadData<ZoomWebhookMeetingCreatedEventPayloadObject>;
export type ZoomWebhookMeetingCreatedEvent = ZoomWebhookEvent<ZoomWebhookMeetingCreatedEventPayload, ZoomWebhookMeetingCreatedEventType>;

// MARK: Meeting Started
export const ZOOM_WEBHOOK_MEETING_STARTED_EVENT_TYPE = 'meeting.started';
export type ZoomWebhookMeetingStartedEventType = typeof ZOOM_WEBHOOK_MEETING_STARTED_EVENT_TYPE;

export const ZOOM_WEBHOOK_MEETING_ENDED_EVENT_TYPE = 'meeting.ended';
export type ZoomWebhookMeetingEndedEventType = typeof ZOOM_WEBHOOK_MEETING_ENDED_EVENT_TYPE;
