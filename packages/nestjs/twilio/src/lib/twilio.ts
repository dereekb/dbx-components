import { ISO8601DateString } from "@dereekb/util";
import { ConversationContext } from "twilio/lib/rest/conversations/v1/conversation";

/**
 * JWT access token to Twilio services.
 */
export type TwilioUserAccessToken = string;

/**
 * Conversation identifier.
 */
export type TwilioConversationSid = string;

/**
 * Message identifier
 */
export type TwilioMessageSid = string;

/**
 * Messaging service identifier.
 */
export type TwilioMessagingServiceSid = string;

/**
 * Twilio account identifier.
 */
export type TwilioAccountSid = string;

/**
 * Participant identifier.
 */
export type TwilioParticipantSid = string;

export type TwilioIdentity = string;

export interface AbstractTwilioResource {
  date_created: ISO8601DateString;
  date_updated: ISO8601DateString;
}

/**
 * Twilio conversation.
 * 
 * https://www.twilio.com/docs/conversations/api/conversation-resource#create-a-conversation-resource
 */
export interface TwilioConversation extends AbstractTwilioResource, ConversationContext {
  sid: TwilioConversationSid;
  account_sid: TwilioAccountSid;
  friendly_name: string;
  unique_name: string;
  timers: {
    date_inactive: ISO8601DateString;
    date_closed: ISO8601DateString;
  }
}

export interface TwilioParticipant extends AbstractTwilioResource {
  sid: TwilioParticipantSid;
  identity: TwilioIdentity;
  attributes: any;
  message_binding: any;
  role_sid: string;
}
