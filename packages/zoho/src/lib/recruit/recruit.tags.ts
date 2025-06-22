import { HexColorCode } from '@dereekb/util';
import { ZohoRecruitChangeObjectDetails } from './recruit';

export type ZohoRecruitTagId = string;

/**
 * Name of a tag.
 *
 * Max length of 25 characters.
 */
export type ZohoRecruitTagName = string;

/**
 * Maximum length of ZohoRecruitTagName
 */
export const ZOHO_RECRUIT_TAG_NAME_MAX_LENGTH = 25;

/**
 * Hex color code of a tag
 */
export type ZohoRecruitTagColorCode = HexColorCode;

/**
 * The color and name of a Tag in Zoho Recruit.
 */
export interface ZohoRecruitTagData {
  color_code: ZohoRecruitTagColorCode;
  name: ZohoRecruitTagName;
}

/**
 * Includes the id of the Tag along with other tag data.
 */
export interface ZohoRecruitTag extends ZohoRecruitTagData {
  id: ZohoRecruitTagId;
}

/**
 * ZohoRecruitTag that also has ZohoRecruitChangeObjectDetails
 */
export type ZohoRecruitTagWithObjectDetails = ZohoRecruitTag & ZohoRecruitChangeObjectDetails;
