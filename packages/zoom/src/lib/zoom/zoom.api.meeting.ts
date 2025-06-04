import { ISO8601DateString } from '@dereekb/util';
import { ZoomMeetingType, ZoomRecurrenceInfo, ZoomMeetingSettings, ZoomMeetingAgenda, ZoomMeetingDuration, ZoomMeetingTrackingField, ZoomMeetingTemplateId, ZoomMeetingPassword, ZoomMeeting, ZoomMeetingId, PastZoomMeeting } from './zoom.api.meeting.type';
import { ZoomContext } from './zoom.config';
import { mapToZoomPageResult, zoomFetchPageFactory, ZoomPageFilter, ZoomPageResult } from '../zoom.api.page';
import { FetchPageFactory, makeUrlSearchParams } from '@dereekb/util/fetch';
import { ZoomUserId } from '../zoom.type';
import { omitSilenceZoomErrorKeys, SilenceZoomErrorConfig, silenceZoomErrorWithCodesFunction } from '../zoom.error.api';

// MARK: Get Meeting
export interface GetMeetingInput {
  readonly meetingId: ZoomMeetingId;
}

export type GetMeetingResponse = ZoomMeeting;

export type GetMeetingFunction = (input: GetMeetingInput) => Promise<GetMeetingResponse>;

/**
 * https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/#operation/meeting
 */
export function getMeeting(context: ZoomContext): GetMeetingFunction {
  return (input) => context.fetchJson(`/meetings/${input.meetingId}`, 'GET');
}

// MARK: List Meetings For User
export interface ListMeetingsForUserInput extends ZoomPageFilter {
  readonly user: ZoomUserId | 'me';
}

export type ListMeetingsForUserResponse = ZoomPageResult<ZoomMeeting>;

export type ListMeetingsForUserFunction = (input: ListMeetingsForUserInput) => Promise<ListMeetingsForUserResponse>;

/**
 * https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/#operation/meetings
 */
export function listMeetingsForUser(context: ZoomContext): ListMeetingsForUserFunction {
  return (input) => context.fetchJson(`/users/${input.user}/meetings`, 'GET').then(mapToZoomPageResult('meetings'));
}

export type ListMeetingsForUserPageFactory = FetchPageFactory<ListMeetingsForUserInput, ListMeetingsForUserResponse>;

export function listMeetingsForUserPageFactory(context: ZoomContext): ListMeetingsForUserPageFactory {
  return zoomFetchPageFactory(listMeetingsForUser(context));
}

// MARK: Create Meeting For User
/**
 * https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/#operation/meetingCreate
 */
export interface CreateMeetingForUserTemplate {
  /**
   * The meeting's agenda. This value has a maximum length of 2,000 characters.
   * @example "My Meeting"
   */
  readonly agenda?: ZoomMeetingAgenda;

  /**
   * Whether to generate a default passcode using the user's settings. This value defaults to `false`.
   *
   * If this value is `true` and the user has the PMI setting enabled with a passcode, then the user's meetings will use the PMI passcode. It will **not** use a default passcode.
   * @default false
   * @example false
   */
  readonly default_password?: boolean;

  /**
   * The meeting's scheduled duration, in minutes. This field is only used for scheduled meetings (`2`).
   * @example 60
   */
  readonly duration?: ZoomMeetingDuration;

  /**
   * The passcode required to join the meeting. By default, a passcode can **only** have a maximum length of 10 characters and only contain alphanumeric characters and the `@`, `-`, `_`, and `*` characters.
   *
   * **Note:**
   * - If the account owner or administrator has configured [minimum passcode requirement settings](https://support.zoom.us/hc/en-us/articles/360033559832-Meeting-and-webinar-passwords#h_a427384b-e383-4f80-864d-794bf0a37604), the passcode **must** meet those requirements.
   * - If passcode requirements are enabled, use the [**Get user settings**](/docs/api/users/#tag/users/GET/users/{userId}/settings) API or the [**Get account settings**](/docs/api/accounts/#tag/accounts/GET/accounts/{accountId}/settings) API to get the requirements.
   * - If the **Require a passcode when scheduling new meetings** account setting is enabled and locked, a passcode will be automatically generated if one is not provided.
   * @example "123456"
   */
  readonly password?: ZoomMeetingPassword;

  /**
   * Whether to create a prescheduled meeting via the [GSuite app](https://support.zoom.us/hc/en-us/articles/360020187492-Zoom-for-GSuite-add-on). This **only** supports the meeting `type` value of `2` (scheduled meetings) and `3` (recurring meetings with no fixed time).
   * - `true` - Create a prescheduled meeting.
   * - `false` - Create a regular meeting.
   * @default false
   * @example false
   */
  readonly pre_schedule?: boolean;

  /**
   * Recurrence object. Use this object only for a meeting with type `8`, a recurring meeting with a fixed time.
   */
  readonly recurrence?: ZoomRecurrenceInfo;

  /**
   * The email address or user ID of the user to schedule a meeting for.
   * @example "jchill@example.com"
   */
  readonly schedule_for?: string;

