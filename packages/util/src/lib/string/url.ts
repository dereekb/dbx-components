import { type ArrayOrValue, asArray } from '../array/array';
import { type EmailAddress } from '../contact/email';
import { type E164PhoneNumberExtensionPair, type E164PhoneNumberWithOptionalExtension, type PhoneNumber, e164PhoneNumberExtensionPair, isE164PhoneNumber } from '../contact/phone';
import { type IndexRangeInput } from './../value/indexed';
import { isolateSlashPathFunction, isSlashPathFolder, mergeSlashPaths, SLASH_PATH_SEPARATOR, toAbsoluteSlashPathStartType } from '../path/path';
import { chainMapSameFunctions, type MapFunction } from '../value/map';
import { type Maybe } from '../value/maybe.type';
import { escapeStringForRegex, findAllCharacterOccurences, splitStringAtFirstCharacterOccurence } from './replace';
import { splitJoinRemainder } from './string';
import { type TransformStringFunction } from './transform';
import { replaceCharacterAtIndexWith, replaceLastCharacterIfIsFunction } from './char';

/**
 * Connection protocol
 *
 * I.E. http, https, etc.
 */
export type WebsiteProtocol = string;

/** The HTTP protocol string literal type. */
export type HttpWebsiteProtocol = 'http';
/** The HTTPS protocol string literal type. */
export type HttpsWebsiteProtocol = 'https';

/** Known HTTP protocols: `"http"` or `"https"`. */
export type KnownHttpWebsiteProtocol = HttpWebsiteProtocol | HttpsWebsiteProtocol;

/**
 * Returns true if the input string is a known HTTP protocol (`"http"` or `"https"`).
 *
 * @param input - The protocol string to check.
 * @returns Whether the input is `"http"` or `"https"`.
 */
export function isKnownHttpWebsiteProtocol(input: string): input is KnownHttpWebsiteProtocol {
  return input === 'http' || input === 'https';
}

/**
 * A website domain.
 *
 * Examples:
 * - dereekb.com
 * - components.dereekb.com
 */
export type WebsiteDomain = string;

/**
 * Simple website domain regex that looks for a period in the string between the domain and the tld
 */
export const HAS_WEBSITE_DOMAIN_NAME_REGEX = /(.+)\.(.+)/;

/**
 * Returns true if the input probably contains a website domain (has at least one period separating parts).
 *
 * Examples where it will return true:
 * - dereekb.com
 * - test://dereekb.com
 * - https://components.dereekb.com
 * - https://components.dereekb.com/
 * - https://components.dereekb.com/doc/home
 *
 * @param input - The string to check for a domain.
 * @returns Whether the input appears to contain a website domain.
 */
export function hasWebsiteDomain(input: string): input is WebsiteDomain {
  return HAS_WEBSITE_DOMAIN_NAME_REGEX.test(input);
}

/**
 * The top-level domain (tld).
 *
 * Examples:
 * - com
 * - net
 */
export type WebsiteTopLevelDomain = string;

/**
 * This Regex is really only reliable for detecting that the TLD exists, but due to the nature of tld's
 * it cannot always be determined whether or not the part of the url is part of the tld or a subdomain.
 */
export const WEBSITE_TLD_DETECTION_REGEX = /[^\/.\s]([^.\s]+)\.([^.\s]+)$/;

/**
 * Returns true if the input url has a website top level domain.
 *
 * It does not check whether or not the tld is a recognized tld.
 *
 * @param input - The URL string to check.
 * @returns Whether the input appears to have a top-level domain.
 */
export function hasWebsiteTopLevelDomain(input: string): boolean {
  return WEBSITE_TLD_DETECTION_REGEX.test(input);
}

/**
 * Regex that matches a colon followed by digits, used to detect port numbers in URLs.
 */
export const HAS_PORT_NUMBER_REGEX = /\:(\d+)/;

/**
 * A connection port number.
 *
 * Example:
 * - 443
 * - 8080
 */
export type PortNumber = number;

