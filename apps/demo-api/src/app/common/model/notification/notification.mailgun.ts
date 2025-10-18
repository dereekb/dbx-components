import { type WebsiteUrl } from '@dereekb/util';

/**
 * Basic example template data that corresponds with a corresponding template on Mailgun.
 */
export interface DemoMailgunBasicTemplateData {
  /**
   * Email title
   */
  title?: string;
  /**
   * First line of text
   */
  line1: string;
  /**
   * Button Text
   */
  text: string;
  /**
   * Action URL
   */
  url: WebsiteUrl;
}
