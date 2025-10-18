import { type UnixDateTimeNumber } from '@dereekb/util';

/**
 * An identifier in Zoom.
 */
export type ZoomId = string;

/**
 * Zoom user identifier
 */
export type ZoomUserId = string;

/**
 * The version of the Zoom client used by the user.
 */
export type ZoomClientVersion = string;

/**
 * Zoom webhook event type
 */
export type ZoomWebhookEventTypeString = string;

/*
 * A timestamp at which the event occurred as a Unix timestamp.
 */
export type ZoomWebhookTimestamp = UnixDateTimeNumber;
