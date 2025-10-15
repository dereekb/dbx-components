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

export type HttpWebsiteProtocol = 'http';
export type HttpsWebsiteProtocol = 'https';

export type KnownHttpWebsiteProtocol = HttpWebsiteProtocol | HttpsWebsiteProtocol;

/**
 * Returns true if the input string is a KnownHttpWebsiteProtocol.
 *
 * @param input
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
 * Returns true if the input probably has a website domain in it.
 *
 * Examples where it will return true:
 * - dereekb.com
 * - test://dereekb.com
 * - https://components.dereekb.com
 * - https://components.dereekb.com/
 * - https://components.dereekb.com/doc/home
 *
 * @param input
 * @returns
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
 */
export function hasWebsiteTopLevelDomain(input: string): boolean {
  return WEBSITE_TLD_DETECTION_REGEX.test(input);
}

/**
 * Simple website domain regex that looks for a period in the string between the domain and the tld
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
 * Returns true if the input has a port number attached to it
 *
 * Examples where it will return true:
 * - localhost:8080
 * - dereekb.com:8080
 * - https://components.dereekb.com:8080
 * - https://components.dereekb.com:8080/
 * - https://components.dereekb.com:8080/doc/home
 *
 * @param input
 * @returns
 */
export function hasPortNumber(input: string): boolean {
  return HAS_PORT_NUMBER_REGEX.test(input);
}

/**
 * Reads the port number from the input, if possible.
 *
 * @param input
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
 * Creates a base website url from the input domain or url.
 *
 * @param input
 * @returns
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
 * Returns true if the input string is probably a website url.
 *
 * Checks that it has the http/https prefix, has a domain, and the path is a slash path. The query parameters are ignored.
 */
export function isWebsiteUrl(input: string): input is WebsiteUrl {
  return websiteUrlDetails(input).isWebsiteUrl;
}

/**
 * Details about an input string.
 *
 * Is tested if it is a website url.
 */
export interface WebsiteUrlDetails {
  readonly input: string;
  readonly isWebsiteUrl: boolean;
  readonly hasHttpPrefix: boolean;
  readonly hasWebsiteDomain: boolean;
  readonly splitPair: WebsiteDomainAndPathPair;
  readonly domain: WebsiteDomain;
  readonly websitePath: WebsitePath;
  readonly path: string;
  readonly query: string | undefined;
}

/**
 * Returns details about the input string, considering it a WebsiteUrl and returning details.
 *
 * @param input string to test
 * @returns WebsiteUrlDetails
 */
