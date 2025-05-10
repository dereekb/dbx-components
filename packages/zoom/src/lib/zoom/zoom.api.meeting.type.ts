import { CommaSeparatedString, DayOfMonth, EmailAddress, ISO8601DateString, Minutes, WebsiteDomain } from '@dereekb/util';
import { ZoomUserId } from '../zoom.type';
import { type ZoomUserPersonalMeetingId } from './zoom.api.user.type';

export type ZoomMeetingId = string;
export type ZoomMeetingTemplateId = string;

export type ZoomMeetingOccurrenceDuration = number;

/**
 * URL for participants to join the meeting.
 *
 * This URL should only be shared with users that you would like to invite for the meeting.
 */
export type ZoomMeetingJoinUrl = string;

/**
 * URL for participants to join the meeting.
 *
 * This URL should only be shared with users that you would like to invite for the meeting.
 */
export type ZoomMeetingChatJoinUrl = string;

export type ZoomRegistrationUrl = string;

/**
 * The status of the occurrence.
 */
export type ZoomMeetingOccurrenceStatus = 'available' | 'deleted';

export interface ZoomMeetingOccurrence {
  /**
   * The meeting duration in minutes.
   */
  readonly duration: Minutes;
  /**
   * Occurrence ID. The unique identifier for an occurrence of a recurring webinar.
   *
   * Recurring webinars can have a maximum of 50 occurrences.
   */
  readonly occurrence_id: string;
  /**
   * The start time of the meeting.
   */
  readonly start_time: ISO8601DateString;
  /**
   * The status of the occurrence.
   */
  readonly status: ZoomMeetingOccurrenceStatus;
}

export interface ZoomMeeting {
  /**
   * The ID of the user who scheduled this meeting on behalf of the host.
   */
  readonly assistant_id?: ZoomUserId;

  /**
   * The meeting host's email address.
   */
  readonly host_email: EmailAddress;

  /**
   * The meeting ID (meeting number): Unique identifier of the meeting in long format (int64), also known as the meeting number.
   */
  readonly id: ZoomMeetingId;

  /**
   * The URL that registrants can use to register for a meeting. Only returned for meetings with registration enabled.
   */
  readonly registration_url?: ZoomRegistrationUrl;

  /**
   * The meeting's agenda. This value has a maximum length of 2,000 characters.
   * @example "My Meeting"
   */
  readonly agenda?: ZoomMeetingAgenda;

  /**
   * The date and time when this meeting was created.
   */
  readonly created_at: ISO8601DateString;

  /**
   * The meeting duration.
   */
  readonly duration?: Minutes;

  /**
   * Encrypted passcode for third party endpoints (H323/SIP).
   */
  readonly encrypted_password?: string;

  /**
   * Passcode for participants to join the meeting via PSTN.
   */
  readonly pstn_password?: string;

  /**
   * H.323/SIP room system passcode.
   */
  readonly h323_password?: string;

  /**
   * URL for participants to join the meeting. Should only be shared with users you would like to invite.
   */
  readonly join_url: ZoomMeetingJoinUrl;

  /**
   * The URL to join the chat.
   */
  readonly chat_join_url?: ZoomMeetingChatJoinUrl;

  /**
   * Array of occurrence objects. Only returned for recurring webinars.
   */
  readonly occurrences?: ZoomMeetingOccurrence[];

  /**
   * The meeting passcode.
   */
  readonly password?: ZoomMeetingPassword;

  /**
   * Personal meeting ID (PMI). Only used for scheduled meetings and recurring meetings with no fixed time.
   */
  readonly pmi?: ZoomUserPersonalMeetingId;

  /**
   * Whether the prescheduled meeting was created via the GSuite app. Only supports meeting type 2 and 3.
   */
  readonly pre_schedule?: boolean;

  /**
   * Recurrence object. Use this object only for a meeting with type 8, a recurring meeting with fixed time.
   */
  readonly recurrence?: ZoomRecurrenceInfo;