/**
 * Returns true if the input string contains a port number (e.g., `:8080`).
 *
 * Examples where it will return true:
 * - localhost:8080
 * - dereekb.com:8080
 * - https://components.dereekb.com:8080
 * - https://components.dereekb.com:8080/
 * - https://components.dereekb.com:8080/doc/home
 *
 * @param input - The string to check for a port number.
 * @returns Whether the input contains a port number.
 */
export function hasPortNumber(input: string): boolean {
  return HAS_PORT_NUMBER_REGEX.test(input);
}

/**
 * Extracts the port number from the input string, if one is present.
 *
 * @param input - The string to extract a port number from.
 * @returns The port number, or `undefined` if none is found.
 */
export function readPortNumber(input: string): Maybe<PortNumber> {
  const execResult = HAS_PORT_NUMBER_REGEX.exec(input);
  return execResult ? Number(execResult[1]) : undefined;
}

/**
 * A website url that starts with http:// or https://
 *
 * May or may not end with a slash.
 */
export type BaseWebsiteUrl<D extends WebsiteDomain = WebsiteDomain> = `http://${D}` | `https://${D}`;

/**
 * Input for baseWebsiteUrl()
 */
export type BaseWebsiteUrlInput = string | WebsiteUrl | WebsiteDomain;

/**
 * Creates a base website URL (with `http://` or `https://` prefix) from the input domain or URL.
 * If the input lacks a TLD and port, the default TLD is appended.
 *
 * @param input - A domain, URL, or partial URL string.
 * @param defaultTld - The TLD to append if none is detected. Defaults to `"com"`.
 * @returns A fully-qualified base website URL.
 */
export function baseWebsiteUrl(input: BaseWebsiteUrlInput, defaultTld = 'com'): BaseWebsiteUrl {
  let base: BaseWebsiteUrl;

  if (hasHttpPrefix(input)) {
    base = input;
  } else {
    base = addHttpToUrl(input);
  }

  if (!hasWebsiteDomain(base) && !hasPortNumber(base)) {
    base = `${base}.${defaultTld || 'com'}`;
  }

  return base;
}

/**
 * A website url. Is at minimum a domain.
 *
 * Examples:
 * - dereekb.com
 * - https://components.dereekb.com
 * - https://components.dereekb.com/
 * - https://components.dereekb.com/doc/home?
 * - https://components.dereekb.com/doc/home?test=true&test2=true
 */
export type WebsiteUrl = string;

/**
 * Returns true if the input string is probably a website URL.
 *
 * Checks that it has a domain and the path is a valid slash path. Query parameters are ignored.
 *
 * @param input - The string to check.
 * @returns Whether the input appears to be a valid website URL.
 */
export function isWebsiteUrl(input: string): input is WebsiteUrl {
  return websiteUrlDetails(input).isWebsiteUrl;
}

/**
 * Detailed analysis of whether an input string is a valid website URL, including its parsed components.
 */
export interface WebsiteUrlDetails {
  /** The original input string. */
  readonly input: string;
  /** Whether the input is a valid website URL. */
  readonly isWebsiteUrl: boolean;
  /** Whether the input has an `http://` or `https://` prefix. */
  readonly hasHttpPrefix: boolean;
  /** Whether the input contains a website domain. */
  readonly hasWebsiteDomain: boolean;
  /** Whether the input contains a port number. */
  readonly hasPortNumber: boolean;
  /** The port number, or `undefined` if none is present. */
  readonly portNumber: PortNumber | undefined;
  /** The domain and path split pair. */
  readonly splitPair: WebsiteDomainAndPathPair;
  /** The extracted domain. */
  readonly domain: WebsiteDomain;
  /** The full website path including query string. */
  readonly websitePath: WebsitePath;
  /** The path portion without query parameters. */
  readonly path: string;
  /** The query string portion, or undefined if none. */
  readonly query: string | undefined;
}

/**
 * Parses the input string as a website URL and returns detailed information about its components.
 *
 * @param input - The string to analyze as a URL.
 * @returns An object containing parsed URL components and validation flags.
 */
