/**
 * @module twilio.diagnostic
 *
 * Read-only helpers over the Twilio Messages, Accounts, and Lookup APIs.
 *
 * These exist to answer "why did this number not get the text?" without sending anything. They are all
 * failure-tolerant: an unreachable API surfaces as an `unknown` result rather than a thrown error, so a
 * diagnostic routine can report what it could learn instead of aborting, and never mistakes an outage
 * for a problem with the number.
 */
import { type Maybe } from '@dereekb/util';
import { type TwilioApi } from './twilio.api';
import { type TwilioMessageSid, type TwilioMessageStatus, type TwilioPhoneNumber } from './twilio.type';

/**
 * The default number of messages to read back when inspecting a number's recent texts.
 */
export const DEFAULT_TWILIO_RECENT_MESSAGES_LIMIT = 20;

/**
 * The default window of history to inspect when reading a number's recent texts.
 */
export const DEFAULT_TWILIO_RECENT_MESSAGES_WINDOW_DAYS = 30;

/**
 * Twilio error codes relevant to delivery diagnosis.
 *
 * Twilio reports these on a failed or undelivered message, and on the error a rejected send throws. Twilio
 * notes that the code for a given cause may change as it improves its errors, so treat them as hints and
 * keep the error message alongside. Unknown codes are passed through untouched.
 */
export enum TwilioMessageErrorCode {
  /**
   * The `To` number is not a valid phone number.
   */
  INVALID_TO_NUMBER = 21211,
  /**
   * The recipient replied STOP, so the sender may not text them until they reply START.
   */
  UNSUBSCRIBED_RECIPIENT = 21610,
  /**
   * The `To` number is not a mobile number, so it cannot receive texts.
   */
  NOT_A_MOBILE_NUMBER = 21614,
  /**
   * The account's message queue overflowed. Temporary.
   */
  QUEUE_OVERFLOW = 30001,
  /**
   * The Twilio account is suspended.
   */
  ACCOUNT_SUSPENDED = 30002,
  /**
   * The phone is switched off or out of coverage. Usually temporary.
   */
  UNREACHABLE_DESTINATION_HANDSET = 30003,
  /**
   * The carrier or the phone blocked the message.
   */
  MESSAGE_BLOCKED = 30004,
  /**
   * The number does not exist or is no longer in service.
   */
  UNKNOWN_DESTINATION_HANDSET = 30005,
  /**
   * The number is a landline, or its carrier cannot receive texts.
   */
  LANDLINE_OR_UNREACHABLE_CARRIER = 30006,
  /**
   * The carrier filtered the message, usually as suspected spam.
   */
  MESSAGE_FILTERED = 30007,
  /**
   * Twilio could not determine why the message failed. Often temporary.
   */
  UNKNOWN_ERROR = 30008,
  /**
   * The sending number is not registered for A2P 10DLC messaging, so US carriers block it.
   */
  UNREGISTERED_NUMBER = 30034
}

/**
 * A message as read back for diagnosis.
 */
export interface TwilioDiagnosticMessage {
  readonly sid: TwilioMessageSid;
  readonly status: TwilioMessageStatus;
  readonly to: string;
  /**
   * Set when the message failed or was not delivered. See {@link TwilioMessageErrorCode}.
   */
  readonly errorCode?: Maybe<number>;
  /**
   * Twilio's description of `errorCode`.
   */
  readonly errorMessage?: Maybe<string>;
  /**
   * When the message was sent. Unset while it is still queued.
   */
  readonly dateSent?: Maybe<Date>;
  readonly dateCreated?: Maybe<Date>;
  /**
   * When the message's status last changed.
   */
  readonly dateUpdated?: Maybe<Date>;
}

/**
 * The fields of a Twilio message instance that {@link twilioDiagnosticMessage} reads.
 */
export interface TwilioDiagnosticMessageInput {
  readonly sid: string;
  readonly status: string;
  readonly to: string;
  readonly errorCode?: Maybe<number>;
  readonly errorMessage?: Maybe<string>;
  readonly dateSent?: Maybe<Date>;
  readonly dateCreated?: Maybe<Date>;
  readonly dateUpdated?: Maybe<Date>;
}

/**
 * Converts a Twilio message instance to a {@link TwilioDiagnosticMessage}.
 *
 * @param message - The message instance.
 * @returns The diagnostic message.
 */
export function twilioDiagnosticMessage(message: TwilioDiagnosticMessageInput): TwilioDiagnosticMessage {
  const { sid, status, to, errorCode, errorMessage, dateSent, dateCreated, dateUpdated } = message;
  return { sid, status: status as TwilioMessageStatus, to, errorCode: errorCode ?? undefined, errorMessage: errorMessage || undefined, dateSent: dateSent ?? undefined, dateCreated: dateCreated ?? undefined, dateUpdated: dateUpdated ?? undefined };
}