  /**
   * Meeting settings object.
   */
  readonly settings?: ZoomMeetingSettings;
}

/**
 * The meeting's agenda. This value has a maximum length of 2,000 characters.
 */
export type ZoomMeetingAgenda = string;

/**
 * The passcode required to join the meeting.
 *
 * By default, a passcode can **only** have a maximum length of 10 characters and only contain alphanumeric characters and the `@`, `-`, `_`, and `*` characters.
 *
 * **Note:**
 * If the account owner or administrator has configured [minimum passcode requirement settings](https://support.zoom.us/hc/en-us/articles/360033559832-Meeting-and-webinar-passwords#h_a427384b-e383-4f80-864d-794bf0a37604), the passcode **must** meet those requirements.
 *
 * If passcode requirements are enabled, use the [**Get user settings**](/docs/api/users/#tag/users/GET/users/{userId}/settings) API or the [**Get account settings**](/docs/api/accounts/#tag/accounts/GET/accounts/{accountId}/settings) API to get the requirements.
 */
export type ZoomMeetingPassword = string;

/**
 * The meeting's scheduled duration, in minutes.
 */
export type ZoomMeetingDuration = Minutes;

export enum ZoomMeetingType {
  INSTANT = 1,
  SCHEDULED = 2,
  RECURRING_NO_FIXED_TIME = 3,
  RECURRING_FIXED_TIME = 8
}

/**
 * Define the interval when the meeting should recur.
 *
 * For instance, to schedule a meeting that recurs every two months, set this field's value as `2` and the value of the `type` parameter as `3`.
 *
 * For a daily meeting, the maximum number of recurrences is `99` days. For a weekly meeting, the maximum is `50` weeks.
 *
 * For a monthly meeting, the maximum is `10` months.
 */
export type ZoomRecurrenceInfoRepeatInterval = number;

/**
 * Comma-separated values, e.g., "1,2,3" for Sunday, Monday, Tuesday. (1-Sunday, 7-Saturday)
 */
export type ZoomRecurrenceInfoWeeklyDays = string;

/**
 * The number of times the meeting will recur
 */
export type ZoomRecurrenceInfoRecurrenceCount = number;

export interface ZoomRecurrenceInfo {
  readonly type: ZoomRecurrenceType;
  readonly repeat_interval?: ZoomRecurrenceInfoRepeatInterval;
  readonly weekly_days?: ZoomRecurrenceInfoWeeklyDays;
  readonly monthly_day?: DayOfMonth;
  readonly monthly_week?: ZoomMonthlyWeek;
  readonly monthly_week_day?: ZoomMonthlyWeekDay;
  readonly end_times?: ZoomRecurrenceInfoRecurrenceCount;
  /**
   * Date at which the recurrence ends.
   */
  readonly end_date_time?: ISO8601DateString;
}

export enum ZoomRecurrenceType {
  DAILY = 1,
  WEEKLY = 2,
  MONTHLY = 3
}

export enum ZoomMonthlyWeek {
  LAST_WEEK = -1,
  FIRST_WEEK = 1,
  SECOND_WEEK = 2,
  THIRD_WEEK = 3,
  FOURTH_WEEK = 4
}

export enum ZoomMonthlyWeekDay {
  SUNDAY = 1,
  MONDAY = 2,
  TUESDAY = 3,
  WEDNESDAY = 4,
  THURSDAY = 5,
  FRIDAY = 6,
  SATURDAY = 7
}

export interface ZoomMeetingSettingsBreakoutRoomRoom {
  readonly name: string;
  readonly participants?: string[];
}

export interface ZoomMeetingSettingsBreakoutRoom {
  readonly enable?: boolean;
  readonly rooms?: ZoomMeetingSettingsBreakoutRoomRoom[];
}

export interface ZoomMeetingSettingsLanguageInterpretation {
  readonly enable?: boolean;
  readonly interpreters?: ZoomMeetingInterpreter[];
}

