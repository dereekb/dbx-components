import { type, type Type } from 'arktype';
import { type Maybe } from '@dereekb/util';
import { MICROSOFT_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, type UserExternalConnectionProviderType } from './userexternalconnection.id';
import { USER_EXTERNAL_CONNECTION_DATA_SELF_ITEM_KEY, type UserExternalConnectionDataItemKey, type UserExternalConnectionDataPackFileInput, type UserExternalConnectionDataTypeConfig, userExternalConnectionDataTypeConfig } from './userexternalconnection.data';

// MARK: Mail Signature
/**
 * Data type key of a Microsoft mail signature.
 */
export const MICROSOFT_MAIL_SIGNATURE_USER_EXTERNAL_CONNECTION_DATA_TYPE = 'mail_signature';

/**
 * Maximum size of one stored mail signature, in bytes of its UTF-8 JSON encoding.
 */
export const MICROSOFT_MAIL_SIGNATURE_MAX_VALUE_BYTES = 64 * 1024;

/**
 * A stored mail signature: exactly one of `html` or `text`.
 *
 * HTML images must be web (https) URLs: local files cannot travel between machines. Any UI that ever renders a
 * stored signature must sanitize the HTML first.
 */
export interface MicrosoftMailSignatureUserExternalConnectionData {
  readonly html?: Maybe<string>;
  readonly text?: Maybe<string>;
}

/**
 * The Microsoft provider's data types: data type → value shape.
 */
export interface MicrosoftUserExternalConnectionDataTypes {
  readonly mail_signature: MicrosoftMailSignatureUserExternalConnectionData;
}

/**
 * Validates a {@link MicrosoftMailSignatureUserExternalConnectionData}: an object with exactly one non-empty `html`
 * or `text` string, and no other keys.
 */
export const microsoftMailSignatureUserExternalConnectionDataValueType = /* @__PURE__ */ type({ html: 'string > 0', '+': 'reject' }).or(type({ text: 'string > 0', '+': 'reject' })) as unknown as Type<MicrosoftMailSignatureUserExternalConnectionData>;

/**
 * Loose email address check for a mail signature item key: one `@`, no whitespace, a dot in the domain.
 */
const MICROSOFT_MAIL_SIGNATURE_ADDRESS_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalizes a mail signature item key: `me` (the connection's own mailbox) or one email address, trimmed and
 * lowercased. Matches how msgraph-cli keys its local per-mailbox signatures.
 *
 * @param key - The raw key.
 * @returns The normalized key, or undefined when it is neither `me` nor an email address.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function microsoftMailSignatureItemKey(key: string): Maybe<UserExternalConnectionDataItemKey> {
  const normalized = typeof key === 'string' ? key.trim().toLowerCase() : '';
  return normalized === USER_EXTERNAL_CONNECTION_DATA_SELF_ITEM_KEY || MICROSOFT_MAIL_SIGNATURE_ADDRESS_REGEX.test(normalized) ? normalized : undefined;
}

/**
 * Whether a file name is an HTML file (`.html` / `.htm`).
 *
 * @param fileName - The file name or path.
 * @returns True for an HTML file.
 */
function isMicrosoftMailSignatureHtmlFile(fileName: string): boolean {
  return /\.html?$/i.test(fileName);
}

/**
 * Builds a mail signature value from a file: `.html` / `.htm` as `{ html }`, anything else as `{ text }`. The content
 * is trimmed. Local images are NOT embedded: reference images by web (https) URL.
 *
 * @param input - The file name and content.
 * @returns The signature value.
 */
export function microsoftMailSignatureFromFile(input: UserExternalConnectionDataPackFileInput): MicrosoftMailSignatureUserExternalConnectionData {
  const content = input.content.trim();
  return isMicrosoftMailSignatureHtmlFile(input.fileName) ? { html: content } : { text: content };
}

/**
 * Creates the mail signature data type config for an app's Microsoft provider type.
 *
 * Items are keyed by `me` (the connection's own mailbox) or a sending address (a shared or send-as mailbox).
 * msgraph-cli applies them as default signatures, below its local config and flags.
 *
 * @param providerType - The app's Microsoft provider type. Defaults to `microsoft`.
 * @returns The data type config.
 */
export function microsoftMailSignatureUserExternalConnectionDataTypeConfig(providerType: UserExternalConnectionProviderType = MICROSOFT_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE): UserExternalConnectionDataTypeConfig<MicrosoftMailSignatureUserExternalConnectionData> {
  return userExternalConnectionDataTypeConfig({
    providerType,
    dataType: MICROSOFT_MAIL_SIGNATURE_USER_EXTERNAL_CONNECTION_DATA_TYPE,
    label: 'Mail signature',
    description: 'A default signature msgraph-cli appends to mail sent from a mailbox: { html } or { text }, exactly one. HTML images must be web (https) URLs.',
    itemKeyDescription: '`me` for your own mailbox, or the sending email address of a shared or send-as mailbox',
    valueType: microsoftMailSignatureUserExternalConnectionDataValueType,
    normalizeItemKey: microsoftMailSignatureItemKey,
    packFile: microsoftMailSignatureFromFile,
    maxValueBytes: MICROSOFT_MAIL_SIGNATURE_MAX_VALUE_BYTES
  });
}
