import { uniqueCaseInsensitiveStrings } from '../array';
import { websiteDomainAndPathPairFromWebsiteUrl } from '../string/url';
import { type EmailAddress } from './email';

/**
 * Domain name portion of an email address (e.g., "example.com").
 */
export type EmailAddressDomain = string;

/**
 * Extracts unique domain names from a list of email addresses (case-insensitive).
 *
 * @param addresses - Array of email addresses to extract domains from
 * @returns Array of unique lowercase domain strings
 */
export function readDomainsFromEmailAddresses(addresses: EmailAddress[]): EmailAddressDomain[] {
  return uniqueCaseInsensitiveStrings(addresses.map(readDomainFromEmailAddress));
}

/**
 * Extracts the domain portion from a single email address.
 *
 * @param address - The email address to extract the domain from
 * @returns The lowercase domain string
 */
export function readDomainFromEmailAddress(address: EmailAddress): EmailAddressDomain {
  const split = address.split('@');
  const domain = split[1];
  return domain.toLowerCase();
}

/**
 * Reads a domain from various input formats including URLs, email addresses, and raw domains.
 *
 * Supported formats:
 * - A url: www.test.com
 * - A url with the protocol (://): https://www.test.com
 * - An email address: test@test.com
 * - A domain: test.com
 *
 * The "www." prefix is stripped from URL-style inputs since emails typically don't use it.
 *
 * @param urlLikeInput - A URL, email address, or domain string
 * @returns The extracted domain
 */
export function readEmailDomainFromUrlOrEmailAddress(urlLikeInput: string | EmailAddress | EmailAddressDomain): EmailAddressDomain {
  const emailSplit = urlLikeInput.split('@');
  const url = emailSplit[emailSplit.length - 1];

  let domain;

  if (emailSplit.length > 1) {
    domain = url;
  } else {
    domain = websiteDomainAndPathPairFromWebsiteUrl(url).domain;

    // strip out www. if it is provided, as it is a 'special' domain type,
    // and emails probably don't come from there.
    if (domain.startsWith('www')) {
      domain = domain.split('www.', 2)[1];
    }
  }

  return domain;
}