export interface ZoomMeetingSettingsApprovedOrDeniedCountriesOrRegions {
  readonly enable?: boolean;
  readonly method?: 'approve' | 'deny';
  readonly approved_list?: string[];
  readonly denied_list?: string[];
}

export type ZoomMeetingSettingsEncryptionType = 'enhanced_encryption' | 'end_to_end_encryption';

/**
 * Language translation string.
 *
 * e.g., "US:Fr" for US English to French
 */
export type ZoomMeetingInterpreterLanguage = string;

export type ZoomMeetingInterpreterLanguages = string;

export interface ZoomMeetingInterpreter {
  readonly email: EmailAddress;
  readonly languages: ZoomMeetingInterpreterLanguage;
}

/**
 * Join before host time.
 *
 * 0 (Anytime), 5, 10 or 15 minutes before start time.
 */
export type ZoomJoinBeforeHostTime = 0 | 5 | 10 | 15;

export enum ZoomApprovalType {
  /**
   * Automatically approve.
   */
  AUTOMATICALLY_APPROVE = 0,
  /**
   * Manually approve.
   */
  MANUALLY_APPROVE = 1,
  /**
   * No registration required.
   */
  NO_REGISTRATION_REQUIRED = 2
}

export enum ZoomRegistrationType {
  /**
   * Attendees register once and can attend any meeting occurrence.
   */
  REGISTER_ONCE_ATTEND_ANY = 1,
  /**
   * Attendees must register for each meeting occurrence.
   */
  REGISTER_FOR_EACH_OCCURRENCE = 2,
  /**
   * Attendees register once and can select one or more meeting occurrences to attend.
   */
  REGISTER_ONCE_CHOOSE_OCCURRENCES = 3
}

export interface ZoomMeetingTrackingField {
  readonly field: string;
  readonly value?: string;
}

export interface ZoomMeetingSettings {
  readonly host_video?: boolean;
  readonly participant_video?: boolean;
  readonly cn_meeting?: boolean; // Host meeting in China.
  readonly in_meeting?: boolean; // Host meeting in India.
  readonly join_before_host?: boolean;
  readonly jbh_time?: ZoomJoinBeforeHostTime; // 0 (Anytime), 5, 10 or 15 minutes before start time.
  readonly mute_upon_entry?: boolean;
  readonly watermark?: boolean;
  readonly use_pmi?: boolean; // Use Personal Meeting ID instead of generating a unique meeting ID.
  readonly approval_type?: ZoomApprovalType; // 0: Auto, 1: Manual, 2: No registration required
  readonly registration_type?: ZoomRegistrationType; // 1, 2, 3 (if approval_type is 0 or 1)
  readonly audio?: 'both' | 'telephony' | 'voip' | 'thirdParty';
  readonly auto_recording?: 'local' | 'cloud' | 'none';
  readonly alternative_hosts?: CommaSeparatedString<EmailAddress>; // Comma-separated email addresses
  readonly waiting_room?: boolean;
  readonly global_dial_in_countries?: string[]; // Array of country codes for Global Dial-in Countries.
  readonly contact_name?: string;
  readonly contact_email?: EmailAddress;
  readonly meeting_authentication?: boolean;
  readonly authentication_option?: string; // ID of the authentication option from `GET /users/{userId}/meeting_authentication`.
  readonly authentication_domains?: CommaSeparatedString<WebsiteDomain>; // Comma-separated domains if authentication_type is `enforce_login_with_domains`.
  readonly breakout_room?: ZoomMeetingSettingsBreakoutRoom;
  readonly language_interpretation?: ZoomMeetingSettingsLanguageInterpretation;
  readonly interpreters?: Array<{ email: string; languages: string }>; // e.g., "US:Fr" for US English to French
  readonly approved_or_denied_countries_or_regions?: ZoomMeetingSettingsApprovedOrDeniedCountriesOrRegions;
  readonly encryption_type?: ZoomMeetingSettingsEncryptionType;
  readonly alternative_host_update_polls?: boolean;
  readonly show_share_button?: boolean;
  readonly allow_multiple_devices?: boolean;
}
