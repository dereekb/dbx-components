import { isolateWebsitePathFunction, hasWebsiteDomain, removeHttpFromUrl, websiteDomainAndPathPairFromWebsiteUrl, websitePathAndQueryPair, websitePathFromWebsiteDomainAndPath, websitePathFromWebsiteUrl, fixExtraQueryParameters, removeWebProtocolPrefix, setWebProtocolPrefix, baseWebsiteUrl, websiteUrlFromPaths, isWebsiteUrlWithPrefix, isWebsiteUrl, hasPortNumber, readPortNumber, readWebsiteProtocol, hasWebsiteTopLevelDomain, isStandardInternetAccessibleWebsiteUrl } from './url';

const domain = 'dereekb.com';

describe('hasWebsiteDomain()', () => {
  it('should return true for website domains', () => {
    const result = hasWebsiteDomain('dereekb.com');
    expect(result).toBe(true);
  });

  it('should return true for a website domain with a different protocol', () => {
    const result = hasWebsiteDomain('test://dereekb.com');
    expect(result).toBe(true);
  });

  it('should return true for sub-domains', () => {
    const result = hasWebsiteDomain('components.dereekb.com');
    expect(result).toBe(true);
  });

  it('should return true for website domains with http prefix', () => {
    const result = hasWebsiteDomain('https://dereekb.com');
    expect(result).toBe(true);
  });

  it('should return false for strings without a tld', () => {
    const result = hasWebsiteDomain('dereekb');
    expect(result).toBe(false);
  });
});

describe('hasWebsiteTopLevelDomain()', () => {
  it('should return true for a website domain with a tld', () => {
    const result = hasWebsiteTopLevelDomain('dereekb.com');
    expect(result).toBe(true);
  });

  it('should return true for a website domain with a tld and port number', () => {
    const result = hasWebsiteTopLevelDomain('dereekb.com:8080');
    expect(result).toBe(true);
  });

  it('should return true for a website domain with a tld and port number and route', () => {
    const result = hasWebsiteTopLevelDomain('dereekb.com:8080/a/b/c');
    expect(result).toBe(true);
  });

  it('should return true for a website domain with a tld and port number and route and http prefix', () => {
    const result = hasWebsiteTopLevelDomain('http://dereekb.com:8080/a/b/c');
    expect(result).toBe(true);
  });

  it('should return false an invalid domain input', () => {
    const result = hasWebsiteTopLevelDomain('dereekb test.com test');
    expect(result).toBe(false);
  });

  it('should return true for a website domain with a two string tld', () => {
    const result = hasWebsiteTopLevelDomain('test.au.tz');
    expect(result).toBe(true);
  });

  it('should return false for localhost', () => {
    const result = hasWebsiteTopLevelDomain('localhost');
    expect(result).toBe(false);
  });

  it('should return false for localhost witha  port', () => {
    const result = hasWebsiteTopLevelDomain('localhost:8080');
    expect(result).toBe(false);
  });
});

describe('hasPortNumber()', () => {
  it('should return false for urls without a port number', () => {
    const result = hasPortNumber('dereekb.com');
    expect(result).toBe(false);
  });

  it('should return true for domains with a port number', () => {
    const result = hasPortNumber('dereekb.com:8080');
    expect(result).toBe(true);
  });

  it('should return true for domains with a two number port number', () => {
    const result = hasPortNumber('dereekb.com:80');
    expect(result).toBe(true);
  });

  it('should return true for domains with a six number port number', () => {
    const result = hasPortNumber('dereekb.com:808080');
    expect(result).toBe(true);
  });

  it('should return true for website domains with http prefix and a port number', () => {
    const result = hasPortNumber('https://dereekb.com:8080');
    expect(result).toBe(true);
  });

  it('should return true for sub-domains with a port number', () => {
    const result = hasPortNumber('components.dereekb.com:8080');
    expect(result).toBe(true);
  });
});