  /**
   * Meeting settings object. See ZoomMeetingSettings for all available options.
   */
  readonly settings?: ZoomMeetingSettings;

  /**
   * The meeting's topic.
   */
  readonly topic?: string;

  /**
   * The meeting's scheduled start time, in ISO 8601 format.
   */
  readonly start_time?: ISO8601DateString;

  /**
   * The time zone to use for the meeting.
   */
  readonly timezone?: string;

  /**
   * The meeting type.
   * - `1`: Instant
   * - `2`: Scheduled
   * - `3`: Recurring (no fixed time)
   * - `8`: Recurring (fixed time)
   */
  readonly type?: ZoomMeetingType;

  /**
   * Tracking fields for the meeting.
   */
  readonly tracking_fields?: ZoomMeetingTrackingField[];

  /**
   * Template ID to use for the meeting.
   */
  readonly template_id?: ZoomMeetingTemplateId;
}

export interface CreateMeetingForUserInput {
  readonly user: ZoomUserId | 'me';
  readonly template: CreateMeetingForUserTemplate;
}

export type CreateMeetingForUserResponse = ZoomMeeting;

/**
 * https://developers.zoom.us/docs/api/meetings/#tag/meetings/POST/users/{userId}/meetings
 */
export function createMeetingForUser(context: ZoomContext): (input: CreateMeetingForUserInput) => Promise<CreateMeetingForUserResponse> {
  return (input) => {
    return context.fetchJson(`/users/${input.user}/meetings`, {
      method: 'POST',
      body: JSON.stringify(input.template)
    });
  };
}

// MARK: Delete Meeting
export interface DeleteMeetingInput extends SilenceZoomErrorConfig {
  readonly meetingId: ZoomMeetingId;
  /**
   * The occurrence ID of the meeting to delete.
   */
  readonly occurrence_id?: string;
  /**
   * `true`: Notify host and alternative host about the meeting cancellation via email.
   * `false`: Do not send any email notification.
   */
  readonly schedule_for_reminder?: boolean;
  /**
   * `true`: Notify registrants about the meeting cancellation via email.
   * `false`: Do not send any email notification to meeting registrants.
   *
   * The default value of this field is `false`.
   */
  readonly cancel_meeting_reminder?: boolean;
}

export type DeleteMeetingResponse = unknown;

export type DeleteMeetingFunction = (input: DeleteMeetingInput) => Promise<DeleteMeetingResponse>;

export const DELETE_MEETING_DOES_NOT_EXIST_ERROR_CODE = 3001;

/**
 * https://developers.zoom.us/docs/api/meetings/#tag/meetings/DELETE/meetings/{meetingId}
 */
export function deleteMeeting(context: ZoomContext): DeleteMeetingFunction {
  const silenceDoesNotExistError = silenceZoomErrorWithCodesFunction(DELETE_MEETING_DOES_NOT_EXIST_ERROR_CODE);
  return (input) => context.fetchJson(`/meetings/${input.meetingId}?${makeUrlSearchParams(input, omitSilenceZoomErrorKeys())}`, 'DELETE').catch(silenceDoesNotExistError(input.silenceError));
}

// MARK: Get Past Meeting
export interface GetPastMeetingInput {
  readonly meetingId: string;
}

export type GetPastMeetingResponse = PastZoomMeeting;

export type GetPastMeetingFunction = (input: GetPastMeetingInput) => Promise<GetPastMeetingResponse>;

/**
 * https://developers.zoom.us/docs/api/meetings/#tag/meetings/GET/past_meetings/{meetingId}
 */
export function getPastMeeting(context: ZoomContext): GetPastMeetingFunction {
  return (input) => context.fetchJson(`/past_meetings/${input.meetingId}`, 'GET');
}

// MARK: Get Past Meeting Participants
export interface GetPastMeetingParticipantsInput extends ZoomPageFilter {
  readonly meetingId: ZoomMeetingId;
}

export type GetPastMeetingParticipantsResponse = ZoomPageResult<PastZoomMeeting>;

export type GetPastMeetingParticipantsFunction = (input: GetPastMeetingParticipantsInput) => Promise<GetPastMeetingParticipantsResponse>;

/**
 * https://developers.zoom.us/docs/api/meetings/#tag/meetings/GET/past_meetings/{meetingId}/participants
 */
export function getPastMeetingParticipants(context: ZoomContext): GetPastMeetingParticipantsFunction {
  return (input) => context.fetchJson(`/past_meetings/${input.meetingId}/participants`, 'GET').then(mapToZoomPageResult('participants'));
}

export type GetPastMeetingParticipantsPageFactory = FetchPageFactory<GetPastMeetingParticipantsInput, GetPastMeetingParticipantsResponse>;

export function getPastMeetingParticipantsPageFactory(context: ZoomContext): GetPastMeetingParticipantsPageFactory {
  return zoomFetchPageFactory(getPastMeetingParticipants(context));
}
