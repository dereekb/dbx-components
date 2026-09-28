/* eslint-disable import-x/no-named-as-default-member -- bowser's ESM build only has a default export (the Bowser class and its statics); the named exports exist only in its typings. */
import Bowser from 'bowser';
import { type ArrayOrValue, type Maybe, convertMaybeToArray } from '@dereekb/util';
import { isStandaloneWebApp } from './standalone';

// MARK: Types
/**
 * Normalized operating system type detected from the browser agent.
 *
 * iPadOS devices that report a desktop (macOS) user agent are normalized to `ios`.
 */
export type BrowserAgentOsType = 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'chromeos' | 'unknown';

/**
 * Normalized browser type detected from the browser agent.
 *
 * On iOS, Chrome, Edge, and Firefox are reported as their own browser type even though they all use WebKit.
 */
export type BrowserAgentBrowserType = 'safari' | 'chrome' | 'firefox' | 'edge' | 'samsung' | 'opera' | 'unknown';

/**
 * Normalized device type detected from the browser agent.
 */
export type BrowserAgentDeviceType = 'mobile' | 'tablet' | 'desktop' | 'unknown';

/**
 * Normalized information about the current browser agent (operating system, browser, and device).
 */
export interface BrowserAgentInfo {
  /**
   * The raw user agent string that was parsed.
   */
  readonly userAgent: string;
  /**
   * Normalized operating system type.
   */
  readonly os: BrowserAgentOsType;
  /**
   * Raw operating system name reported by the parser, e.g. `iOS`.
   */
  readonly osName?: Maybe<string>;
  /**
   * Raw operating system version reported by the parser.
   */
  readonly osVersion?: Maybe<string>;
  /**
   * Normalized browser type.
   */
  readonly browser: BrowserAgentBrowserType;
  /**
   * Raw browser name reported by the parser, e.g. `Microsoft Edge`.
   */
  readonly browserName?: Maybe<string>;
  /**
   * Raw browser version reported by the parser.
   */
  readonly browserVersion?: Maybe<string>;
  /**
   * Normalized device type.
   */
  readonly device: BrowserAgentDeviceType;
  /**
   * Whether or not the app is running as an installed home-screen app / PWA.
   */
  readonly isStandalone: boolean;
}

// MARK: Parse
/**
 * Input for {@link parseBrowserAgentInfo}.
 */
export interface ParseBrowserAgentInfoInput {
  /**
   * The user agent string to parse. An empty string results in all `unknown` values.
   */
  readonly userAgent: string;
  /**
   * The value of `navigator.maxTouchPoints`. Used to detect iPadOS devices that report a desktop macOS user agent.
   */
  readonly maxTouchPoints?: Maybe<number>;
  /**
   * The value of `navigator.userAgentData.mobile`. Used as a fallback when the device type cannot be determined from the user agent.
   */
  readonly userAgentDataMobile?: Maybe<boolean>;
  /**
   * Whether or not the app is running as a standalone web app. Defaults to false.
   */
  readonly isStandalone?: Maybe<boolean>;
}

