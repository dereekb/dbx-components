import { isE164PhoneNumber, isE164PhoneNumberWithExtension } from '@dereekb/util';
import { type } from 'arktype';

/**
 * ArkType schema for a valid E.164 phone number without an extension.
 *
 * @dbxUtil
 * @dbxUtilCategory validator
 * @dbxUtilKind const
 * @dbxUtilTags validator, arktype, phone, e164, string
 * @dbxUtilRelated e164-phone-number-with-optional-extension-type, e164-phone-number-with-extension-type
 *
 * @example
 * ```ts
 * type({ phone: e164PhoneNumberType });
 * ```
 */
export const e164PhoneNumberType = type('string > 0').narrow((val, ctx) => (val != null && isE164PhoneNumber(val, false)) || ctx.mustBe('a valid E.164 phone number without an extension'));

/**
 * ArkType schema for a valid E.164 phone number, optionally with an extension.
 *
 * @dbxUtil
 * @dbxUtilCategory validator
 * @dbxUtilKind const
 * @dbxUtilTags validator, arktype, phone, e164, extension, string
 * @dbxUtilRelated e164-phone-number-type, e164-phone-number-with-extension-type
 *
 * @example
 * ```ts
 * type({ phone: e164PhoneNumberWithOptionalExtensionType });
 * ```
 */
export const e164PhoneNumberWithOptionalExtensionType = type('string > 0').narrow((val, ctx) => (val != null && isE164PhoneNumber(val, true)) || ctx.mustBe('a valid E.164 phone number'));

/**
 * ArkType schema for a valid E.164 phone number that includes an extension.
 *
 * @dbxUtil
 * @dbxUtilCategory validator
 * @dbxUtilKind const
 * @dbxUtilTags validator, arktype, phone, e164, extension, string
 * @dbxUtilRelated e164-phone-number-type, e164-phone-number-with-optional-extension-type
 *
 * @example
 * ```ts
 * type({ phone: e164PhoneNumberWithExtensionType });
 * ```
 */
export const e164PhoneNumberWithExtensionType = type('string > 0').narrow((val, ctx) => (val != null && isE164PhoneNumberWithExtension(val)) || ctx.mustBe('a valid E.164 phone number with an extension'));