export function websiteUrlDetails(input: string): WebsiteUrlDetails {
  const noHttp = removeHttpFromUrl(input);
  const splitPair = websiteDomainAndPathPairFromWebsiteUrl(noHttp);
  const { domain, path: websitePath } = splitPair;

  const pathHasWebsiteDomain = hasWebsiteDomain(domain);
  const inputHasPortNumber = hasPortNumber(input);
  const portNumber = inputHasPortNumber ? (readPortNumber(input) ?? undefined) : undefined;

  const [path, query] = splitStringAtFirstCharacterOccurence(splitPair.path, '?'); // everything after the query is ignored
  const isWebsiteUrl = pathHasWebsiteDomain && isSlashPathFolder(path + '/');
  const inputHasHttpPrefix = hasHttpPrefix(input);

  const result: WebsiteUrlDetails = {
    input,
    isWebsiteUrl,
    hasWebsiteDomain: pathHasWebsiteDomain,
    hasHttpPrefix: inputHasHttpPrefix,
    hasPortNumber: inputHasPortNumber,
    portNumber,
    splitPair,
    domain,
    websitePath,
    path,
    query
  };

  return result;
}

/**
 * A website url that starts with the proper http/https prefix.
 */
export type WebsiteUrlWithPrefix = string;

/**
 * Returns true if the input string is probably a website URL and has an `http://` or `https://` prefix.
 *
 * @param input - The string to check.
 * @returns Whether the input is a website URL with an HTTP prefix.
 */
export function isWebsiteUrlWithPrefix(input: string): input is WebsiteUrlWithPrefix {
  const details = websiteUrlDetails(input);
  return details.hasHttpPrefix && details.isWebsiteUrl;
}

/**
 * A "standard" internet accessible website url with a tld (.com/.net/etc) and optionally has the http/https protocol, but no other protocol.
 *
 * Examples:
 * - dereekb.com
 * - dereekb.com:8080
 * - components.dereekb.com/
 * - components.dereekb.com/doc/home
 * - http://dereekb.com
 * - https://components.dereekb.com/
 * - https://components.dereekb.com/doc/home
 *
 * Non-examples:
 * - localhost:8080       // not internet-accessible
 * - test://dereekb.com   // non-http/https protocol
 */
export type StandardInternetAccessibleWebsiteUrl = string;

/**
 * Returns true if the input is a standard internet-accessible website URL with a recognized TLD and optionally an HTTP/HTTPS protocol.
 *
 * @param input - The string to check.
 * @returns Whether the input is a standard internet-accessible website URL.
 */
export function isStandardInternetAccessibleWebsiteUrl(input: string): input is StandardInternetAccessibleWebsiteUrl {
  const protocol = readWebsiteProtocol(input);
  return hasWebsiteTopLevelDomain(input) && (protocol != null ? isKnownHttpWebsiteProtocol(protocol) : true);
}

/**
 * A website's domain and path combined, without the BaseWebsiteUrl
 *
 * Examples:
 * - dereekb.com
 * - components.dereekb.com/
 * - components.dereekb.com/doc/home
 */
export type WebsiteDomainAndPath = string;

/**
 * A website's path component.
 *
 * Examples:
 * - /
 * - /doc/home
 * - /doc/home?test=true
 */
export type WebsitePath = `/${string}`;

/**
 * Creates a {@link WebsiteUrl} by merging the base path with additional path segments, preserving the original protocol.
 *
 * @param basePath - The base URL or domain to build upon.
 * @param paths - One or more path segments to append.
 * @param defaultProtocol - Optional protocol to use if the base path has none.
 * @returns The constructed website URL.
 */
export function websiteUrlFromPaths(basePath: BaseWebsiteUrlInput, paths: ArrayOrValue<Maybe<WebsitePath>>, defaultProtocol?: WebsiteProtocol): WebsiteUrl {
  const protocol = readWebsiteProtocol(basePath) ?? defaultProtocol;
  const baseWebUrl = removeWebProtocolPrefix(baseWebsiteUrl(basePath)); // remove prefix to prevent issues with slash paths
  const webUrl = mergeSlashPaths([baseWebUrl, ...asArray(paths)]);
  return setWebProtocolPrefix(webUrl, protocol);
}

/**
 * Any query parameters that follow the path.
 */
