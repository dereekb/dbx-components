import { type CommaSeparatedString, type DayOfMonth, type EmailAddress, type FileSize, type ISO8601DateString, type Minutes, type TimezoneString } from '@dereekb/util';
import { type ZoomUserId } from '../zoom.type';
import { type ZoomUserPersonalMeetingId } from './zoom.api.user.type';

export type ZoomMeetingId = number;

/**
 * Unique meeting ID.
 *
 * Each meeting instance generates its own meeting UUID - after a meeting ends, a new UUID is generated for the next instance of the meeting. Retrieve a list of UUIDs from past meeting instances using the [**List past meeting instances**](/docs/api/rest/reference/zoom-api/methods#operation/pastMeetings) API. [Double encode](/docs/api/rest/using-zoom-apis/#meeting-id-and-uuid) your UUID when using it for API calls if the UUID begins with a `/` or contains `//` in it.
 */
export type ZoomMeetingUUID = string;

export type ZoomMeetingTemplateId = string;

/**
 * The meeting topic.
 */
export type ZoomMeetingTopic = string;

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

export type ZoomMeetingOccurrenceId = string;

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
  readonly occurrence_id: ZoomMeetingOccurrenceId;
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
   * The ID of the user who is set as the meeting host.
   */
  readonly host_id: ZoomUserId;

  /**
   * The meeting ID (meeting number): Unique identifier of the meeting in long format (int64), also known as the meeting number.
   */
  readonly id: ZoomMeetingId;

  /**
   * The meeting's unique identifier.
   */
  readonly uuid: ZoomMeetingUUID;

  /**
   * The meeting topic.
   */
  readonly topic: ZoomMeetingTopic;

  /**
   * The timezone to format the meeting start time.
   */
  readonly timezone: TimezoneString;

  /**
   * The start time of the meeting.
   */
  readonly start_time: ISO8601DateString;

  /**
   * The meeting duration.
   */
  readonly duration: ZoomMeetingDuration;

  /**
   * The type of meeting.
   */
  readonly type: ZoomMeetingType;

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

  /**
   * Meeting tracking fields.
   */
  readonly tracking_fields?: ZoomMeetingTrackingField[];
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

/**
 * The type of meeting:
 * - `1` - An instant meeting.
 * - `2` - A scheduled meeting.
 * - `3` - A recurring meeting with no fixed time.
 * - `4` - A PMI Meeting.
 * - `8` - A recurring meeting with fixed time.
 * - `10` - A screen share only meeting.
 */
