import { type ModelTypeString } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Short string identifier for categorizing different kinds of website links (e.g., "fb" for Facebook, "w" for generic website).
 */
export type WebsiteLinkType = ModelTypeString;

/**
 * Fallback link type used when the actual type is not known.
 */
export const UNKNOWN_WEBSITE_LINK_TYPE: WebsiteLinkType = 'u';

/**
 * Maximum character length for a {@link WebsiteLinkType} string.
 */
export const WEBSITE_LINK_TYPE_MAX_LENGTH = 32;

/**
 * Regex pattern that validates a {@link WebsiteLinkType} as 1-32 alphanumeric characters.
 */
export const WEBSITE_LINK_TYPE_REGEX = /^[a-zA-Z0-9]{1,32}$/;

/**
 * Checks whether the given string is a valid {@link WebsiteLinkType}.
 *
 * @param input - the string to validate
 * @returns true if it matches the alphanumeric 1-32 character pattern
 *
 * @example
 * ```typescript
 * isValidWebsiteLinkType('fb');    // true
 * isValidWebsiteLinkType('');      // false
 * isValidWebsiteLinkType('a-b');   // false (hyphen not allowed)
 * ```
 */
export function isValidWebsiteLinkType(input: string): input is WebsiteLinkType {
  return WEBSITE_LINK_TYPE_REGEX.test(input);
}

/**
 * Pipe-separated or raw string encoding of website link data.
 */
export type WebsiteLinkEncodedData = string;

/**
 * A compact representation of a typed link, storing a short type code and encoded data string.
 *
 * Used as the base structure for encoding social media profiles, file links, emails, and other external references.
 */
export interface WebsiteLink {
  /**
   * Type of link.
   */
  t: WebsiteLinkType;
  /**
   * Encoded website link data
   */
  d: WebsiteLinkEncodedData;
}

/**
 * Maximum character length for the encoded data string in a {@link WebsiteLink}.
 */
export const WEBSITE_LINK_ENCODED_DATA_MAX_LENGTH = 1000;

/**
 * Class-validator DTO for a {@link WebsiteLink}.
 *
 * Validates the type code and encoded data fields with length and format constraints.
 *
 * @example
 * ```typescript
 * const link = new WebsiteLink({ t: 'fb', d: 'username' });
 * ```
 */
export class WebsiteLink {
  @Expose()
  @IsString()
  @IsNotEmpty()
  @Matches(WEBSITE_LINK_TYPE_REGEX)
  @MaxLength(WEBSITE_LINK_TYPE_MAX_LENGTH)
  t!: WebsiteLinkType;

  @Expose()
  @IsString()
  @IsNotEmpty()
  @MaxLength(WEBSITE_LINK_ENCODED_DATA_MAX_LENGTH)
  d!: WebsiteLinkEncodedData;

  constructor(template?: WebsiteLink) {
    if (template != null) {
      this.t = template.t;
      this.d = template.d;
    }
  }
}
