import { describe, expect, it } from 'vitest';
import { type BrowserAgentBrowserType, type BrowserAgentDeviceType, type BrowserAgentInfo, type BrowserAgentOsType, type ParseBrowserAgentInfoInput, makeBrowserAgentMatchFunction, parseBrowserAgentInfo } from './agent';

const IPHONE_SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1';
const IPHONE_EDGE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/126.2592.56 Mobile/15E148 Safari/605.1.15';
const IPHONE_FIREFOX_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15';
const MAC_SAFARI_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID_PHONE_CHROME_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36';
const ANDROID_TABLET_CHROME_UA = 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Safari/537.36';
const ANDROID_SAMSUNG_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';
const WINDOWS_EDGE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.56';
const WINDOWS_CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const WINDOWS_OPERA_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 OPR/111.0.0.0';
const LINUX_FIREFOX_UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0';
const CHROMEOS_UA = 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

interface BrowserAgentTestCase {
  readonly name: string;
  readonly input: ParseBrowserAgentInfoInput;
  readonly os: BrowserAgentOsType;
  readonly browser: BrowserAgentBrowserType;
  readonly device: BrowserAgentDeviceType;
}

const TEST_CASES: BrowserAgentTestCase[] = [
  { name: 'iPhone Safari', input: { userAgent: IPHONE_SAFARI_UA }, os: 'ios', browser: 'safari', device: 'mobile' },
  { name: 'iPhone Chrome (CriOS)', input: { userAgent: IPHONE_CHROME_UA }, os: 'ios', browser: 'chrome', device: 'mobile' },
  { name: 'iPhone Edge (EdgiOS)', input: { userAgent: IPHONE_EDGE_UA }, os: 'ios', browser: 'edge', device: 'mobile' },
  { name: 'iPhone Firefox (FxiOS)', input: { userAgent: IPHONE_FIREFOX_UA }, os: 'ios', browser: 'firefox', device: 'mobile' },
  { name: 'iPad with a desktop user agent and touch points', input: { userAgent: MAC_SAFARI_UA, maxTouchPoints: 5 }, os: 'ios', browser: 'safari', device: 'tablet' },
  { name: 'Mac Safari without touch points', input: { userAgent: MAC_SAFARI_UA, maxTouchPoints: 0 }, os: 'macos', browser: 'safari', device: 'desktop' },
  { name: 'Android Chrome phone', input: { userAgent: ANDROID_PHONE_CHROME_UA }, os: 'android', browser: 'chrome', device: 'mobile' },
  { name: 'Android Chrome tablet', input: { userAgent: ANDROID_TABLET_CHROME_UA }, os: 'android', browser: 'chrome', device: 'tablet' },
  { name: 'Android Samsung Internet', input: { userAgent: ANDROID_SAMSUNG_UA }, os: 'android', browser: 'samsung', device: 'mobile' },
  { name: 'Windows Edge', input: { userAgent: WINDOWS_EDGE_UA }, os: 'windows', browser: 'edge', device: 'desktop' },
  { name: 'Windows Chrome', input: { userAgent: WINDOWS_CHROME_UA }, os: 'windows', browser: 'chrome', device: 'desktop' },
  { name: 'Windows Opera', input: { userAgent: WINDOWS_OPERA_UA }, os: 'windows', browser: 'opera', device: 'desktop' },
  { name: 'Linux Firefox', input: { userAgent: LINUX_FIREFOX_UA }, os: 'linux', browser: 'firefox', device: 'desktop' },
  { name: 'ChromeOS Chrome', input: { userAgent: CHROMEOS_UA }, os: 'chromeos', browser: 'chrome', device: 'unknown' },
  { name: 'ChromeOS Chrome with a non-mobile userAgentData hint', input: { userAgent: CHROMEOS_UA, userAgentDataMobile: false }, os: 'chromeos', browser: 'chrome', device: 'desktop' }
];

function makeBrowserAgentInfo(info: Partial<BrowserAgentInfo>): BrowserAgentInfo {
  return {
    userAgent: '',
    os: 'unknown',
    browser: 'unknown',
    device: 'unknown',
    isStandalone: false,
    ...info
  };
}

