import { isE164PhoneNumber, isE164PhoneNumberWithExtension } from '@dereekb/util';
import { type } from 'arktype';

/**
 * ArkType schema for a valid E.164 phone number without an extension.
 */
export const e164PhoneNumberType = type('string > 0').narrow((val, ctx) => isE164PhoneNumber(val, false) || ctx.mustBe('a valid E.164 phone number without an extension'));

/**
 * ArkType schema for a valid E.164 phone number, optionally with an extension.
 */
export const e164PhoneNumberWithOptionalExtensionType = type('string > 0').narrow((val, ctx) => isE164PhoneNumber(val, true) || ctx.mustBe('a valid E.164 phone number'));

/**
 * ArkType schema for a valid E.164 phone number that includes an extension.
 */
export const e164PhoneNumberWithExtensionType = type('string > 0').narrow((val, ctx) => isE164PhoneNumberWithExtension(val) || ctx.mustBe('a valid E.164 phone number with an extension'));
