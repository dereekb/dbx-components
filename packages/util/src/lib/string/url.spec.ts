import {
  isolateWebsitePathFunction,
  hasWebsiteDomain,
  removeHttpFromUrl,
  websiteDomainAndPathPairFromWebsiteUrl,
  websitePathAndQueryPair,
  websitePathFromWebsiteDomainAndPath,
  websitePathFromWebsiteUrl,
  fixExtraQueryParameters,
  removeWebProtocolPrefix,
  setWebProtocolPrefix,
  baseWebsiteUrl,
  websiteUrlFromPaths,
  isWebsiteUrlWithPrefix,
  isWebsiteUrl,
  hasPortNumber,
  readPortNumber,
  readWebsiteProtocol,
  hasWebsiteTopLevelDomain,
  isStandardInternetAccessibleWebsiteUrl,
  websiteUrlDetails,
  hasUriScheme,
  readUriScheme,
  websiteUrlRelativePathFunctions
} from './url';

const domain = 'dereekb.com';
const DOMAIN = 'dereekb.com';
const HTTPS_DOMAIN = 'https://dereekb.com';

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

describe('websiteUrlDetails()', () => {
  describe('portNumber', () => {
    it('should detect a port number in a URL with a domain', () => {
      const result = websiteUrlDetails('https://dereekb.com:8080/path');
      expect(result.hasPortNumber).toBe(true);
      expect(result.portNumber).toBe(8080);
    });

    it('should detect a port number in a localhost URL', () => {
      const result = websiteUrlDetails('http://localhost:9010/demo/app/oauth');
      expect(result.hasPortNumber).toBe(true);
      expect(result.portNumber).toBe(9010);
    });

    it('should detect a port number in a URL without a prefix', () => {
      const result = websiteUrlDetails('localhost:3000');
      expect(result.hasPortNumber).toBe(true);
      expect(result.portNumber).toBe(3000);
    });

    it('should return false and undefined when no port number is present', () => {
      const result = websiteUrlDetails('https://dereekb.com/path');
      expect(result.hasPortNumber).toBe(false);
      expect(result.portNumber).toBeUndefined();
    });

    it('should return false and undefined for a plain domain', () => {
      const result = websiteUrlDetails('dereekb.com');
      expect(result.hasPortNumber).toBe(false);
      expect(result.portNumber).toBeUndefined();
    });
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

  it('should create a path from an empty base and an array of path segments', () => {
    const result = websiteUrlFromPaths('', ['/demo/oauth', '/login']);
    expect(result).toBe('/demo/oauth/login');
  });

  it('should create a full url from a base url and an array of path segments', () => {
    const baseUrl = 'http://localhost:9010';
    const result = websiteUrlFromPaths(baseUrl, ['/demo/oauth', '/login']);
    expect(result).toBe(`${baseUrl}/demo/oauth/login`);
  });

  it('should create a full url from a base url with port and a single path', () => {
    const baseUrl = 'http://localhost:9010';
    const path = '/demo/oauth/login';
    const result = websiteUrlFromPaths(baseUrl, path);
    expect(result).toBe(`${baseUrl}${path}`);
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

describe('hasUriScheme()', () => {
  it('should return true for a scheme with no authority', () => {
    expect(hasUriScheme('mailto:hello@dereekb.com')).toBe(true);
    expect(hasUriScheme('tel:+15550100')).toBe(true);
  });

  it('should return true for a scheme with an authority', () => {
    expect(hasUriScheme('https://dereekb.com')).toBe(true);
  });

  it('should return false for a bare email address or domain', () => {
    expect(hasUriScheme('hello@dereekb.com')).toBe(false);
    expect(hasUriScheme('dereekb.com/doc/home')).toBe(false);
  });

  it('should return false for a scheme that does not start with a letter', () => {
    expect(hasUriScheme('1https://dereekb.com')).toBe(false);
  });
});

describe('readUriScheme()', () => {
  it('should read the scheme without the trailing colon', () => {
    expect(readUriScheme('mailto:hello@dereekb.com')).toBe('mailto');
    expect(readUriScheme('https://dereekb.com')).toBe('https');
  });

  it('should return undefined when the input carries no scheme', () => {
    expect(readUriScheme('hello@dereekb.com')).toBeUndefined();
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

  it('should not read a "://" later in the path as part of the protocol', () => {
    expect(readWebsiteProtocol(`https://${domain}/redirect?to=ftp://other.com`)).toBe('https');
  });

  it('should return undefined when the input carries no protocol', () => {
    expect(readWebsiteProtocol(domain)).toBeUndefined();
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

describe('websiteUrlRelativePathFunctions()', () => {
  const baseUrl = 'https://linkedin.com/in/';
  const linkedIn = websiteUrlRelativePathFunctions({ baseUrl });

  it('should keep the normalized base url', () => {
    expect(linkedIn.baseUrl).toBe(baseUrl);
  });

  it('should add a trailing slash to the base url', () => {
    const github = websiteUrlRelativePathFunctions({ baseUrl: 'https://github.com' });
    expect(github.baseUrl).toBe('https://github.com/');
    expect(github.toWebsiteUrl('dereekb')).toBe('https://github.com/dereekb');
    expect(github.toRelativePath('github.com/dereekb/')).toBe('dereekb');
  });

  describe('readRelativePath()', () => {
    it('should read a relative path', () => {
      expect(linkedIn.readRelativePath('dereekb')).toEqual({ relativePath: 'dereekb', protocol: undefined, hadBaseUrl: false });
    });

    it('should read a relative path with a leading slash', () => {
      expect(linkedIn.readRelativePath('/dereekb')?.relativePath).toBe('dereekb');
    });

    it('should read a relative path that contains a period', () => {
      expect(linkedIn.readRelativePath('john.doe')?.relativePath).toBe('john.doe');
    });

    it('should trim the input', () => {
      expect(linkedIn.readRelativePath('  dereekb  ')?.relativePath).toBe('dereekb');
    });

    it('should read an empty relative path from an empty input', () => {
      expect(linkedIn.readRelativePath('')).toEqual({ relativePath: '', protocol: undefined, hadBaseUrl: false });
    });

    it('should read the relative path from a url without a protocol', () => {
      expect(linkedIn.readRelativePath('linkedin.com/in/dereekb')).toEqual({ relativePath: 'dereekb', protocol: undefined, hadBaseUrl: true });
    });

    it('should read the relative path from a url with www and a trailing slash', () => {
      expect(linkedIn.readRelativePath('www.linkedin.com/in/dereekb/')?.relativePath).toBe('dereekb');
    });

    it('should read the relative path from a full url with query parameters', () => {
      expect(linkedIn.readRelativePath('https://www.linkedin.com/in/dereekb/?trk=abc')?.relativePath).toBe('dereekb');
    });

    it('should compare the domain and base path case-insensitively', () => {
      expect(linkedIn.readRelativePath('https://WWW.LinkedIn.com/IN/Dereekb')?.relativePath).toBe('Dereekb');
    });

    it('should read an empty relative path from the base url', () => {
      expect(linkedIn.readRelativePath('https://linkedin.com/in')).toEqual({ relativePath: '', protocol: 'https', hadBaseUrl: true });
    });

    it('should return undefined for a url on the base domain with a different path', () => {
      expect(linkedIn.readRelativePath('linkedin.com/company/dereekb')).toBeUndefined();
    });

    it('should return undefined for a url on a different domain', () => {
      expect(linkedIn.readRelativePath('https://twitter.com/dereekb')).toBeUndefined();
    });

    it('should return undefined for a url on a different domain without a protocol', () => {
      expect(linkedIn.readRelativePath('twitter.com/dereekb')).toBeUndefined();
    });

    it('should return undefined for an input with a uri scheme', () => {
      expect(linkedIn.readRelativePath('mailto:dereekb')).toBeUndefined();
    });

    it('should use the base protocol for an http url when http is not allowed', () => {
      expect(linkedIn.readRelativePath('http://linkedin.com/in/dereekb')?.protocol).toBe('https');
    });

    it('should keep the http protocol when http is allowed', () => {
      const linkedInAllowHttp = websiteUrlRelativePathFunctions({ baseUrl, allowHttp: true });
      expect(linkedInAllowHttp.readRelativePath('http://linkedin.com/in/dereekb')?.protocol).toBe('http');
    });

    it('should read an empty relative path from only a protocol', () => {
      expect(linkedIn.readRelativePath('http://')).toEqual({ relativePath: '', protocol: 'https', hadBaseUrl: true });
      expect(linkedIn.readRelativePath('https://')).toEqual({ relativePath: '', protocol: 'https', hadBaseUrl: true });
    });

    it('should read the http protocol from only a protocol when http is allowed', () => {
      const linkedInAllowHttp = websiteUrlRelativePathFunctions({ baseUrl, allowHttp: true });
      expect(linkedInAllowHttp.readRelativePath('http://')).toEqual({ relativePath: '', protocol: 'http', hadBaseUrl: true });
    });

    it('should read an empty relative path from the start of the base url with a protocol', () => {
      expect(linkedIn.readRelativePath('https://www.linked')).toEqual({ relativePath: '', protocol: 'https', hadBaseUrl: true });
      expect(linkedIn.readRelativePath('https://linkedin.com')).toEqual({ relativePath: '', protocol: 'https', hadBaseUrl: true });
    });

    it('should return undefined for the start of the base url without a protocol', () => {
      expect(linkedIn.readRelativePath('linkedin.com/i')).toBeUndefined();
    });

    it('should not have a protocol for an input without a protocol', () => {
      expect(linkedIn.readRelativePath('www.linkedin.com/in/dereekb')?.protocol).toBeUndefined();
    });

    it('should keep the https protocol when the base url uses http', () => {
      const httpBase = websiteUrlRelativePathFunctions({ baseUrl: 'http://linkedin.com/in/' });
      expect(httpBase.readRelativePath('https://linkedin.com/in/dereekb')?.protocol).toBe('https');
      expect(httpBase.toWebsiteUrl('dereekb')).toBe('http://linkedin.com/in/dereekb');
    });
  });

  describe('isPartialBaseUrl()', () => {
    it('should return true for the start of the base url with a protocol', () => {
      expect(linkedIn.isPartialBaseUrl('h')).toBe(true);
      expect(linkedIn.isPartialBaseUrl('http:')).toBe(true);
      expect(linkedIn.isPartialBaseUrl('http://')).toBe(true);
      expect(linkedIn.isPartialBaseUrl('https://www.linked')).toBe(true);
      expect(linkedIn.isPartialBaseUrl('HTTPS://LinkedIn.com/in/')).toBe(true);
    });

    it('should return true for the start of the base url without a protocol', () => {
      expect(linkedIn.isPartialBaseUrl('linkedin.com/i')).toBe(true);
      expect(linkedIn.isPartialBaseUrl('www.linkedin.com/in/')).toBe(true);
    });

    it('should return false for an input that continues past the base url', () => {
      expect(linkedIn.isPartialBaseUrl('linkedin.com/in/dereekb')).toBe(false);
    });

    it('should return false for an input that is not the start of the base url', () => {
      expect(linkedIn.isPartialBaseUrl('dereekb')).toBe(false);
      expect(linkedIn.isPartialBaseUrl('https://twitter.com')).toBe(false);
    });

    it('should return false for an empty input', () => {
      expect(linkedIn.isPartialBaseUrl('')).toBe(false);
    });
  });

  describe('toBaseUrl()', () => {
    it('should return the base url for no protocol', () => {
      expect(linkedIn.toBaseUrl()).toBe(baseUrl);
    });

    it('should return the base url with the base protocol when http is not allowed', () => {
      expect(linkedIn.toBaseUrl('http')).toBe(baseUrl);
    });

    it('should return the base url with the http protocol when http is allowed', () => {
      const linkedInAllowHttp = websiteUrlRelativePathFunctions({ baseUrl, allowHttp: true });
      expect(linkedInAllowHttp.toBaseUrl('http')).toBe('http://linkedin.com/in/');
    });
  });

  describe('toWebsiteUrl()', () => {
    it('should convert a relative path to a website url', () => {
      expect(linkedIn.toWebsiteUrl('dereekb')).toBe('https://linkedin.com/in/dereekb');
    });

    it('should convert a url without a protocol to a website url', () => {
      expect(linkedIn.toWebsiteUrl('linkedin.com/in/dereekb')).toBe('https://linkedin.com/in/dereekb');
    });

    it('should canonicalize www to the base url domain', () => {
      expect(linkedIn.toWebsiteUrl('https://www.linkedin.com/in/dereekb/?trk=abc')).toBe('https://linkedin.com/in/dereekb');
    });

    it('should use the https protocol for an http url when http is not allowed', () => {
      expect(linkedIn.toWebsiteUrl('http://linkedin.com/in/dereekb')).toBe('https://linkedin.com/in/dereekb');
    });

    it('should keep the http protocol when http is allowed', () => {
      const linkedInAllowHttp = websiteUrlRelativePathFunctions({ baseUrl, allowHttp: true });
      expect(linkedInAllowHttp.toWebsiteUrl('http://www.linkedin.com/in/dereekb/')).toBe('http://linkedin.com/in/dereekb');
    });

    it('should return undefined for an empty relative path', () => {
      expect(linkedIn.toWebsiteUrl('')).toBeUndefined();
      expect(linkedIn.toWebsiteUrl('https://linkedin.com/in/')).toBeUndefined();
    });

    it('should return undefined for a url on a different domain', () => {
      expect(linkedIn.toWebsiteUrl('https://twitter.com/dereekb')).toBeUndefined();
    });
  });

  describe('toRelativePath()', () => {
    it('should convert a website url to the relative path', () => {
      expect(linkedIn.toRelativePath('https://linkedin.com/in/dereekb')).toBe('dereekb');
    });

    it('should return undefined for a url on a different domain', () => {
      expect(linkedIn.toRelativePath('https://twitter.com/dereekb')).toBeUndefined();
    });
  });
});