describe('readPortNumber()', () => {
  it('should read the port number', () => {
    const expectedPortNumber = 8080;
    const result = readPortNumber(`dereekb.com:${expectedPortNumber}`);
    expect(result).toBe(expectedPortNumber);
  });

  it('should return null if there is no port number', () => {
    const result = readPortNumber(`dereekb.com`);
    expect(result).toBeUndefined();
  });
});

describe('baseWebsiteUrl()', () => {
  it('should return the base url from a website with http with a port number', () => {
    const expected = 'http://dereekb.com:8080/';
    const result = baseWebsiteUrl(expected);
    expect(result).toBe(expected);
  });

  it('should return the base url from a website with a port number', () => {
    const expected = 'https://dereekb.com:8080/';
    const result = baseWebsiteUrl(expected);
    expect(result).toBe(expected);
  });

  it('should return the base url from a website url', () => {
    const expected = 'https://dereekb.com';
    const result = baseWebsiteUrl(expected);
    expect(result).toBe(expected);
  });

  it('should return the base url from a website url with an ending slash', () => {
    const expected = 'https://dereekb.com/';
    const result = baseWebsiteUrl(expected);
    expect(result).toBe(expected);
  });

  it('should return the base url from a website domain', () => {
    const domain = 'dereekb.com';
    const expected = `https://${domain}`;
    const result = baseWebsiteUrl(domain);
    expect(result).toBe(expected);
  });

  it('should return the base url from a website domain with a port number', () => {
    const domain = 'dereekb.com:8080';
    const expected = `https://${domain}`;
    const result = baseWebsiteUrl(domain);
    expect(result).toBe(expected);
  });
});

describe('isWebsiteUrl()', () => {
  it('should return false for an http prefix with no domain', () => {
    expect(isWebsiteUrl('https://test')).toBe(false);
  });

  it('should return false for an non-http prefix with a valid url', () => {
    expect(isWebsiteUrl('htt://test.com')).toBe(false);
  });

  it('should return false for a string with a dot', () => {
    expect(isWebsiteUrl('dereek.')).toBe(false);
  });

  it('should return true for a valid website url without a prefix', () => {
    expect(isWebsiteUrl('dereek.com')).toBe(true);
  });

  it('should return true for a valid website url with a path and query parameters', () => {
    expect(isWebsiteUrl('dereek.com/test/hello/world?test=1')).toBe(true);
  });

  it('should return true for a valid website url with a prefix', () => {
    expect(isWebsiteUrl('https://dereek.com')).toBe(true);
  });

  it('should return true for a valid website url with a prefix and a path', () => {
    expect(isWebsiteUrl('https://dereek.com/test/hello/world')).toBe(true);
  });

  it('should return true for a valid website url with a prefix and a path and query parameters', () => {
    expect(isWebsiteUrl('https://dereek.com/test/hello/world?test=1')).toBe(true);
  });
});

describe('isWebsiteUrlWithPrefix()', () => {
  it('should return false for a valid website url without the prefix', () => {
    expect(isWebsiteUrlWithPrefix('dereek.com')).toBe(false);
  });

  it('should return true for a valid website url with a prefix', () => {
    expect(isWebsiteUrlWithPrefix('https://dereekb.com')).toBe(true);
  });
});

describe('isStandardInternetAccessibleWebsiteUrl()', () => {
  it('should return false for localhost', () => {
    expect(isStandardInternetAccessibleWebsiteUrl('localhost')).toBe(false);
  });

  it('should return false for localhost:8080', () => {
    expect(isStandardInternetAccessibleWebsiteUrl('localhost:8080')).toBe(false);
  });

  it('should return true for a website url', () => {
    expect(isStandardInternetAccessibleWebsiteUrl('dereekb.com')).toBe(true);
  });

  it('should return true for a website url with a port number', () => {
    expect(isStandardInternetAccessibleWebsiteUrl('dereekb.com:8080')).toBe(true);
  });

  it('should return true for a website url with an https prefix and port number', () => {
    expect(isStandardInternetAccessibleWebsiteUrl('https://dereekb.com:8080')).toBe(true);
  });

  it('should return false for a website url with a non-http prefix and port number', () => {
    expect(isStandardInternetAccessibleWebsiteUrl('test://dereekb.com:8080')).toBe(false);
  });
});

