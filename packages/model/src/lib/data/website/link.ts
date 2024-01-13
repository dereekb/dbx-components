import { type ModelTypeString } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export type WebsiteLinkType = ModelTypeString;

export const UNKNOWN_WEBSITE_LINK_TYPE: WebsiteLinkType = 'u';

/**
 * Max length of WebsiteLink's data type.
 */
export const WEBSITE_LINK_TYPE_MAX_LENGTH = 32;

/**
 * Alpha-numeric type between 1 and 32 characters only allowed.
 */
export const WEBSITE_LINK_TYPE_REGEX = /^[a-zA-Z0-9]{1,32}$/;

export function isValidWebsiteLinkType(input: string): input is WebsiteLinkType {
  return WEBSITE_LINK_TYPE_REGEX.test(input);
}

export type WebsiteLinkEncodedData = string;

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
 * Default max length of WebsiteLink's data string.
 */
export const WEBSITE_LINK_ENCODED_DATA_MAX_LENGTH = 1000;

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
