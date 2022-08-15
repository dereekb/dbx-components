/**
 * Phone number string input. No format specified.
 */
export type PhoneNumber = string;

/**
 * E.164 Standardized Phone Number. Always starts with a +
 *
 * https://en.wikipedia.org/wiki/E.164
 */
export type E164PhoneNumber = `+${PhoneNumber}`;

/**
 * E164PhoneNumber regex validator.
 *
 * Requires the + to be provided.
 */
export const E164PHONE_NUMBER_REGEX = /^\+[1-9]\d{1,14}$/;