describe('parseBrowserAgentInfo()', () => {
  describe('user agents', () => {
    TEST_CASES.forEach((testCase) => {
      it(`should parse ${testCase.name}`, () => {
        const result = parseBrowserAgentInfo(testCase.input);
        expect(result.os).toBe(testCase.os);
        expect(result.browser).toBe(testCase.browser);
        expect(result.device).toBe(testCase.device);
        expect(result.userAgent).toBe(testCase.input.userAgent);
      });
    });
  });

  it('should return the raw parser names and versions', () => {
    const result = parseBrowserAgentInfo({ userAgent: WINDOWS_EDGE_UA });
    expect(result.osName).toBe('Windows');
    expect(result.browserName).toBe('Microsoft Edge');
    expect(result.browserVersion).toBe('126.0.2592.56');
  });

  it('should return all unknown values for an empty user agent without throwing', () => {
    const result = parseBrowserAgentInfo({ userAgent: '' });
    expect(result.os).toBe('unknown');
    expect(result.browser).toBe('unknown');
    expect(result.device).toBe('unknown');
    expect(result.osName).toBeUndefined();
    expect(result.browserName).toBeUndefined();
    expect(result.isStandalone).toBe(false);
  });

  it('should return unknown values for an unrecognized user agent', () => {
    const result = parseBrowserAgentInfo({ userAgent: 'foo' });
    expect(result.os).toBe('unknown');
    expect(result.browser).toBe('unknown');
    expect(result.device).toBe('unknown');
  });

  it('should fall back to the userAgentData mobile hint when the device type is unknown', () => {
    const result = parseBrowserAgentInfo({ userAgent: 'foo', userAgentDataMobile: true });
    expect(result.device).toBe('mobile');
  });

  it('should not use the userAgentData mobile hint when the device type is known', () => {
    const result = parseBrowserAgentInfo({ userAgent: WINDOWS_CHROME_UA, userAgentDataMobile: true });
    expect(result.device).toBe('desktop');
  });

  it('should pass through isStandalone', () => {
    const result = parseBrowserAgentInfo({ userAgent: IPHONE_SAFARI_UA, isStandalone: true });
    expect(result.isStandalone).toBe(true);
  });
});

describe('makeBrowserAgentMatchFunction()', () => {
  const iosSafari = makeBrowserAgentInfo({ os: 'ios', browser: 'safari', device: 'mobile' });
  const iosChrome = makeBrowserAgentInfo({ os: 'ios', browser: 'chrome', device: 'mobile' });
  const androidChrome = makeBrowserAgentInfo({ os: 'android', browser: 'chrome', device: 'tablet' });
  const windowsEdge = makeBrowserAgentInfo({ os: 'windows', browser: 'edge', device: 'desktop' });
  const iosSafariStandalone = makeBrowserAgentInfo({ os: 'ios', browser: 'safari', device: 'mobile', isStandalone: true });

  it('should match everything for an empty config', () => {
    const matchFunction = makeBrowserAgentMatchFunction({});
    expect(matchFunction(iosSafari)).toBe(true);
    expect(matchFunction(windowsEdge)).toBe(true);
  });

  it('should match a single os value', () => {
    const matchFunction = makeBrowserAgentMatchFunction({ os: 'ios' });
    expect(matchFunction(iosSafari)).toBe(true);
    expect(matchFunction(iosChrome)).toBe(true);
    expect(matchFunction(androidChrome)).toBe(false);
  });

  it('should match any value within an array (OR)', () => {
    const matchFunction = makeBrowserAgentMatchFunction({ os: ['ios', 'android'] });
    expect(matchFunction(iosSafari)).toBe(true);
    expect(matchFunction(androidChrome)).toBe(true);
    expect(matchFunction(windowsEdge)).toBe(false);
  });

  it('should require every set field to match (AND)', () => {
    const matchFunction = makeBrowserAgentMatchFunction({ os: 'ios', browser: 'safari' });
    expect(matchFunction(iosSafari)).toBe(true);
    expect(matchFunction(iosChrome)).toBe(false);
    expect(matchFunction(androidChrome)).toBe(false);
  });

  it('should match the device type', () => {
    const matchFunction = makeBrowserAgentMatchFunction({ device: ['mobile', 'tablet'] });
    expect(matchFunction(iosSafari)).toBe(true);
    expect(matchFunction(androidChrome)).toBe(true);
    expect(matchFunction(windowsEdge)).toBe(false);
  });

  it('should match the standalone flag', () => {
    const standaloneMatchFunction = makeBrowserAgentMatchFunction({ standalone: true });
    expect(standaloneMatchFunction(iosSafariStandalone)).toBe(true);
    expect(standaloneMatchFunction(iosSafari)).toBe(false);

    const notStandaloneMatchFunction = makeBrowserAgentMatchFunction({ os: 'ios', standalone: false });
    expect(notStandaloneMatchFunction(iosSafari)).toBe(true);
    expect(notStandaloneMatchFunction(iosSafariStandalone)).toBe(false);
  });

  it('should pass through a match function', () => {
    const customMatchFunction = (info: BrowserAgentInfo) => info.browser === 'edge';
    const matchFunction = makeBrowserAgentMatchFunction(customMatchFunction);
    expect(matchFunction).toBe(customMatchFunction);
    expect(matchFunction(windowsEdge)).toBe(true);
    expect(matchFunction(iosSafari)).toBe(false);
  });
});
