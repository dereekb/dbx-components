import { type } from 'arktype';
import { websiteUrlType, websiteUrlWithPrefixType } from './url';

describe('websiteUrlType', () => {
  it('should pass a valid website url', () => {
    const result = websiteUrlType('dereekb.com/test');
    expect(result instanceof type.errors).toBe(false);
  });

  it('should pass a valid website url with prefix', () => {
    const result = websiteUrlType('https://dereekb.com/test/test?test=1');
    expect(result instanceof type.errors).toBe(false);
  });

  it('should not pass an invalid url', () => {
    const result = websiteUrlType('245678910');
    expect(result instanceof type.errors).toBe(true);
  });
});

describe('websiteUrlWithPrefixType', () => {
  it('should not pass a url without prefix', () => {
    const result = websiteUrlWithPrefixType('dereekb.com/test');
    expect(result instanceof type.errors).toBe(true);
  });

  it('should pass a valid website url with prefix', () => {
    const result = websiteUrlWithPrefixType('https://dereekb.com/test/test?test=1');
    expect(result instanceof type.errors).toBe(false);
  });

  it('should not pass an invalid url', () => {
    const result = websiteUrlWithPrefixType('245678910');
    expect(result instanceof type.errors).toBe(true);
  });
});