export enum ZoomMeetingType {
  INSTANT = 1,
  SCHEDULED = 2,
  RECURRING_NO_FIXED_TIME = 3,
  PMI = 4,
  RECURRING_FIXED_TIME = 8,
  SCREEN_SHARE_ONLY = 10
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

/**
 * Options for Continuous Meeting Chat linking between a meeting and a Zoom Team Chat channel.
 */
export interface ZoomMeetingSettingsContinuousMeetingChat {
  /** Enable or disable Continuous Meeting Chat. */
  readonly enable?: boolean;
  /** Auto-add invited external users to the linked channel. */
  readonly auto_add_invited_external_users?: boolean;
  /** Auto-add all meeting participants to the linked channel. */
  readonly auto_add_meeting_participants?: boolean;
  /**
   * Rule describing which users are auto-added.
   * • `all_users` – everyone.
   * • `org_invitees_and_participants` – internal users who are invited or participate.
   * • `org_invitees` – internal invited users only.
   */
  readonly who_is_added?: 'all_users' | 'org_invitees_and_participants' | 'org_invitees';
  /** Identifier of the chat channel to link. */
  readonly channel_id?: string;
}

/** A pre-provisioned whiteboard resource shared at meeting start. */
export interface ZoomMeetingSettingsWhiteboardResource {
  /** Resource type – currently only `whiteboard`. */
  readonly resource_type: 'whiteboard';
  /** Unique whiteboard identifier. */
  readonly resource_id: string;
  /** Initial permission granted to participants. */
  readonly permission_level?: 'editor' | 'commenter' | 'viewer';
}

/** Additional email invitee outside the standard Zoom invitation. */
export interface ZoomMeetingSettingsInvitee {
  readonly email: EmailAddress;
  /** Indicates whether the invitee belongs to the owner’s account. */
  readonly internal_user?: boolean;
}

/** User allowed to bypass meeting authentication. */
export interface ZoomMeetingSettingsAuthenticationException {
  readonly email: EmailAddress;
  readonly name?: string;
  /** Unique join link generated for the exception user. */
  readonly join_url?: string;
}

/** Custom tracking field key–value pair. */
export interface ZoomMeetingSettingsCustomKey {
  readonly key: string;
  readonly value: string;
}

/** International dial-in number exposed in invitations. */
export interface ZoomMeetingSettingsGlobalDialInNumber {
  readonly city?: string;
  readonly country?: string;
  readonly country_name?: string;
  readonly number: string;
  readonly type: 'toll' | 'tollfree';
}

/** Webinar Q&A configuration block. */
export interface ZoomMeetingSettingsQnA {
  readonly enable?: boolean;
  readonly allow_submit_questions?: boolean;
  readonly allow_anonymous_questions?: boolean;
  readonly question_visibility?: 'answered' | 'all';
  readonly attendees_can_comment?: boolean;
  readonly attendees_can_upvote?: boolean;
}

/** Interpreter mapping for language interpretation. */
export interface ZoomMeetingSettingsInterpreter {
  readonly email: EmailAddress;
  /** BCP-47 language list in the form `"<source>-<target>"`, e.g., "en-US:es-ES". */
  readonly languages: string;
}

export interface ZoomMeetingSettings {
  /**
   * Start the host’s video automatically when the meeting begins.
   */
  readonly host_video?: boolean;
  /**
   * Start participant video automatically when they join.
   */
  readonly participant_video?: boolean;
  /**
   * Allow participants to join from data centers located in China.
   */
  readonly cn_meeting?: boolean;
  /**
   * Allow participants to join from data centers located in India.
   */
  readonly in_meeting?: boolean;
  /**
   * Allow participants to join the meeting before the host starts it.
   */
  readonly join_before_host?: boolean;
  /**
   * How many minutes before the scheduled start participants may join if `join_before_host` is `true`.
   * `0` means anytime.
   */
  readonly jbh_time?: ZoomJoinBeforeHostTime;
  /**
   * Automatically mute participants when they join the meeting.
   */
  readonly mute_upon_entry?: boolean;
  /**
   * Show a watermarked image.
   *
   * When enabled, participant details are watermarked on shared content to prevent leaks.
   */
  readonly watermark?: boolean;
  /**
   * Use Personal Meeting ID instead of generating a unique, random meeting ID.
   */
  readonly use_pmi?: boolean;
  /**
   * Registration approval workflow.
   */
  readonly approval_type?: ZoomApprovalType;
  /**
   * Recurrence registration rule if registration is required.
   */
  readonly registration_type?: ZoomRegistrationType;
  /**
   * Audio options available to participants.
   */
  readonly audio?: 'both' | 'telephony' | 'voip' | 'thirdParty';
  /**
   * Meeting auto-recording location.
   */
  readonly auto_recording?: 'local' | 'cloud' | 'none';
  /**
   * Only authenticated users may join.
   */
  readonly enforce_login?: boolean;
  /**
   * Comma-separated list of domains allowed to join if authentication is enforced.
   */
  readonly enforce_login_domains?: string;
  /**
   * User emails that will become alternative hosts (comma separated).
   */
  readonly alternative_hosts?: CommaSeparatedString<EmailAddress>;
  /**
   * Allow alternative hosts to edit meeting polls.
   */
  readonly alternative_host_update_polls?: boolean;
  /**
   * Stop accepting new registrants once the meeting starts.
   */
  readonly close_registration?: boolean;
  /**
   * Show the social share button on the registration page.
   */
  readonly show_share_button?: boolean;
  /**
   * Allow users to join from multiple devices simultaneously.
   */
  readonly allow_multiple_devices?: boolean;
  /**
   * Send confirmation email to registrants.
   */
  readonly registrants_confirmation_email?: boolean;
  /**
   * Enable Waiting Room for this meeting.
   */
  readonly waiting_room?: boolean;
  /**
   * Ask participants for pre-approval to be unmuted by host/co-host.
   */
  readonly request_permission_to_unmute_participants?: boolean;
  /**
   * Send email to host when someone registers.
   */
  readonly registrants_email_notification?: boolean;
  /**
   * Require users to authenticate to join the meeting.
   */
  readonly meeting_authentication?: boolean;
  /**
   * End-to-end encryption option for the meeting.
   */
  readonly encryption_type?: ZoomMeetingSettingsEncryptionType;
  /**
   * Countries or regions allowed/blocked from joining.
   */
  readonly approved_or_denied_countries_or_regions?: ZoomMeetingSettingsApprovedOrDeniedCountriesOrRegions;
  /**
   * Pre-assigned breakout room configuration.
   */
  readonly breakout_room?: ZoomMeetingSettingsBreakoutRoom;
  /**
   * Limit meeting access to users internal to the host’s organization.
   */
  readonly internal_meeting?: boolean;
  /**
   * Continuous Meeting Chat options.
   */
  readonly continuous_meeting_chat?: ZoomMeetingSettingsContinuousMeetingChat;
  /**
   * Array of pre-provisioned whiteboards shared at meeting start.
   */
  readonly resources?: ZoomMeetingSettingsWhiteboardResource[];
  /**
   * Additional people to invite via email.
   */
  readonly meeting_invitees?: ZoomMeetingSettingsInvitee[];
  /**
   * Auto-start AI Companion meeting summary.
   */
  readonly auto_start_meeting_summary?: boolean;
  /**
   * Who receives the summary email (1-4).
   */
  readonly who_will_receive_summary?: ZoomMeetingSettingsWhoWillReceiveSummary;
  /**
   * Auto-start AI Companion live Q&A.
   */
  readonly auto_start_ai_companion_questions?: boolean;
  /**
   * Who may ask AI Companion questions (1-5).
   */
  readonly who_can_ask_questions?: ZoomMeetingSettingsWhoCanAskQuestions;
  /**
   * Identifier of the AI Companion summary template.
   */
  readonly summary_template_id?: string;
  /**
   * Name of the authentication profile used for this meeting.
   */
  readonly authentication_name?: string;
  /**
   * Users allowed to bypass authentication.
   */
  readonly authentication_exception?: ZoomMeetingSettingsAuthenticationException[];
  /**
   * Additional audio conference information to include in invites.
   */
  readonly audio_conference_info?: string;
  /**
   * Calendar system used for scheduling (1 = Gregorian, 2 = Chinese Lunar).
   */
  readonly calendar_type?: 1 | 2;
  /**
   * Custom tracking field values.
   */
  readonly custom_keys?: ZoomMeetingSettingsCustomKey[];
  /**
   * Prevent participants from turning on their video.
   */
  readonly disable_participant_video?: boolean;
  /**
   * List of dial-in numbers to display in invitations.
   */
  readonly global_dial_in_numbers?: ZoomMeetingSettingsGlobalDialInNumber[];
  /**
   * Webinar Q&A configuration.
   */
  readonly question_and_answer?: ZoomMeetingSettingsQnA;
  /**
   * Sign language interpretation settings.
   */
  readonly sign_language_interpretation?: ZoomMeetingSettingsLanguageInterpretation;
  /**
   * Spoken language interpretation settings.
   */
  readonly language_interpretation?: ZoomMeetingSettingsLanguageInterpretation;
  /**
   * List of interpreters assigned to the meeting.
   */
  readonly interpreters?: ZoomMeetingSettingsInterpreter[];
}

/**
 * Determines who will receive the meeting summary email.
 * 1 – Host only
 * 2 – Co-host only
 * 3 – Host and Co-host
 * 4 – Everyone
 */
export type ZoomMeetingSettingsWhoWillReceiveSummary = 1 | 2 | 3 | 4;

/**
 * Determines who can ask questions to AI Companion during the meeting.
 * 1 – Host only
 * 2 – Co-host only
 * 3 – Host and Co-host
 * 4 – Participants (internal users)
 * 5 – Everyone (internal + external)
 */
export type ZoomMeetingSettingsWhoCanAskQuestions = 1 | 2 | 3 | 4 | 5;

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

export interface ZoomMeetingChatMessageFile {
  readonly file_id: string;
  readonly file_name: string;
  readonly file_size: FileSize;
  readonly file_type: string;
  readonly file_owner_id: ZoomUserId;
}

/**
 * The source of the meeting.
 */
export type ZoomMeetingSource = string;

export interface PastZoomMeeting extends Pick<ZoomMeeting, 'id' | 'uuid' | 'duration' | 'start_time' | 'host_id' | 'type' | 'topic'> {
  /**
   * The time the meeting ended.
   */
  readonly end_time: ISO8601DateString;

