import { isValidWebsiteLinkType, WEBSITE_LINK_TYPE_REGEX } from './link';

describe('isValidWebsiteLinkType()', () => {
  it('should return true for a valid short type', () => {
    expect(isValidWebsiteLinkType('fb')).toBe(true);
  });

  it('should return true for a single character type', () => {
    expect(isValidWebsiteLinkType('w')).toBe(true);
  });

  it('should return true for alphanumeric types', () => {
    expect(isValidWebsiteLinkType('abc123')).toBe(true);
  });

  it('should return false for an empty string', () => {
    expect(isValidWebsiteLinkType('')).toBe(false);
  });

  it('should return false for strings with hyphens', () => {
    expect(isValidWebsiteLinkType('a-b')).toBe(false);
  });

  it('should return false for strings with spaces', () => {
    expect(isValidWebsiteLinkType('a b')).toBe(false);
  });

  it('should return false for strings exceeding max length', () => {
    const longString = 'a'.repeat(33);
    expect(isValidWebsiteLinkType(longString)).toBe(false);
  });

  it('should return true for strings at max length', () => {
    const maxString = 'a'.repeat(32);
    expect(isValidWebsiteLinkType(maxString)).toBe(true);
  });
});