/**
 * Parses the input user agent (and optional navigator hints) into a normalized {@link BrowserAgentInfo}.
 *
 * Pure function that does not access any browser globals, so it can be used in Node/SSR and tests.
 *
 * iPadOS devices that report a desktop macOS user agent are detected via `maxTouchPoints > 1` and normalized to an `ios` `tablet`.
 *
 * @param input - The user agent and optional navigator hints to parse.
 * @returns The normalized browser agent info.
 *
 * @example
 * ```typescript
 * const info = parseBrowserAgentInfo({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ... Safari/604.1' });
 * // info.os === 'ios', info.browser === 'safari', info.device === 'mobile'
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function parseBrowserAgentInfo(input: ParseBrowserAgentInfoInput): BrowserAgentInfo {
  const { userAgent, maxTouchPoints, userAgentDataMobile } = input;
  const isStandalone = input.isStandalone ?? false;

  let osName: Maybe<string>;
  let osVersion: Maybe<string>;
  let browserName: Maybe<string>;
  let browserVersion: Maybe<string>;
  let os: BrowserAgentOsType = 'unknown';
  let browser: BrowserAgentBrowserType = 'unknown';
  let device: BrowserAgentDeviceType = 'unknown';

  // bowser throws on an empty user agent
  if (userAgent) {
    const parser = Bowser.getParser(userAgent);

    const rawOsName = parser.getOSName();
    const rawBrowserName = parser.getBrowserName();

    osName = rawOsName || undefined;
    osVersion = parser.getOSVersion() || undefined;
    browserName = rawBrowserName || undefined;
    browserVersion = parser.getBrowserVersion() || undefined;

    os = browserAgentOsTypeFromBowserOsName(rawOsName);
    browser = browserAgentBrowserTypeFromBowserBrowserName(rawBrowserName);
    device = browserAgentDeviceTypeFromBowserPlatformType(parser.getPlatformType());
  }

  // iPadOS reports a desktop macOS user agent, but has touch support
  if (os === 'macos' && maxTouchPoints != null && maxTouchPoints > 1) {
    os = 'ios';
    device = 'tablet';
  }

  if (device === 'unknown' && userAgentDataMobile != null) {
    device = userAgentDataMobile ? 'mobile' : 'desktop';
  }

  return {
    userAgent,
    os,
    osName,
    osVersion,
    browser,
    browserName,
    browserVersion,
    device,
    isStandalone
  };
}

function browserAgentOsTypeFromBowserOsName(osName: string): BrowserAgentOsType {
  let result: BrowserAgentOsType;

  switch (osName) {
    case Bowser.OS_MAP['iOS']:
      result = 'ios';
      break;
    case Bowser.OS_MAP['Android']:
      result = 'android';
      break;
    case Bowser.OS_MAP['Windows']:
      result = 'windows';
      break;
    case Bowser.OS_MAP['MacOS']:
      result = 'macos';
      break;
    case Bowser.OS_MAP['Linux']:
      result = 'linux';
      break;
    case Bowser.OS_MAP['ChromeOS']:
      result = 'chromeos';
      break;
    default:
      result = 'unknown';
      break;
  }

  return result;
}

function browserAgentBrowserTypeFromBowserBrowserName(browserName: string): BrowserAgentBrowserType {
  let result: BrowserAgentBrowserType;

  switch (browserName) {
    case Bowser.BROWSER_MAP['safari']:
      result = 'safari';
      break;
    case Bowser.BROWSER_MAP['chrome']:
    case Bowser.BROWSER_MAP['chromium']:
      result = 'chrome';
      break;
    case Bowser.BROWSER_MAP['firefox']:
      result = 'firefox';
      break;
    case Bowser.BROWSER_MAP['edge']:
      result = 'edge';
      break;
    case Bowser.BROWSER_MAP['samsung_internet']:
      result = 'samsung';
      break;
    case Bowser.BROWSER_MAP['opera']:
      result = 'opera';
      break;
    default:
      result = 'unknown';
      break;
  }

  return result;
}

function browserAgentDeviceTypeFromBowserPlatformType(platformType: string): BrowserAgentDeviceType {
  let result: BrowserAgentDeviceType;

  switch (platformType) {
    case Bowser.PLATFORMS_MAP['mobile']:
      result = 'mobile';
      break;
    case Bowser.PLATFORMS_MAP['tablet']:
      result = 'tablet';
      break;
    case Bowser.PLATFORMS_MAP['desktop']:
      result = 'desktop';
      break;
    default:
      result = 'unknown';
      break;
  }

  return result;
}

// MARK: Current
/**
 * The subset of `navigator.userAgentData` used by {@link getCurrentBrowserAgentInfo}.
 */