/**
 * Returns the time a message last changed state: its update time, falling back to its send and creation times.
 *
 * @param message - The message.
 * @returns The time, if Twilio recorded any.
 */
export function twilioDiagnosticMessageDate(message: TwilioDiagnosticMessage): Maybe<Date> {
  return message.dateUpdated ?? message.dateSent ?? message.dateCreated;
}

/**
 * Returns the Twilio error code of a thrown Twilio error, such as the error a rejected send throws.
 *
 * @param error - The thrown value.
 * @returns The error code, if the error carries one.
 */
export function twilioErrorCode(error: unknown): Maybe<number> {
  const code = (error as Maybe<{ readonly code?: unknown }>)?.code;
  return typeof code === 'number' ? code : undefined;
}

/**
 * Returns the HTTP status of a thrown Twilio error.
 *
 * @param error - The thrown value.
 * @returns The HTTP status, if the error carries one.
 */
export function twilioErrorStatus(error: unknown): Maybe<number> {
  const status = (error as Maybe<{ readonly status?: unknown }>)?.status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * Why a diagnostic read could not be made.
 */
export interface TwilioDiagnosticError {
  /**
   * The error message.
   */
  readonly message: string;
  /**
   * The HTTP status Twilio responded with, if it responded. 401 and 403 mean the credentials were refused, or are not
   * allowed to read the resource, such as a Standard API key reading the account.
   */
  readonly status?: Maybe<number>;
  /**
   * Twilio's error code, if it gave one.
   */
  readonly code?: Maybe<number>;
}

/**
 * Converts a thrown value to a {@link TwilioDiagnosticError}.
 *
 * @param error - The thrown value.
 * @returns The diagnostic error.
 */
export function twilioDiagnosticError(error: unknown): TwilioDiagnosticError {
  return { message: error instanceof Error ? error.message : String(error), status: twilioErrorStatus(error), code: twilioErrorCode(error) };
}

/**
 * Whether a diagnostic read was refused because of the credentials, rather than failing to reach Twilio.
 *
 * @param error - The read's error, if it failed.
 * @returns True if Twilio answered with 401 or 403.
 */
export function isTwilioDiagnosticPermissionError(error: Maybe<TwilioDiagnosticError>): boolean {
  return error?.status === 401 || error?.status === 403;
}

// MARK: Messages
/**
 * Options for {@link twilioRecentMessagesForRecipient}.
 */
export interface TwilioRecentMessagesForRecipientOptions {
  /**
   * The maximum number of messages to read back. Defaults to {@link DEFAULT_TWILIO_RECENT_MESSAGES_LIMIT}.
   */
  readonly limit?: Maybe<number>;
  /**
   * Only read back messages sent after this time.
   */
  readonly dateSentAfter?: Maybe<Date>;
}

/**
 * Result of {@link twilioRecentMessagesForRecipient}.
 */
export interface TwilioRecentMessagesForRecipientResult {
  /**
   * The messages sent to the number, newest first. Empty when none were found or they could not be read.
   */
  readonly messages: TwilioDiagnosticMessage[];
  /**
   * True if the messages could not be read.
   */
  readonly unknown?: Maybe<boolean>;
  /**
   * Why the messages could not be read.
   */
  readonly error?: Maybe<TwilioDiagnosticError>;
}

/**
 * Reads the messages recently sent to a number, newest first.
 *
 * @param api - The Twilio API.
 * @param to - The number the messages were sent to.
 * @param options - How many messages to read, and how far back.
 * @returns The messages, with `unknown` set if they could not be read.
 */
export async function twilioRecentMessagesForRecipient(api: TwilioApi, to: TwilioPhoneNumber, options?: Maybe<TwilioRecentMessagesForRecipientOptions>): Promise<TwilioRecentMessagesForRecipientResult> {
  const limit = options?.limit ?? DEFAULT_TWILIO_RECENT_MESSAGES_LIMIT;
  const dateSentAfter = options?.dateSentAfter ?? undefined;
  let result: TwilioRecentMessagesForRecipientResult;

  try {
    const messages = await api.client.messages.list({ to, limit, ...(dateSentAfter ? { dateSentAfter } : {}) });
    result = { messages: messages.map((x) => twilioDiagnosticMessage(x)) };
  } catch (e) {
    result = { messages: [], unknown: true, error: twilioDiagnosticError(e) };
  }

  return result;
}

/**
 * Result of {@link twilioMessageForSid}.
 */
export interface TwilioMessageForSidResult {
  /**
   * The message, if it exists.
   */
  readonly message?: Maybe<TwilioDiagnosticMessage>;
  /**
   * True if the message could not be read. A message that does not exist is not unknown.
   */
  readonly unknown?: Maybe<boolean>;
  /**
   * Why the message could not be read.
   */
  readonly error?: Maybe<TwilioDiagnosticError>;
}

/**
 * Reads a single message, such as a test message whose outcome is being followed.
 *
 * @param api - The Twilio API.
 * @param sid - The message SID.
 * @returns The message, with `unknown` set if it could not be read.
 */
export async function twilioMessageForSid(api: TwilioApi, sid: TwilioMessageSid): Promise<TwilioMessageForSidResult> {
  let result: TwilioMessageForSidResult;

  try {
    const message = await api.client.messages(sid).fetch();
    result = { message: twilioDiagnosticMessage(message) };
  } catch (e) {
    result = twilioErrorStatus(e) === 404 ? {} : { unknown: true, error: twilioDiagnosticError(e) };
  }

  return result;
}

// MARK: Account
/**
 * The state of the Twilio account.
 */
export interface TwilioAccountState {
  /**
   * Twilio's status for the account. `active` is healthy; `suspended` and `closed` send nothing.
   */
  readonly status?: Maybe<string>;
  /**
   * True if the state could not be read.
   */
  readonly unknown?: Maybe<boolean>;
  /**
   * Why the state could not be read.
   */
  readonly error?: Maybe<TwilioDiagnosticError>;
}

/**
 * Reads the account's state.
 *
 * Twilio does not let a Standard API key read the account, so with one this is always `unknown`, with a permission
 * error. See {@link isTwilioDiagnosticPermissionError}.
 *
 * An account that is not `active` sends nothing regardless of the recipient, so this distinguishes a system-wide
 * outage from a per-recipient problem.
 *
 * @param api - The Twilio API.
 * @returns The account's state, with `unknown` set if it could not be read.
 */
export async function twilioAccountState(api: TwilioApi): Promise<TwilioAccountState> {
  let state: TwilioAccountState;

  try {
    const account = await api.client.api.v2010.account.fetch();
    state = { status: account.status };
  } catch (e) {
    state = { unknown: true, error: twilioDiagnosticError(e) };
  }

  return state;
}

// MARK: Lookup
/**
 * Result of {@link twilioLookupPhoneNumberForDiagnosis}.
 */
export interface TwilioPhoneNumberDiagnosis {
  /**
   * Whether Twilio could resolve the number to a valid phone number. Unset when the lookup could not be made.
   */
  readonly valid?: Maybe<boolean>;
  /**
   * The line type, such as `mobile`, `landline` or `nonFixedVoip`, when it was requested and Twilio knows it.
   */
  readonly lineType?: Maybe<string>;
  /**
   * The carrier name, when the line type was requested and Twilio knows it.
   */
  readonly carrierName?: Maybe<string>;
  /**
   * True if the lookup could not be made.
   */
  readonly unknown?: Maybe<boolean>;
  /**
   * Why the lookup could not be made.
   */
  readonly error?: Maybe<TwilioDiagnosticError>;
}

/**
 * Looks up a number with Twilio Lookup v2.
 *
 * Unlike {@link TwilioLookupService.lookup}, a failed lookup is reported as `unknown` rather than as an invalid number.
 *
 * @param api - The Twilio API.
 * @param phoneNumber - The number to look up.
 * @param includeLineType - Whether to request the line type. Twilio charges per lookup for it.
 * @returns The diagnosis, with `unknown` set if the lookup could not be made.
 */
export async function twilioLookupPhoneNumberForDiagnosis(api: TwilioApi, phoneNumber: TwilioPhoneNumber, includeLineType?: Maybe<boolean>): Promise<TwilioPhoneNumberDiagnosis> {
  let result: TwilioPhoneNumberDiagnosis;

  try {
    const lookup = await api.client.lookups.v2.phoneNumbers(phoneNumber).fetch(includeLineType ? { fields: 'line_type_intelligence' } : {});
    const lineTypeIntelligence = lookup.lineTypeIntelligence as Maybe<Record<string, unknown>>;

    result = {
      valid: Boolean(lookup.valid),
      lineType: (lineTypeIntelligence?.['type'] as Maybe<string>) ?? undefined,
      carrierName: (lineTypeIntelligence?.['carrier_name'] as Maybe<string>) ?? undefined
    };
  } catch (e) {
    result = { unknown: true, error: twilioDiagnosticError(e) };
  }

  return result;
}
