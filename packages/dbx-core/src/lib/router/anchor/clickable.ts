import { MailToUrlInput, mailToUrlString, Maybe, PhoneNumber, telUrlString, WebsiteUrl } from '@dereekb/util';

export interface ClickableFunction {
  onClick?: (event?: Maybe<MouseEvent>) => void;
}

/**
 * Represents a clickable href/url configuration.
 */
export interface ClickableUrl {
  /**
   * href url
   */
  url?: string;
  /**
   * href target attribute.
   */
  target?: string;
}

export function clickableUrlInNewTab(url: string | WebsiteUrl): ClickableUrl {
  return {
    url,
    target: '_blank'
  };
}

export function clickableUrlMailTo(mailTo: MailToUrlInput): ClickableUrl {
  return {
    url: mailToUrlString(mailTo)
  };
}

export function clickableUrlTel(tel: PhoneNumber): ClickableUrl {
  return {
    url: telUrlString(tel)
  };
}