export type WebsiteQueryString = `?${string}`;

/**
 * Function that extracts and isolates a specific path portion from a website URL, domain-and-path, or path string.
 */
export type IsolateWebsitePathFunction = MapFunction<WebsitePath | WebsiteDomainAndPath | WebsiteUrl, WebsitePath>;

/**
 * Configuration for creating an {@link IsolateWebsitePathFunction}.
 */
export interface IsolateWebsitePathFunctionConfig {
  /**
   * Optional range of paths to isolate.
   */
  readonly isolatePathComponents?: IndexRangeInput;
  /**
   * Base path to remove/ignore when isolating a path from the input.
   *
   * For example:
   * - For Reddit it could ignore /u or /u
   */
  readonly ignoredBasePath?: string;
  /**
   * Whether or not to remove any query parameters if they exist.
   *
   * False by default.
   */
  readonly removeQueryParameters?: boolean;
  /**
   * Whether or not to remove any trailing slash from the path.
   *
   * False by default.
   */
  readonly removeTrailingSlash?: boolean;
}

/**
 * Creates an {@link IsolateWebsitePathFunction} that extracts and transforms a path from a website URL based on the configuration.
 *
 * @param config - Configuration for path isolation, including base path removal, component range, query handling, and trailing slash behavior.
 * @returns A function that isolates the configured portion of a website path.
 */
export function isolateWebsitePathFunction(config: IsolateWebsitePathFunctionConfig = {}): IsolateWebsitePathFunction {
  const { removeQueryParameters, ignoredBasePath, isolatePathComponents, removeTrailingSlash } = config;
  const basePathRegex: Maybe<RegExp> = ignoredBasePath ? new RegExp('^' + escapeStringForRegex(toAbsoluteSlashPathStartType(ignoredBasePath))) : undefined;
  const isolateRange = isolatePathComponents != null ? isolateSlashPathFunction({ range: isolatePathComponents, startType: 'absolute' }) : undefined;
  const replaceTrailingSlash = removeTrailingSlash === true ? replaceLastCharacterIfIsFunction('', SLASH_PATH_SEPARATOR) : undefined;

  const pathTransform: TransformStringFunction<WebsitePath> = chainMapSameFunctions([
    // remove any base path
    basePathRegex != null ? (inputPath) => inputPath.replace(basePathRegex as RegExp, '') as WebsitePath : undefined,
    // remove the query parameters
    removeQueryParameters != null ? (inputPath) => websitePathAndQueryPair(inputPath).path : undefined,
    // isolate range
    isolateRange != null
      ? (inputPath) => {
          let result = isolateRange(inputPath);

          // retain the query if one is available.
          if (removeQueryParameters !== true) {
            const { query } = websitePathAndQueryPair(inputPath);

            if (query) {
              result = result + query;
            }
          }

          return result as WebsitePath;
        }
      : undefined,
    // remove trailing slash from path
    replaceTrailingSlash != null
      ? (((inputPath) => {
          const { path, query } = websitePathAndQueryPair(inputPath);
          return replaceTrailingSlash(path) + (query ?? '');
        }) as TransformStringFunction<WebsitePath>)
      : undefined
  ]);

  return (input: WebsitePath | WebsiteDomainAndPath | WebsiteUrl) => {
    const path = pathTransform(websitePathFromWebsiteUrl(input));
    return path;
  };
}

/**
 * A pair containing the path and optional query string components of a website URL.
 */
export interface WebsitePathAndQueryPair {
  /** The path portion of the URL (before the `?`). */
  path: WebsitePath;
  /** The query string portion of the URL (including the leading `?`), if present. */
  query?: Maybe<WebsiteQueryString>;
}

/**
 * Splits a website path string into its path and query string components.
 *
 * @param inputPath - The path string to split.
 * @returns A pair containing the path and optional query string.
 */
export function websitePathAndQueryPair(inputPath: string | WebsitePath): WebsitePathAndQueryPair {
  const [path, rawQuery] = inputPath.split('?', 2);
  const query = rawQuery ? fixExtraQueryParameters(rawQuery, true) : undefined;

  return {
    path: path as WebsitePath,
    query: query ? `?${query}` : undefined
  };
}