describe('websiteUrlFromPaths()', () => {
  it('should create a full url from a base path that has no http prefix', () => {
    const baseUrl = 'localhost:8080';
    const path = '/hello/world';

    const expected = `${baseUrl}${path}`;
    const result = websiteUrlFromPaths(baseUrl, path);
    expect(result).toBe(expected);
  });

  it('should create a full url from a base path and append a default protocol', () => {
    const defaultProtocol = 'https';
    const baseUrl = 'localhost:8080';
    const path = '/hello/world';

    const expected = setWebProtocolPrefix(`${baseUrl}${path}`, defaultProtocol);
    const result = websiteUrlFromPaths(baseUrl, path, defaultProtocol);
    expect(result).toBe(expected);
  });

  it('should create a full url from a base path', () => {
    const baseUrl = 'https://localhost:8080';
    const path = '/hello/world';

    const expected = `${baseUrl}${path}`;
    const result = websiteUrlFromPaths(baseUrl, path);
    expect(result).toBe(expected);
  });

  it('should create a full url from a base path and retain http', () => {
    const baseUrl = 'http://localhost:8080';
    const path = '/hello/world';

    const expected = `${baseUrl}${path}`;
    const result = websiteUrlFromPaths(baseUrl, path);
    expect(result).toBe(expected);
  });

  it('should create a full url from a base path', () => {
    const baseUrl = 'https://dereekb.com';
    const path = '/hello/world';

    const expected = `${baseUrl}${path}`;
    const result = websiteUrlFromPaths(baseUrl, path);
    expect(result).toBe(expected);
  });

  it('should create a full url from a base path with a slash', () => {
    const baseUrl = 'https://dereekb.com';
    const path = '/hello/world';

    const expected = `${baseUrl}${path}`;
    const result = websiteUrlFromPaths(baseUrl + '/', path);
    expect(result).toBe(expected);
  });
});

describe('isolateWebsitePathFunction()', () => {
  describe('function', () => {
    const pathInner = '/hello/world';
    const basePath = '/test';
    const path = `${basePath}${pathInner}`;
    const fullUrl = `https://${domain}${path}`;

    const isolateFn = isolateWebsitePathFunction();

    it('should isolate the path from the input', () => {
      const result = isolateFn(fullUrl);
      expect(result).toBe(path);
    });

    it('should retain any query parameters', () => {
      const query = '?test=true';
      const result = isolateFn(fullUrl + query);
      expect(result).toBe(path + query);
    });

    describe('ignoredBasePath', () => {
      const isolateFn = isolateWebsitePathFunction({
        ignoredBasePath: 'test'
      });

      it('should isolate the path from the input without the base path', () => {
        const result = isolateFn(fullUrl);
        expect(result).toBe(pathInner);
      });
    });

    describe('removeQueryParameters', () => {
      const isolateFn = isolateWebsitePathFunction({
        removeQueryParameters: true
      });

      it('should isolate the path from the input without the query parameters', () => {
        const result = isolateFn(fullUrl + '?test=true');
        expect(result).toBe(path);
      });
    });

    describe('isolatePathComponents', () => {
      const isolateFn = isolateWebsitePathFunction({
        isolatePathComponents: 0 // keep only the first path part (/test)
      });

      it('should isolate the path from the input without the query parameters', () => {
        const query = '?test=true';
        const result = isolateFn(fullUrl + query);
        expect(result).toBe(`${basePath}/${query}`);
      });

      describe('removeTrailingSlash=true', () => {
        const isolateFn = isolateWebsitePathFunction({
          removeTrailingSlash: true,
          isolatePathComponents: 0 // keep only the first path part (/test)
        });

        it('should isolate the path from the input without the query parameters and remove the trailing slash', () => {
          const query = '?test=true';
          const result = isolateFn(fullUrl + query);
          expect(result).toBe(`${basePath}${query}`);
        });
      });
    });
  });
});

