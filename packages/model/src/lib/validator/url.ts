import { isWebsiteUrl, isWebsiteUrlWithPrefix } from '@dereekb/util';
import { type } from 'arktype';

/**
 * ArkType schema for a valid website URL (with or without protocol prefix).
 */
export const websiteUrlType = type('string > 0').narrow((val, ctx) => isWebsiteUrl(val) || ctx.mustBe('a valid website URL'));

/**
 * ArkType schema for a valid website URL that starts with `http://` or `https://`.
 */
export const websiteUrlWithPrefixType = type('string > 0').narrow((val, ctx) => isWebsiteUrlWithPrefix(val) || ctx.mustBe('a valid website URL starting with http:// or https://'));
