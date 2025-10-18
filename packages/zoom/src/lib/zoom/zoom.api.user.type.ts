import { type EmailAddress, type ISO8601DateStringUTCFull, type TimezoneString } from '@dereekb/util';
import { type ZoomClientVersion, type ZoomUserId } from '../zoom.type';

/**
 * Represents a Zoom user, as returned by the Zoom API.
 */
export interface ZoomUser {
  /**
   * The user's ID. Not returned for users with 'pending' status.
   *
   * @example "KDcuGIm1QgePTO8WbOqwIQ"
   */
  readonly id: ZoomUserId;

  /**
   * The date and time when this user's latest login type was created.
   *
   * @example "2018-10-31T04:32:37Z"
   */
  readonly created_at: ISO8601DateStringUTCFull;

  /**
   * The date and time when this user was created.
   *
   * @example "2019-06-01T07:58:03Z"
   */
  readonly user_created_at: ISO8601DateStringUTCFull;

  /**
   * The user's department.
   *
   * @example "Developers"
   */
  readonly dept?: string;

  /**
   * The user's first name.
   *
   * @example "Jill"
   */
  readonly first_name: string;

  /**
   * The user's last name.
   *
   * @example "Chill"
   */
  readonly last_name: string;

  /**
   * The user's email address.
   *
   * @example "jchill@example.com"
   */
  readonly email: EmailAddress;

  /**
   * The employee's unique ID. Only returned when SAML SSO is enabled and login_type is 101 (SSO).
   *
   * @example "HqDyI037Qjili1kNsSIrIg"
   */
  readonly employee_unique_id?: string;

  /**
   * The IDs of groups where the user is a member.
   */
  readonly group_ids: string[];

  /**
   * The user's host key. Only returned if assigned and requested via include_fields.
   */
  readonly host_key?: string;

  /**
   * The IDs of IM directory groups where the user is a member.
   */
  readonly im_group_ids: string[];

  /**
   * The last client version that user used to log in.
   *
   * @example "5.2.45120.0906(win)"
   */
  readonly last_client_version: ZoomClientVersion;

  /**
   * The user's last login time. Has a three-day buffer period.
   *
   * @example "2022-03-25T05:40:55Z"
   */
  readonly last_login_time: ISO8601DateStringUTCFull;

  /**
   * Returned if the user is enrolled in the Zoom United plan. See docs for enum values.
   * @example "1"
   */
  readonly plan_united_type?: ZoomUserPlanUnitedType;

  /**
   * The user's personal meeting ID (PMI).
   * @example 6589310093
   */
  readonly pmi: ZoomUserPersonalMeetingId;

  /**
   * The unique ID of the user's assigned role.
   * @example "0"
   */
  readonly role_id: ZoomUserRoleId;

  /**
   * The user's status: 'active', 'inactive', or 'pending'.
   * @example "active"
   */
  readonly status: ZoomUserStatus;

  /**
   * The user's timezone.
   * @example "Asia/Shanghai"
   */
  readonly timezone: TimezoneString;

  /**
   * The user's assigned plan type. 1 - Basic, 2 - Licensed, 4 - Unassigned, 99 - None (ssoCreate only).
   *
   * @example 1
   */
  readonly type: ZoomUserType;

  /**
   * Whether the user's email address is verified.
   */
  readonly verified: ZoomUserVerified;

  /**
   * The information about the user's custom attributes.
   * This field is only returned if users are assigned custom attributes and you provided the `custom_attributes` value for the `include_fields` query parameter in the API request.
   */
  readonly custom_attributes?: ZoomUserCustomAttribute[];

  /**
   * The user's display name.
   */
  readonly display_name: string;

  /**
   * The user's role name (e.g., 'Owner').
   */
  readonly role_name: string;

  /**
   * Whether to use PMI for instant meetings.
   */
  readonly use_pmi: boolean;

  /**
   * The user's personal meeting URL.
   */
  readonly personal_meeting_url: string;

  /**
   * The user's profile picture URL.
   */
  readonly pic_url: string;

  /**
   * The user's CMS user ID (may be empty).
   */
  readonly cms_user_id?: string;

  /**
   * The user's XMPP JID (may be empty).
   */
  readonly jid?: string;

  /**
   * The user's account ID.
   */
  readonly account_id: string;

  /**
   * The user's language (e.g., 'en-US').
   */
  readonly language: string;

  /**
   * The user's phone country code (may be empty).
   */
  readonly phone_country?: string;

  /**
   * The user's phone number (may be empty).
   */
  readonly phone_number?: string;

  /**
   * The user's job title (may be empty).
   */
  readonly job_title?: string;

  /**
   * The user's cost center (may be empty).
   */
  readonly cost_center?: string;

  /**
   * The user's location (may be empty).
   */
  readonly location?: string;

  /**
   * The user's login types (array of numbers).
   */
  readonly login_types: number[];

  /**
   * The user's cluster (e.g., 'us05').
   */
  readonly cluster: string;

  /**
   * The user's manager (email address).
   */
  readonly manager?: string;

  /**
   * The user's phone numbers (new format, array of objects).
   */
  readonly phone_numbers?: ZoomUserPhoneNumber[];

  /**
   * The user's pronouns.
   */
  readonly pronouns?: string;

  /**
   * The user's display pronouns setting.
   */
  readonly pronouns_option?: number;

  /**
   * The user's vanity URL (personal meeting room URL).
   */
  readonly vanity_url?: string;

  /**
   * The user's account number.
   */
  readonly account_number?: number;

  /**
   * The user's company.
   */
  readonly company?: string;

  /**
   * The user's Zoom Workplace/Zoom One plan option.
   */
  readonly zoom_one_type?: number;
}

/**
 * Represents a user's phone number object in the new phone_numbers format.
 */
export interface ZoomUserPhoneNumber {
  /**
   * The phone number's ISO country code.
   *
   * @example "US"
   */
  readonly code: string;
  /**
   * The phone number's country ID (e.g., 'US').
   *
   * @example "US"
   */
  readonly country: string;
  /**
   * The phone number's label (Mobile, Office, Home, Fax).
   *
   * @example "Mobile"
   */
  readonly label: 'Mobile' | 'Office' | 'Home' | 'Fax' | string;
  /**
   * The user's phone number.
   *
   * @example "5550100"
   */
  readonly number: string;
  /**
   * Whether Zoom has verified the phone number.
   *
   * @example true
   */
  readonly verified: boolean;
}

export type ZoomUserPersonalMeetingId = number;

export type ZoomUserRoleId = string;

export type ZoomUserStatus = 'active' | 'inactive' | 'pending';

export enum ZoomUserType {
  Basic = 1,
  Licensed = 2,
  Unassigned = 4,
  None = 99
}

/**
 * Whether the user's email address is verified.
 *
 * 1 - verified, 0 - not verified.
 */
export type ZoomUserVerified = 1 | 0;

/**
 * Custom attribute for a Zoom user.
 */
export interface ZoomUserCustomAttribute {
  /**
   * The custom attribute's unique ID.
   */
  readonly key: string;
  /**
   * The custom attribute's name.
   */
  readonly name: string;
  /**
   * The custom attribute's value.
   */
  readonly value: string;
}

/**
 * Enum for plan_united_type field.
 * See Zoom API documentation for details.
 */
export type ZoomUserPlanUnitedType = '1' | '2' | '4' | '8' | '16' | '32' | '64' | '128' | '256' | '512' | '1024' | '2048' | '4096' | '8192' | '16384' | '32768' | '65536' | '131072';
