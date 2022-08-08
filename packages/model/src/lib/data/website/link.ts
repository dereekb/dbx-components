import { ModelTypeString } from '@dereekb/util';

export type WebsiteLinkType = ModelTypeString;

export const UNKNOWN_WEBSITE_LINK_TYPE: WebsiteLinkType = 'u';

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
