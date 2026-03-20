import { type E164PhoneNumberWithOptionalExtension, type MailToUrlInput, mailToUrlString, type Maybe, type PhoneNumber, telUrlString, type WebsiteUrl } from '@dereekb/util';

/**
 * Interface for elements that support a click handler callback.
 *
 * @example
 * ```ts
 * const clickable: ClickableFunction = {
 *   onClick: (event) => console.log('Element clicked', event)
 * };
 * ```
 */
export interface ClickableFunction {
  /**
   * Optional click handler invoked when the element is clicked.
   */
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

/**
 * Creates a {@link ClickableUrl} configured to open the given URL in a new browser tab (`target="_blank"`).
 *
 * @param url - The URL to open.
 * @returns A {@link ClickableUrl} with the `target` set to `'_blank'`.
 */
export function clickableUrlInNewTab(url: string | WebsiteUrl): ClickableUrl {
  return {
    url,
    target: '_blank'
  };
}

/**
 * Creates a {@link ClickableUrl} with a `mailto:` URL from the given email configuration.
 *
 * @param mailTo - The mail-to configuration (email address, subject, body, etc.).
 * @returns A {@link ClickableUrl} with the URL set to a `mailto:` link.
 *
 * @see {@link mailToUrlString}
 */
export function clickableUrlMailTo(mailTo: MailToUrlInput): ClickableUrl {
  return {
    url: mailToUrlString(mailTo)
  };
}

/**
 * Creates a {@link ClickableUrl} with a `tel:` URL from the given phone number.
 *
 * @param tel - The phone number to create a tel link for.
 * @returns A {@link ClickableUrl} with the URL set to a `tel:` link.
 *
 * @see {@link telUrlString}
 */
export function clickableUrlTel(tel: PhoneNumber | E164PhoneNumberWithOptionalExtension): ClickableUrl {
  return {
    url: telUrlString(tel)
  };
}