export function websiteUrlDetails(input: string): WebsiteUrlDetails {
  const noHttp = removeHttpFromUrl(input);
  const splitPair = websiteDomainAndPathPairFromWebsiteUrl(noHttp);
  const { domain, path: websitePath } = splitPair;

  const pathHasWebsiteDomain = hasWebsiteDomain(domain);

  const [path, query] = splitStringAtFirstCharacterOccurence(splitPair.path, '?'); // everything after the query is ignored
  const isWebsiteUrl = pathHasWebsiteDomain && isSlashPathFolder(path + '/');
  const inputHasHttpPrefix = hasHttpPrefix(input);

  const result: WebsiteUrlDetails = {
    input,
    isWebsiteUrl,
    hasWebsiteDomain: pathHasWebsiteDomain,
    hasHttpPrefix: inputHasHttpPrefix,
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
 * Returns true if the input string is probably a website url.
 *
 * Checks that it has the http/https prefix, has a domain, and the path is a slash path. The query parameters are ignored.
 */
export function isWebsiteUrlWithPrefix(input: string): input is WebsiteUrl {
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
 * Returns true if the input is a StandardInternetAccessibleWebsiteUrl.
 *
 * @param input
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
 * Creates a WebsiteUrl from the input
 * @param basePath
 * @param paths
 * @returns
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
 * Maps the input WebsitePath to remove the configured base path.
 */
export type IsolateWebsitePathFunction = MapFunction<WebsitePath | WebsiteDomainAndPath | WebsiteUrl, WebsitePath>;

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
 * Creates a new ExcludeBaseWebsitePathFunction that excludes the base path from the input website path if it exists.
 *
 * @param basePath
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

export interface WebsitePathAndQueryPair {
  path: WebsitePath;
  query?: Maybe<WebsiteQueryString>;
}

export function websitePathAndQueryPair(inputPath: string | WebsitePath): WebsitePathAndQueryPair {
  const [path, rawQuery] = inputPath.split('?', 2);
  const query = rawQuery ? fixExtraQueryParameters(rawQuery, true) : undefined;

  return {
    path: path as WebsitePath,
    query: query ? `?${query}` : undefined
  };
}

/**
 * Replaces any extra query parameter "?" characters with an "&" character.
 *
 * Can also choose to replace all instead, incase the input string should be considered the query without.
 *
 * @param input
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
 * Reads the website path from the input.
 *
 * @param input
 * @returns
 */
export function websitePathFromWebsiteUrl(inputUrl: WebsiteUrl | WebsiteDomainAndPath): WebsitePath {
  const websiteDomainAndPath = removeHttpFromUrl(inputUrl);
  return websitePathFromWebsiteDomainAndPath(websiteDomainAndPath);
}

export function websiteDomainAndPathPairFromWebsiteUrl(inputUrl: WebsiteUrl | WebsiteDomainAndPath): WebsiteDomainAndPathPair {
  const websiteDomainAndPath = removeHttpFromUrl(inputUrl);
  return websiteDomainAndPathPair(websiteDomainAndPath);
}

/**
 * Reads the website path from the input WebsiteDomainAndPath.
 *
 * @param input
 * @returns
 */
export function websitePathFromWebsiteDomainAndPath(input: WebsiteDomainAndPath): WebsitePath {
  return websiteDomainAndPathPair(input).path;
}

export interface WebsiteDomainAndPathPair {
  domain: WebsiteDomain;
  path: WebsitePath;
}

export function websiteDomainAndPathPair(input: WebsiteDomainAndPath): WebsiteDomainAndPathPair {
  const [domain, path] = splitJoinRemainder(input, '/', 2);

  return {
    domain,
    path: toAbsoluteSlashPathStartType(path ?? '/') as WebsitePath
  };
}

export const HTTP_OR_HTTPS_REGEX: RegExp = /^https:\/\/|http:\/\//;
export const WEB_PROTOCOL_PREFIX_REGEX: RegExp = /^(.+):\/\//;

/**
 * Reads the website protocol from the input string, if it exists.
 *
 * Does not include the "://" components.
 *
 * @param input
 */
export function readWebsiteProtocol(input: string): Maybe<WebsiteProtocol> {
  const result = WEB_PROTOCOL_PREFIX_REGEX.exec(input);
  return result ? result[1] : undefined;
}

/**
 * Removes any existing protocol and sets the protocol to match the input.
 *
 * If no protcol is input, then it is removed from the input.
 *
 * @param url
 * @param protocol
 */
export function setWebProtocolPrefix(input: string, protocol?: Maybe<WebsiteProtocol>): string {
  const basePath = removeWebProtocolPrefix(input);
  return protocol ? `${protocol}://${basePath}` : basePath;
}

/**
 * Removes any existing protocol prefix from the input.
 *
 * @param input
 */
export function removeWebProtocolPrefix(input: string): string {
  return input.replace(WEB_PROTOCOL_PREFIX_REGEX, '');
}

/**
 * Adds both https:// to the url.
 *
 * @param url
 * @returns
 */
export function addHttpToUrl(url: BaseWebsiteUrl | WebsiteDomainAndPath | string, prefix: KnownHttpWebsiteProtocol = 'https'): BaseWebsiteUrl {
  return setWebProtocolPrefix(url, prefix) as BaseWebsiteUrl;
}

/**
 * Removes the prefixes http:// and https:// from the url. If these protocols are not used, nothing is removed.
 *
 * @param url
 * @returns
 */
export function removeHttpFromUrl(url: BaseWebsiteUrl | string): WebsiteDomainAndPath {
  return url.replace(HTTP_OR_HTTPS_REGEX, '');
}

/**
 * Returns true if the input string starts with http/https
 *
 * @param input
 */
export function hasHttpPrefix(input: string): input is BaseWebsiteUrl {
  return HTTP_OR_HTTPS_REGEX.test(input);
}

// MARK: MailToUrl
export interface MailToUrl {
  email: string;
}

export type MailToUrlInput = EmailAddress | MailToUrl;

export function mailToUrlString(input: MailToUrlInput): string {
  const mailTo: MailToUrl = typeof input === 'string' ? { email: input } : input;
  return `mailto:${mailTo.email}`;
}

// MARK: Tel
export function telUrlString(phone: PhoneNumber | E164PhoneNumberWithOptionalExtension): string {
  if (isE164PhoneNumber(phone, true)) {
    const pair = e164PhoneNumberExtensionPair(phone);
    return telUrlStringForE164PhoneNumberPair(pair);
  }

  return `tel:${phone}`;
}

/**
 * Creates a tel url string for the input E164PhoneNumberExtensionPair.
 *
 * @param pair
 * @returns
 */
export function telUrlStringForE164PhoneNumberPair(pair: E164PhoneNumberExtensionPair): string {
  // https://stackoverflow.com/questions/9482633/how-do-i-include-extensions-in-the-tel-uri
  if (pair.extension) {
    return `tel:${pair.number};${pair.extension}`;
  } else {
    return `tel:${pair.number}`;
  }
}