/**
 * Replaces extra `?` characters in a query string with `&` to fix malformed query parameters.
 *
 * By default, preserves the first `?` and replaces subsequent ones. If `replaceAll` is true, all `?` characters are replaced.
 *
 * @param input - The query string to fix.
 * @param replaceAll - If true, replaces all `?` characters (useful when the input is already past the initial `?`).
 * @returns The fixed query string.
 */
export function fixExtraQueryParameters(input: string, replaceAll = false): string {
  const questionMarkIndexes = findAllCharacterOccurences(new Set('?'), input);
  let indexesToReplace: number[] | undefined;
  let fixed = input;

  if (replaceAll && questionMarkIndexes.length) {
    indexesToReplace = questionMarkIndexes;
  } else if (questionMarkIndexes.length > 1) {
    indexesToReplace = questionMarkIndexes.reverse();
    indexesToReplace.pop(); // remove the "first" so it does not get replaced.
  }

  if (indexesToReplace?.length) {
    indexesToReplace.forEach((index) => (fixed = replaceCharacterAtIndexWith(fixed, index, '&')));
  }

  return fixed;
}

/**
 * Extracts the path component from a website URL, stripping the protocol and domain.
 *
 * @param inputUrl - The URL to extract the path from.
 * @returns The website path component.
 */
export function websitePathFromWebsiteUrl(inputUrl: WebsiteUrl | WebsiteDomainAndPath): WebsitePath {
  const websiteDomainAndPath = removeHttpFromUrl(inputUrl);
  return websitePathFromWebsiteDomainAndPath(websiteDomainAndPath);
}

/**
 * Splits a website URL into its domain and path components after removing the protocol prefix.
 *
 * @param inputUrl - The URL to split.
 * @returns A pair containing the domain and path.
 */
export function websiteDomainAndPathPairFromWebsiteUrl(inputUrl: WebsiteUrl | WebsiteDomainAndPath): WebsiteDomainAndPathPair {
  const websiteDomainAndPath = removeHttpFromUrl(inputUrl);
  return websiteDomainAndPathPair(websiteDomainAndPath);
}

/**
 * Extracts the path component from a domain-and-path string.
 *
 * @param input - The domain-and-path string to extract the path from.
 * @returns The website path component.
 */
export function websitePathFromWebsiteDomainAndPath(input: WebsiteDomainAndPath): WebsitePath {
  return websiteDomainAndPathPair(input).path;
}

/**
 * A pair containing the domain and path components of a website URL.
 */
export interface WebsiteDomainAndPathPair {
  /** The domain portion of the URL. */
  domain: WebsiteDomain;
  /** The path portion of the URL. */
  path: WebsitePath;
}

/**
 * Splits a domain-and-path string into its domain and path components at the first slash.
 *
 * @param input - The domain-and-path string to split.
 * @returns A pair containing the domain and path.
 */
export function websiteDomainAndPathPair(input: WebsiteDomainAndPath): WebsiteDomainAndPathPair {
  const [domain, path] = splitJoinRemainder(input, '/', 2);

  return {
    domain,
    path: toAbsoluteSlashPathStartType(path ?? '/') as WebsitePath
  };
}

/**
 * Regex that matches `http://` or `https://` at the start of a string.
 */
export const HTTP_OR_HTTPS_REGEX: RegExp = /^https:\/\/|http:\/\//;

/**
 * Regex that captures any protocol prefix (e.g., `http`, `https`, `ftp`) before `://`.
 */
export const WEB_PROTOCOL_PREFIX_REGEX: RegExp = /^(.+):\/\//;

/**
 * Reads the website protocol from the input string, if it exists.
 * Does not include the `://` separator.
 *
 * @param input - The URL string to extract the protocol from.
 * @returns The protocol string (e.g., `"https"`), or `undefined` if no protocol is present.
 */
export function readWebsiteProtocol(input: string): Maybe<WebsiteProtocol> {
  const result = WEB_PROTOCOL_PREFIX_REGEX.exec(input);
  return result ? result[1] : undefined;
}

