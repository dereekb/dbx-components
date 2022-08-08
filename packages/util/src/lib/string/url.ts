import { IndexRangeInput } from './../value/indexed';
import { isolateSlashPathFunction, SLASH_PATH_SEPARATOR, toAbsoluteSlashPathStartType } from '../path/path';
import { chainMapSameFunctions, MapFunction } from '../value/map';
import { Maybe } from '../value/maybe.type';
import { escapeStringForRegex } from './replace';
import { splitJoinRemainder } from './string';
import { TransformStringFunction } from './transform';
import { replaceLastCharacterIfIsFunction } from './char';

/**
 * A website domain.
 *
 * Examples:
 * - dereekb.com
 * - components.dereekb.com
 */
export type WebsiteDomain = string;

/**
 * Simple website domain regex that looks for a period between the domain and the tld
 */
export const WEBSITE_DOMAIN_NAME_REGEX = /(.+)\.(.+)/;

/**
 * Returns true if the input probably has a website domain in it.
 *
 * Examples where it will return true:
 * - dereekb.com
 * - https://components.dereekb.com
 * - https://components.dereekb.com/
 * - https://components.dereekb.com/doc/home
 *
 * @param input
 * @returns
 */
export function hasWebsiteDomain(input: string): input is WebsiteDomain {
  return WEBSITE_DOMAIN_NAME_REGEX.test(input);
}

/**
 * A website url that starts with http:// or https://
 */
export type BaseWebsiteUrl<D extends WebsiteDomain = WebsiteDomain> = `http://${D}` | `https://${D}`;

/**
 * A website url. Is at minimum a domain.
 *
 * Examples:
 * - dereekb.com
 * - https://components.dereekb.com
 * - https://components.dereekb.com/
 * - https://components.dereekb.com/doc/home
 */
export type WebsiteUrl = string;

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
  isolatePathComponents?: IndexRangeInput;
  /**
   * Base path to remove/ignore when isolating a path from the input.
   *
   * For example:
   * - For Reddit it could ignore /u or /u
   */
  ignoredBasePath?: string;
  /**
   * Whether or not to remove any query parameters if they exist.
   *
   * False by default.
   */
  removeQueryParameters?: boolean;
  /**
   * Whether or not to remove any trailing slash from the path.
   *
   * False by default.
   */
  removeTrailingSlash?: boolean;
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
  const [path, query] = inputPath.split('?', 2);

  return {
    path: path as WebsitePath,
    query: query ? `?${query}` : undefined
  };
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

/**
 * Removes both http:// and https:// from the url.
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
