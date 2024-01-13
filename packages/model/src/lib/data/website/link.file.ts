import { filterFalsyAndEmptyValues, type ModelTypeString, splitJoinRemainder } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { IsString, IsNotEmpty, Matches, MaxLength, IsOptional } from 'class-validator';
import { type WebsiteLink, type WebsiteLinkEncodedData, WEBSITE_LINK_ENCODED_DATA_MAX_LENGTH, WEBSITE_LINK_TYPE_MAX_LENGTH, WEBSITE_LINK_TYPE_REGEX } from './link';

/**
 * Arbitrary file link type.
 */
export type WebsiteFileLinkType = ModelTypeString;

/**
 * Max length of WebsiteLink's data type.
 */
export const WEBSITE_FILE_LINK_TYPE_MAX_LENGTH = WEBSITE_LINK_TYPE_MAX_LENGTH;

/**
 * Has the same regex as WebsiteLinkType
 */
export const WEBSITE_FILE_LINK_TYPE_REGEX = WEBSITE_LINK_TYPE_REGEX;

/**
 * WebsiteFileLink's mime type.
 */
export type WebsiteFileLinkMimeType = string;

/**
 * Max length of WebsiteLink's data type.
 */
export const WEBSITE_FILE_LINK_MIME_TYPE_MAX_LENGTH = 128;

/**
 * Default max length of WebsiteLink's data string.
 */
export const WEBSITE_FILE_LINK_MIME_TYPE_REGEX = /^\w+\/[-+.\w]+$/;

/**
 * Arbitrary name. Has no pattern restriction, but must be 128 characters or less.
 */
export type WebsiteFileLinkName = string;

/**
 * Max length of WebsiteLink's data type.
 */
export const WEBSITE_FILE_LINK_NAME_MAX_LENGTH = 128;

/**
 * WebsiteFileLink data. Typically a URL.
 */
export type WebsiteFileLinkData = string;

/**
 * Max length of WebsiteLink's data type.
 */
export const WEBSITE_FILE_LINK_DATA_MAX_LENGTH = WEBSITE_LINK_ENCODED_DATA_MAX_LENGTH - 3 - WEBSITE_FILE_LINK_TYPE_MAX_LENGTH - WEBSITE_FILE_LINK_MIME_TYPE_MAX_LENGTH - WEBSITE_FILE_LINK_NAME_MAX_LENGTH;

export const WEBSITE_FILE_LINK_DATA_REGEX = /^[^|]+$/;

/**
 * A decoded WebsiteLink that points to a file somewhere.
 */
export interface WebsiteFileLink {
  /**
   * Arbitrary file type that can be used for identification.
   */
  type?: WebsiteFileLinkType;
  /**
   * File Type, if applicable
   */
  mime?: WebsiteFileLinkMimeType;
  /**
   * Display name, if applicable.
   */
  name?: WebsiteFileLinkName;
  /**
   * Arbitrary data.
   */
  data: WebsiteFileLinkData;
}

export type EncodedWebsiteFileLink = WebsiteLinkEncodedData;

export class WebsiteFileLink {
  @Expose()
  @IsOptional()
  @IsString()
  @Matches(WEBSITE_FILE_LINK_TYPE_REGEX)
  @MaxLength(WEBSITE_LINK_TYPE_MAX_LENGTH)
  type?: WebsiteFileLinkType;

  @Expose()
  @IsOptional()
  @IsString()
  @Matches(WEBSITE_FILE_LINK_MIME_TYPE_REGEX)
  @MaxLength(WEBSITE_FILE_LINK_MIME_TYPE_MAX_LENGTH)
  mime?: WebsiteFileLinkType;

  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(WEBSITE_FILE_LINK_NAME_MAX_LENGTH)
  name?: WebsiteFileLinkName;

  @IsString()
  @IsNotEmpty()
  @Matches(WEBSITE_FILE_LINK_DATA_REGEX)
  @MaxLength(WEBSITE_FILE_LINK_DATA_MAX_LENGTH)
  data!: WebsiteFileLinkData;

  constructor(template?: WebsiteFileLink) {
    if (template != null) {
      this.type = template.type;
      this.mime = template.mime;
      this.name = template.name;
      this.data = template.data;
    }
  }
}

export const WEBSITE_FILE_LINK_WEBSITE_LINK_TYPE = 'f';

export function websiteFileLinkToWebsiteLink(input: WebsiteFileLink): WebsiteLink {
  return {
    t: WEBSITE_FILE_LINK_WEBSITE_LINK_TYPE,
    d: encodeWebsiteFileLinkToWebsiteLinkEncodedData(input)
  };
}

export function websiteLinkToWebsiteLinkFile(input: WebsiteLink): WebsiteFileLink {
  const encodedData = input.d;
  return decodeWebsiteLinkEncodedDataToWebsiteFileLink(encodedData);
}

export const WEBSITE_FILE_LINK_ENCODE_SEPARATOR = '|';

export function encodeWebsiteFileLinkToWebsiteLinkEncodedData(input: WebsiteFileLink): EncodedWebsiteFileLink {
  const encoded = [input.type, input.mime, input.data, input.name].map((x) => x || '').join(WEBSITE_FILE_LINK_ENCODE_SEPARATOR);
  return encoded;
}

export function decodeWebsiteLinkEncodedDataToWebsiteFileLink(input: EncodedWebsiteFileLink): WebsiteFileLink {
  const [type, mime, data, name] = splitJoinRemainder(input, WEBSITE_FILE_LINK_ENCODE_SEPARATOR, 4);

  return filterFalsyAndEmptyValues<WebsiteFileLink>({
    type,
    mime,
    name,
    data
  });
}