  /**
   * The meeting host's department.
   */
  readonly dept: string;

  /**
   * The number of participants in the meeting.
   */
  readonly participant_count: number;

  /**
   * The source of the meeting.
   */
  readonly source: ZoomMeetingSource;

  /**
   * Total number of minutes the meeting lasted.
   */
  readonly total_minutes: Minutes;
}

export type ZoomParticipantId = string;

export type ZoomRegistrantId = string;

export type ZoomParticipantStatus = 'in_meeting' | 'in_waiting_room';

export interface PastZoomMeetingParticipant {
  readonly id: ZoomUserId | '';
  readonly name: string;
  /**
   * Participant ID.
   *
   * This is a unique ID assigned to the participant joining a meeting and is valid for that meeting only.
   */
  readonly user_id: ZoomParticipantId;
  /**
   * The participant's unique registrant ID.
   *
   * This field only returns if you pass the `registrant_id` value for the `include_fields` query parameter.
   *
   * This field does not return if the `type` query parameter is the `live` value.
   */
  readonly registrant_id: ZoomRegistrantId;
  /**
   * The participant's email address.
   */
  readonly user_email: EmailAddress;
  /**
   * The time the participant joined the meeting.
   */
  readonly join_time: ISO8601DateString;
  /**
   * The time the participant left the meeting.
   */
  readonly leave_time: ISO8601DateString;
  /**
   * Participant duration, in seconds, calculated by subtracting the `leave_time` from the `join_time` for the `user_id`.
   *
   * If the participant leaves and rejoins the same meeting, they will be assigned a different `user_id` and Zoom displays their new duration in a separate object.
   *
   * Note that because of this, the duration may not reflect the total time the user was in the meeting.
   */
  readonly duration: Minutes;
  /**
   * Indicates if failover happened during the meeting.
   */
  readonly failover: boolean;
  /**
   * The participant's status in the meeting.
   */
  readonly status: ZoomParticipantStatus;
  /**
   * Whether the participant is an internal user.
   */
  readonly internal_user: boolean;
}

export type ZoomMeetingIssue = 'Unstable audio quality' | 'Unstable video quality' | 'Unstable screen share quality' | 'High CPU occupation' | 'Call Reconnection';
