import { readEmailDomainFromUrlOrEmailAddress } from './domain';

describe('readDomainFromUrlOrEmailAddress()', () => {
  it('should read the email domain from a url', () => {
    const domain = 'dereekb.com';
    const testUrl = `https://${domain}/test/place/1`;
    const result = readEmailDomainFromUrlOrEmailAddress(testUrl);

    expect(result).toBe(domain);
  });

  it('should ignore the www in the domain', () => {
    const domain = 'dereekb.com';
    const testUrl = `https://www.${domain}/test/place/1`;
    const result = readEmailDomainFromUrlOrEmailAddress(testUrl);

    expect(result).toBe(domain);
  });
});