interface NavigatorUserAgentDataHint {
  readonly mobile?: Maybe<boolean>;
}

/**
 * Returns the {@link BrowserAgentInfo} for the current browser by reading `navigator`.
 *
 * Safe to call during SSR; returns all `unknown` values when `navigator` is unavailable.
 *
 * @returns The normalized browser agent info for the current browser.
 *
 * @example
 * ```typescript
 * const info = getCurrentBrowserAgentInfo();
 *
 * if (info.os === 'ios' && !info.isStandalone) {
 *   // show "Add to Home Screen" instructions
 * }
 * ```
 */
export function getCurrentBrowserAgentInfo(): BrowserAgentInfo {
  let input: ParseBrowserAgentInfoInput = { userAgent: '' };

  if (typeof navigator !== 'undefined') {
    const currentNavigator = navigator as Navigator & { readonly userAgentData?: Maybe<NavigatorUserAgentDataHint> };

    input = {
      userAgent: currentNavigator.userAgent ?? '',
      maxTouchPoints: currentNavigator.maxTouchPoints,
      userAgentDataMobile: currentNavigator.userAgentData?.mobile,
      isStandalone: isStandaloneWebApp()
    };
  }

  return parseBrowserAgentInfo(input);
}

// MARK: Match
/**
 * Config-based matcher for a {@link BrowserAgentInfo}.
 *
 * Every field that is set must match (AND). Within an array, any value matches (OR). An unset field or an empty array matches everything.
 */
export interface BrowserAgentMatchConfig {
  /**
   * Operating system type(s) to match.
   */
  readonly os?: Maybe<ArrayOrValue<BrowserAgentOsType>>;
  /**
   * Browser type(s) to match.
   */
  readonly browser?: Maybe<ArrayOrValue<BrowserAgentBrowserType>>;
  /**
   * Device type(s) to match.
   */
  readonly device?: Maybe<ArrayOrValue<BrowserAgentDeviceType>>;
  /**
   * Whether the app must (true) or must not (false) be running as a standalone web app.
   */
  readonly standalone?: Maybe<boolean>;
}

/**
 * Function that returns true if the input {@link BrowserAgentInfo} matches.
 */
export type BrowserAgentMatchFunction = (info: BrowserAgentInfo) => boolean;

/**
 * A {@link BrowserAgentMatchConfig} or a custom {@link BrowserAgentMatchFunction}.
 */
export type BrowserAgentMatch = BrowserAgentMatchConfig | BrowserAgentMatchFunction;

/**
 * Creates a {@link BrowserAgentMatchFunction} from the input {@link BrowserAgentMatch}.
 *
 * Functions are returned as-is. Configs match when every set field matches, and within an array any value matches.
 *
 * @param match - Describes which browser agents should match.
 * @returns Matcher that returns true for each browser agent info that matches.
 *
 * @example
 * ```typescript
 * const isIosSafari = makeBrowserAgentMatchFunction({ os: 'ios', browser: 'safari' });
 * const isMobile = makeBrowserAgentMatchFunction({ device: ['mobile', 'tablet'] });
 *
 * isIosSafari(getCurrentBrowserAgentInfo());
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeBrowserAgentMatchFunction(match: BrowserAgentMatch): BrowserAgentMatchFunction {
  let result: BrowserAgentMatchFunction;

  if (typeof match === 'function') {
    result = match;
  } else {
    const osTypes = new Set(convertMaybeToArray(match.os));
    const browserTypes = new Set(convertMaybeToArray(match.browser));
    const deviceTypes = new Set(convertMaybeToArray(match.device));
    const { standalone } = match;

    result = (info: BrowserAgentInfo) => (osTypes.size === 0 || osTypes.has(info.os)) && (browserTypes.size === 0 || browserTypes.has(info.browser)) && (deviceTypes.size === 0 || deviceTypes.has(info.device)) && (standalone == null || standalone === info.isStandalone);
  }

  return result;
}