/**
 * Replaces the existing protocol prefix with the specified one, or removes it if no protocol is provided.
 *
 * @param input - The URL string to modify.
 * @param protocol - The protocol to set (e.g., `"https"`), or `undefined`/`null` to remove the protocol.
 * @returns The URL with the updated protocol prefix.
 */
export function setWebProtocolPrefix(input: string, protocol?: Maybe<WebsiteProtocol>): string {
  const basePath = removeWebProtocolPrefix(input);
  return protocol ? `${protocol}://${basePath}` : basePath;
}

/**
 * Removes any protocol prefix (e.g., `http://`, `https://`, `ftp://`) from the input string.
 *
 * @param input - The URL string to strip the protocol from.
 * @returns The URL without the protocol prefix.
 */
export function removeWebProtocolPrefix(input: string): string {
  return input.replace(WEB_PROTOCOL_PREFIX_REGEX, '');
}

/**
 * Adds an HTTP or HTTPS protocol prefix to the URL, replacing any existing protocol.
 *
 * @param url - The URL or domain string to add the prefix to.
 * @param prefix - The HTTP protocol to use. Defaults to `"https"`.
 * @returns The URL with the specified HTTP protocol prefix.
 */
export function addHttpToUrl(url: BaseWebsiteUrl | WebsiteDomainAndPath | string, prefix: KnownHttpWebsiteProtocol = 'https'): BaseWebsiteUrl {
  return setWebProtocolPrefix(url, prefix) as BaseWebsiteUrl;
}

/**
 * Removes `http://` or `https://` from the URL. Other protocols are not affected.
 *
 * @param url - The URL to strip the HTTP prefix from.
 * @returns The URL without the HTTP/HTTPS prefix.
 */
export function removeHttpFromUrl(url: BaseWebsiteUrl | string): WebsiteDomainAndPath {
  return url.replace(HTTP_OR_HTTPS_REGEX, '');
}

/**
 * Returns true if the input string starts with `http://` or `https://`.
 *
 * @param input - The string to check.
 * @returns Whether the input has an HTTP/HTTPS prefix.
 */
export function hasHttpPrefix(input: string): input is BaseWebsiteUrl {
  return HTTP_OR_HTTPS_REGEX.test(input);
}

// MARK: MailToUrl
/**
 * Object representation of a `mailto:` URL.
 */
export interface MailToUrl {
  /** The email address for the mailto link. */
  email: string;
}

/**
 * Input for creating a mailto URL string. Can be an email address string or a {@link MailToUrl} object.
 */
export type MailToUrlInput = EmailAddress | MailToUrl;

/**
 * Creates a `mailto:` URL string from the input email address or object.
 *
 * @param input - An email address or MailToUrl object.
 * @returns A `mailto:` URL string.
 */
export function mailToUrlString(input: MailToUrlInput): string {
  const mailTo: MailToUrl = typeof input === 'string' ? { email: input } : input;
  return `mailto:${mailTo.email}`;
}

// MARK: Tel
/**
 * Creates a `tel:` URL string from a phone number, handling E.164 format and extensions.
 *
 * @param phone - The phone number to create a tel URL for.
 * @returns A `tel:` URL string, with extension appended if present.
 */
export function telUrlString(phone: PhoneNumber | E164PhoneNumberWithOptionalExtension): string {
  if (isE164PhoneNumber(phone, true)) {
    const pair = e164PhoneNumberExtensionPair(phone);
    return telUrlStringForE164PhoneNumberPair(pair);
  }

  return `tel:${phone}`;
}

/**
 * Creates a `tel:` URL string for an E.164 phone number with an optional extension.
 *
 * @param pair - The phone number and extension pair.
 * @returns A `tel:` URL string with the extension appended using `;` if present.
 */
export function telUrlStringForE164PhoneNumberPair(pair: E164PhoneNumberExtensionPair): string {
  // https://stackoverflow.com/questions/9482633/how-do-i-include-extensions-in-the-tel-uri
  if (pair.extension) {
    return `tel:${pair.number};${pair.extension}`;
  } else {
    return `tel:${pair.number}`;
  }
}
