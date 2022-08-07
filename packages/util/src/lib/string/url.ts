import { toAbsoluteSlashPathStartType } from '../path/path';
import { chainMapSameFunctions, MapFunction } from '../value/map';
import { Maybe } from '../value/maybe.type';
import { escapeStringForRegex } from './replace';
import { splitJoinRemainder } from './string';
import { TransformStringFunction } from './transform';

/**
 * A website domain.
 *
 * Examples:
 * - dereekb.com
 * - components.dereekb.com
 */
export type WebsiteDomain = string;

/**
 * A website url that starts with http:// or https://
 */
export type BaseWebsiteUrl<D extends WebsiteDomain = WebsiteDomain> = `http://${D}` | `https://${D}`;

/**
 * A website url.
 *
 * Examples:
 * - dereekb.com
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
   * Base path to remove/ignore when isolating a path from the input.
   *
   * For example:
   * - can be /u or /u
   */
  ignoredBasePath?: string;
  /**
   * Whether or not to remove any query parameters if they exist.
   *
   * False by default.
   */
  removeQueryParameters?: boolean;
}

/**
 * Creates a new ExcludeBaseWebsitePathFunction that excludes the base path from the input website path if it exists.
 *
 * @param basePath
 */
export function isolateWebsitePathFunction(config: IsolateWebsitePathFunctionConfig = {}): IsolateWebsitePathFunction {
  const { removeQueryParameters, ignoredBasePath } = config;
  const basePathRegex: Maybe<RegExp> = ignoredBasePath ? new RegExp('^' + escapeStringForRegex(toAbsoluteSlashPathStartType(ignoredBasePath))) : undefined;

  const pathTransform: TransformStringFunction<WebsitePath> = chainMapSameFunctions([
    // remove any base path
    basePathRegex != null ? (inputPath) => inputPath.replace(basePathRegex as RegExp, '') as WebsitePath : undefined,
    // remove the query parameters
    removeQueryParameters != null ? (inputPath) => websitePathAndQueryPair(inputPath).path : undefined
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
