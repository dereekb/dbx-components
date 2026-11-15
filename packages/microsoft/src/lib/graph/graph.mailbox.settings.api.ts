import { type Maybe } from '@dereekb/util';
import { type MicrosoftGraphRequestInput, microsoftGraphRequest } from './graph.api';
import { type MicrosoftGraphContext } from './graph.config';
import { type MicrosoftGraphDateTimeTimeZone } from './graph.type';

/**
 * Whether automatic replies are off, always on, or on within a scheduled window.
 */
export type MicrosoftGraphAutomaticRepliesStatus = 'disabled' | 'alwaysEnabled' | 'scheduled';

/**
 * Which senders outside the organization get the external reply.
 */
export type MicrosoftGraphExternalAudienceScope = 'none' | 'contactsOnly' | 'all';

/**
 * A user's automatic replies ("out of office"), as `mailboxSettings.automaticRepliesSetting`.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/resources/automaticrepliessetting
 */
export interface MicrosoftGraphAutomaticRepliesSetting {
  readonly status?: Maybe<MicrosoftGraphAutomaticRepliesStatus>;
  readonly externalAudience?: Maybe<MicrosoftGraphExternalAudienceScope>;
  /**
   * The window start. Graph uses it only when `status` is `scheduled`.
   */
  readonly scheduledStartDateTime?: Maybe<MicrosoftGraphDateTimeTimeZone>;
  readonly scheduledEndDateTime?: Maybe<MicrosoftGraphDateTimeTimeZone>;
  /**
   * The reply sent inside the organization (HTML).
   */
  readonly internalReplyMessage?: Maybe<string>;
  /**
   * The reply sent outside the organization, to the `externalAudience` (HTML).
   */
  readonly externalReplyMessage?: Maybe<string>;
}

/**
 * The fields of {@link MicrosoftGraphAutomaticRepliesSetting}, the only ones a PATCH sends.
 */
export const MICROSOFT_GRAPH_AUTOMATIC_REPLIES_SETTING_FIELDS: readonly (keyof MicrosoftGraphAutomaticRepliesSetting)[] = ['status', 'externalAudience', 'scheduledStartDateTime', 'scheduledEndDateTime', 'internalReplyMessage', 'externalReplyMessage'];

/**
 * Copies the setting fields Graph accepts in a PATCH, dropping `@odata.context` and anything else a GET
 * returned, and every field that is not set.
 *
 * @param setting - The setting, e.g. as read by {@link getAutomaticRepliesSetting}.
 * @returns The setting with only the PATCH-able fields that are set.
 */
export function microsoftGraphAutomaticRepliesSettingFields(setting: MicrosoftGraphAutomaticRepliesSetting): MicrosoftGraphAutomaticRepliesSetting {
  const result: Record<string, unknown> = {};

  MICROSOFT_GRAPH_AUTOMATIC_REPLIES_SETTING_FIELDS.forEach((field) => {
    const value = setting[field];

    if (value != null) {
      result[field] = value;
    }
  });

  return result as MicrosoftGraphAutomaticRepliesSetting;
}

/**
 * Builds the GET of the user's automatic replies.
 *
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/user-get-mailboxsettings
 */
export function microsoftGraphGetAutomaticRepliesRequest(): MicrosoftGraphRequestInput {
  return { method: 'GET', path: '/me/mailboxSettings/automaticRepliesSetting' };
}

/**
 * Builds the PATCH of `/me/mailboxSettings` that changes the user's automatic replies. Only the given fields
 * change (Graph answers 200 with the updated settings).
 *
 * @param setting - The fields to change.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/user-update-mailboxsettings
 */
export function microsoftGraphUpdateAutomaticRepliesRequest(setting: MicrosoftGraphAutomaticRepliesSetting): MicrosoftGraphRequestInput {
  return { method: 'PATCH', path: '/me/mailboxSettings', body: { automaticRepliesSetting: microsoftGraphAutomaticRepliesSettingFields(setting) } };
}

/**
 * Reads the user's automatic replies. Requires `MailboxSettings.Read`.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that loads the setting.
 */
export function getAutomaticRepliesSetting(context: MicrosoftGraphContext): () => Promise<MicrosoftGraphAutomaticRepliesSetting> {
  const request = microsoftGraphRequest(context);
  return () => request(microsoftGraphGetAutomaticRepliesRequest());
}

/**
 * Changes the user's automatic replies. Requires `MailboxSettings.ReadWrite`.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that PATCHes the setting and resolves the updated one.
 */
export function updateAutomaticRepliesSetting(context: MicrosoftGraphContext): (setting: MicrosoftGraphAutomaticRepliesSetting) => Promise<MicrosoftGraphAutomaticRepliesSetting> {
  const request = microsoftGraphRequest(context);

  return async (setting) => {
    const result = await request<{ readonly automaticRepliesSetting?: Maybe<MicrosoftGraphAutomaticRepliesSetting> }>(microsoftGraphUpdateAutomaticRepliesRequest(setting));
    return result?.automaticRepliesSetting ?? setting;
  };
}
