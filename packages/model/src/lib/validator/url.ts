import { isWebsiteUrl, isWebsiteUrlWithPrefix } from '@dereekb/util';
import { type } from 'arktype';

/**
 * ArkType schema for a valid website URL (with or without protocol prefix).
 *
 * @dbxUtil
 * @dbxUtilCategory validator
 * @dbxUtilKind const
 * @dbxUtilTags validator, arktype, url, website, string
 * @dbxUtilRelated website-url-with-prefix-type
 *
 * @example
 * ```ts
 * type({ website: websiteUrlType });
 * ```
 */
export const websiteUrlType = type('string > 0').narrow((val, ctx) => (val != null && isWebsiteUrl(val)) || ctx.mustBe('a valid website URL'));

/**
 * ArkType schema for a valid website URL that starts with `http://` or `https://`.
 *
 * @dbxUtil
 * @dbxUtilCategory validator
 * @dbxUtilKind const
 * @dbxUtilTags validator, arktype, url, website, prefix, https, string
 * @dbxUtilRelated website-url-type
 *
 * @example
 * ```ts
 * type({ website: websiteUrlWithPrefixType });
 * ```
 */
export const websiteUrlWithPrefixType = type('string > 0').narrow((val, ctx) => (val != null && isWebsiteUrlWithPrefix(val)) || ctx.mustBe('a valid website URL starting with http:// or https://'));
