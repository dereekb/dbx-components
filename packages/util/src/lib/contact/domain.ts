import { uniqueCaseInsensitiveStrings } from '../array';
import { websiteDomainAndPathPairFromWebsiteUrl } from '../string/url';
import { type EmailAddress } from './email';

export type EmailAddressDomain = string; // Domain name of an email address.

export function readDomainsFromEmailAddresses(addresses: EmailAddress[]): EmailAddressDomain[] {
  return uniqueCaseInsensitiveStrings(addresses.map(readDomainFromEmailAddress));
}

export function readDomainFromEmailAddress(address: EmailAddress): EmailAddressDomain {
  const split = address.split('@');
  const domain = split[1];
  return domain.toLowerCase();
}

/**
 * Reads a domain from the input that can be formatted as
 *
 * - A url: www.test.com,
 * - A url with the protocol (://): https://www.test.com
 * - An email address: test@test.com
 * - A domain: test.com
 *
 * @param urlLikeInput
 * @returns The domain
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
