import { type Maybe, type HexColorCode } from '@dereekb/util';
import { type ZohoCrmChangeObjectDetails } from './crm';

/**
 * Unique identifier for a CRM tag.
 */
export type ZohoCrmTagId = string;

/**
 * Name of a tag.
 *
 * Max length of 25 characters.
 */
export type ZohoCrmTagName = string;

/**
 * Maximum length of ZohoCrmTagName
 */
export const ZOHO_CRM_TAG_NAME_MAX_LENGTH = 25;

/**
 * Hex color code of a tag
 */
export type ZohoCrmTagColorCode = HexColorCode;

/**
 * The color and name of a Tag in Zoho Crm.
 */
export interface ZohoCrmTagData {
  readonly color_code?: Maybe<ZohoCrmTagColorCode>;
  readonly name: ZohoCrmTagName;
}

/**
 * Includes the id of the Tag along with other tag data.
 */
export interface ZohoCrmTag extends ZohoCrmTagData {
  readonly id: ZohoCrmTagId;
}

/**
 * ZohoCrmTag that also has ZohoCrmChangeObjectDetails
 */
export type ZohoCrmTagWithObjectDetails = ZohoCrmTag & ZohoCrmChangeObjectDetails;

/**
 * A record that may contain a Tag value.
 */
export interface ZohoCrmTagArrayRef {
  Tag?: Maybe<ZohoCrmTag[]>;
}
