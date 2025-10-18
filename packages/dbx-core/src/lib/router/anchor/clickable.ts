import { type E164PhoneNumberWithOptionalExtension, type MailToUrlInput, mailToUrlString, type Maybe, type PhoneNumber, telUrlString, type WebsiteUrl } from '@dereekb/util';

export interface ClickableFunction {
  readonly onClick?: (event?: Maybe<MouseEvent>) => void;
}

/**
 * Represents a clickable href/url configuration.
 */
export interface ClickableUrl {
  /**
   * href url
   */
  readonly url?: string;
  /**
   * href target attribute.
   */
  readonly target?: string;
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

export function clickableUrlTel(tel: PhoneNumber | E164PhoneNumberWithOptionalExtension): ClickableUrl {
  return {
    url: telUrlString(tel)
  };
}
