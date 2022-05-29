import { urlWithoutParameters } from './url';

describe('urlWithoutParameters()', () => {
  const testUrl = 'https://test.com:1234';

  it('should remove query parameters from a url', () => {
    const url = `${testUrl}?test=true`;
    const result = urlWithoutParameters(url);
    expect(result).toBe(testUrl);
  });

  it('should remove query and hashbang parameters from a url', () => {
    const url = `${testUrl}#test?test=true`;
    const result = urlWithoutParameters(url);
    expect(result).toBe(testUrl);
  });

  it('should remove hashbang parameters from a url', () => {
    const url = `${testUrl}#test`;
    const result = urlWithoutParameters(url);
    expect(result).toBe(testUrl);
  });
});