describe('websitePathAndQueryPair()', () => {
  it('should return the website path from the input url', () => {
    const path = '/test/hello/world';
    const query = '?hello=world';

    const result = websitePathAndQueryPair(`${path}${query}`);
    expect(result.path).toBe(path);
    expect(result.query).toBe(query);
  });

  it('should return the website path from the input url (no query)', () => {
    const path = '/test/hello/world';

    const result = websitePathAndQueryPair(`${path}`);
    expect(result.path).toBe(path);
    expect(result.query).not.toBeDefined();
  });
});

describe('fixExtraQueryParameters()', () => {
  it('should replace any extra query parameters', () => {
    const path = '/test/hello/world';
    const query = 'hello=world';

    const input = path + '?' + query + '&' + query + '?' + query + '?' + query;
    const expected = path + '?' + query + '&' + query + '&' + query + '&' + query;

    const result = fixExtraQueryParameters(input);
    expect(result).toBe(expected);
  });
});

describe('websitePathFromWebsiteUrl()', () => {
  it('should return the website path from the input url', () => {
    const path = '/test/hello/world';
    const result = websitePathFromWebsiteUrl(`https://${domain}${path}`);
    expect(result).toBe(path);
  });
});

describe('websiteDomainAndPathPairFromWebsiteUrl()', () => {
  it('should return the website path from the input url', () => {
    const path = '/test/hello/world';
    const result = websiteDomainAndPathPairFromWebsiteUrl(`https://${domain}${path}`);
    expect(result.domain).toBe(domain);
    expect(result.path).toBe(path);
  });
});

describe('websitePathFromWebsiteDomainAndPath()', () => {
  it('should return the website path from the domain', () => {
    const path = '/test/hello/world';
    const result = websitePathFromWebsiteDomainAndPath(`${domain}${path}`);
    expect(result).toBe(path);
  });

  it('should return only a slash if the input is a domain', () => {
    const result = websitePathFromWebsiteDomainAndPath(domain);
    expect(result).toBe('/');
  });
});

describe('readWebProtocol()', () => {
  const domain = 'dereekb.com';

  it('should return http:// from the string with http://', () => {
    const expectedProtocol = `http`;

    const input = setWebProtocolPrefix(domain, expectedProtocol);
    expect(input).toBe(`${expectedProtocol}://${domain}`);

    const protocol = readWebsiteProtocol(input);
    expect(protocol).toBe(expectedProtocol);
  });
});

describe('setWebProtocolPrefix()', () => {
  const domain = 'dereekb.com';

  it('should replace http:// from the string with https://', () => {
    const result = setWebProtocolPrefix(`http://${domain}`, 'https');
    expect(result).toBe(`https://${domain}`);
  });

  it('should remove http:// from the string with http://', () => {
    const result = setWebProtocolPrefix(`http://${domain}`);
    expect(result).toBe(domain);
  });
});

describe('removeWebProtocolPrefix()', () => {
  const domain = 'dereekb.com';

  it('should remove http:// from the string', () => {
    const result = removeWebProtocolPrefix(`http://${domain}`);
    expect(result).toBe(domain);
  });

  it('should remove https:// from the string', () => {
    const result = removeWebProtocolPrefix(`https://${domain}`);
    expect(result).toBe(domain);
  });

  it('should remove file:// from the string', () => {
    const result = removeWebProtocolPrefix(`file://${domain}`);
    expect(result).toBe(domain);
  });
});

describe('removeHttpFromUrl()', () => {
  const domain = 'dereekb.com';

  it('should remove http:// from the string', () => {
    const result = removeHttpFromUrl(`http://${domain}`);
    expect(result).toBe(domain);
  });

  it('should remove https:// from the string', () => {
    const result = removeHttpFromUrl(`https://${domain}`);
    expect(result).toBe(domain);
  });
});
