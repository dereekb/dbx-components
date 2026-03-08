import { addPrefix, type E164PhoneNumber, type EmailAddress, hasWebsiteDomain, type IsolateWebsitePathFunction, isolateWebsitePathFunction, type ModelKey, removeHttpFromUrl, toAbsoluteSlashPathStartType, toRelativeSlashPathStartType, type WebsiteUrl } from '@dereekb/util';
import { type WebsiteLink, type WebsiteLinkType } from './link';

/**
 * Isolates a username from a URL where the username is the first path segment after the domain.
 *
 * Strips trailing slashes and query parameters. Used by social platforms like Facebook, Instagram, and Twitter
 * where the profile URL pattern is `https://domain.com/{username}`.
 *
 * @example
 * ```typescript
 * WEBSITE_LINK_ISOLATE_BASE_URL_PROFILE_ID('https://www.facebook.com/myuser');
 * // returns 'myuser'
 * ```
 */
export const WEBSITE_LINK_ISOLATE_BASE_URL_PROFILE_ID = isolateWebsitePathFunction({
  isolatePathComponents: 0,
  removeTrailingSlash: true,
  removeQueryParameters: true
});

/**
 * Extracts a username from either a raw username string or a full profile URL where the username is the first path segment.
 *
 * Optionally prepends a prefix (e.g., "@" for TikTok, "$" for Cash App).
 *
 * @param input - a username or full profile URL
 * @param prefix - optional prefix to prepend to the extracted username
 * @returns the isolated username, optionally prefixed
 *
 * @example
 * ```typescript
 * usernameFromUsernameOrWebsiteWithBaseUrlUsername('https://facebook.com/myuser');
 * // returns 'myuser'
 *
 * usernameFromUsernameOrWebsiteWithBaseUrlUsername('myuser', '@');
 * // returns '@myuser'
 * ```
 */
export function usernameFromUsernameOrWebsiteWithBaseUrlUsername(input: ModelKey | WebsiteUrl, prefix?: string) {
  const username = toRelativeSlashPathStartType(WEBSITE_LINK_ISOLATE_BASE_URL_PROFILE_ID(usernameOrWebsiteUrlToWebsiteUrl(input)));

  if (prefix) {
    return addPrefix(prefix, username);
  } else {
    return username;
  }
}

/**
 * Extracts a username from either a raw username string or a full profile URL using a custom path isolation function.
 *
 * Used for platforms with non-standard URL patterns (e.g., Snapchat's `/add/{username}`, YouTube's `/c/{username}`).
 *
 * @param input - a username or full profile URL
 * @param isolateFn - custom function that extracts the relevant path segment from the URL
 * @returns the isolated username
 */
export function usernameFromUsernameOrWebsiteWithOneOffBaseUrlUsername(input: ModelKey | WebsiteUrl, isolateFn: IsolateWebsitePathFunction) {
  return toRelativeSlashPathStartType(isolateFn(usernameOrWebsiteUrlToWebsiteUrl(input)));
}

/**
 * Normalizes a string that may be either a plain username or a full website URL into a consistent URL format.
 *
 * If the input has a website domain, it is returned as-is. Otherwise, it is treated as a path and converted to an absolute slash path.
 *
 * @param input - a username or website URL
 * @returns a normalized website URL
 */
export function usernameOrWebsiteUrlToWebsiteUrl(input: string): WebsiteUrl {
  return hasWebsiteDomain(input) ? input : toAbsoluteSlashPathStartType(removeHttpFromUrl(input));
}

// MARK: Website
/**
 * {@link WebsiteLinkType} code for generic website URLs.
 */
export const WEBSITE_URL_WEBSITE_LINK_TYPE = 'w';

/**
 * Converts a generic website URL into a {@link WebsiteLink}, stripping the HTTP/HTTPS protocol.
 *
 * @param input - the full website URL
 * @returns a WebsiteLink with the protocol removed from the data
 *
 * @example
 * ```typescript
 * const link = websiteUrlToWebsiteLink('https://example.com/page');
 * // link.t === 'w', link.d === 'example.com/page'
 * ```
 */
export function websiteUrlToWebsiteLink(input: WebsiteUrl): WebsiteLink {
  return {
    t: WEBSITE_URL_WEBSITE_LINK_TYPE,
    d: removeHttpFromUrl(input) // website urls are stored as-is without http/https
  };
}

// MARK: Email
/**
 * {@link WebsiteLinkType} code for email addresses.
 */
export const EMAIL_URL_WEBSITE_LINK_TYPE = 'e';

/**
 * Converts an email address into a {@link WebsiteLink}.
 *
 * @param input - the email address
 * @returns a WebsiteLink storing the email as data
 */
export function emailAddressToWebsiteLink(input: EmailAddress): WebsiteLink {
  return {
    t: EMAIL_URL_WEBSITE_LINK_TYPE,
    d: input
  };
}

// MARK: Phone
/**
 * {@link WebsiteLinkType} code for phone numbers.
 */
export const PHONE_URL_WEBSITE_LINK_TYPE = 'p';

/**
 * Converts an E.164 phone number into a {@link WebsiteLink}.
 *
 * @param input - the phone number in E.164 format
 * @returns a WebsiteLink storing the phone number as data
 */
export function phoneNumberToWebsiteLink(input: E164PhoneNumber): WebsiteLink {
  return {
    t: PHONE_URL_WEBSITE_LINK_TYPE,
    d: input
  };
}

// MARK: Facebook
/** Base URL for Facebook profiles. */
export const FACEBOOK_BASE_URL = `https://www.facebook.com`;
/** {@link WebsiteLinkType} code for Facebook. */
export const FACEBOOK_WEBSITE_LINK_TYPE: WebsiteLinkType = 'fb';

export type FacebookBaseUrl = typeof FACEBOOK_BASE_URL;
export type FacebookProfileUrl<P extends FacebookProfileId> = `${FacebookBaseUrl}/${P}`;
export type FacebookProfileId = string;
export type FacebookWebsiteLinkType = typeof FACEBOOK_WEBSITE_LINK_TYPE;

/**
 * Converts a Facebook profile ID or URL into a {@link WebsiteLink}.
 *
 * Accepts either a raw username or a full Facebook profile URL.
 *
 * @param input - a Facebook profile ID or full profile URL
 * @returns a WebsiteLink with the isolated username as data
 *
 * @example
 * ```typescript
 * facebookProfileUrlToWebsiteLink('https://www.facebook.com/myuser');
 * // { t: 'fb', d: 'myuser' }
 *
 * facebookProfileUrlToWebsiteLink('myuser');
 * // { t: 'fb', d: 'myuser' }
 * ```
 */
export function facebookProfileUrlToWebsiteLink(input: FacebookProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: FACEBOOK_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithBaseUrlUsername(input)
  };
}

/**
 * Constructs a full Facebook profile URL from a profile ID.
 *
 * @param profileId - the Facebook profile ID or username
 * @returns the full profile URL
 */
export function facebookProfileUrl<P extends FacebookProfileId>(profileId: P): FacebookProfileUrl<P> {
  return `${FACEBOOK_BASE_URL}/${profileId}`;
}

// MARK: Instagram
/** Base URL for Instagram profiles. */
export const INSTAGRAM_BASE_URL = `https://www.instagram.com`;
/** {@link WebsiteLinkType} code for Instagram. */
export const INSTAGRAM_WEBSITE_LINK_TYPE: WebsiteLinkType = 'ig';

export type InstagramBaseUrl = typeof INSTAGRAM_BASE_URL;
export type InstagramProfileUrl<P extends InstagramProfileId> = `${InstagramBaseUrl}/${P}`;
export type InstagramProfileId = string;
export type InstagramWebsiteLinkType = typeof INSTAGRAM_WEBSITE_LINK_TYPE;

/**
 * Converts an Instagram profile ID or URL into a {@link WebsiteLink}.
 *
 * @param input - an Instagram username or full profile URL
 * @returns a WebsiteLink with the isolated username as data
 */
export function instagramProfileUrlToWebsiteLink(input: InstagramProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: INSTAGRAM_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithBaseUrlUsername(input)
  };
}

/**
 * Constructs a full Instagram profile URL from a profile ID.
 *
 * @param profileId - the Instagram username
 * @returns the full profile URL
 */
export function instagramProfileUrl<P extends InstagramProfileId>(profileId: P): InstagramProfileUrl<P> {
  return `${INSTAGRAM_BASE_URL}/${profileId}`;
}

// MARK: Twitter
/** Base URL for Twitter profiles. */
export const TWITTER_BASE_URL = `https://www.twitter.com`;
/** {@link WebsiteLinkType} code for Twitter. */
export const TWITTER_WEBSITE_LINK_TYPE: WebsiteLinkType = 'tw';

export type TwitterBaseUrl = typeof TWITTER_BASE_URL;
export type TwitterProfileUrl<P extends TwitterProfileId> = `${TwitterBaseUrl}/${P}`;
export type TwitterProfileId = string;
export type TwitterWebsiteLinkType = typeof TWITTER_WEBSITE_LINK_TYPE;

/**
 * Converts a Twitter profile ID or URL into a {@link WebsiteLink}.
 *
 * @param input - a Twitter username or full profile URL
 * @returns a WebsiteLink with the isolated username as data
 */
export function twitterProfileUrlToWebsiteLink(input: TwitterProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: TWITTER_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithBaseUrlUsername(input)
  };
}

/**
 * Constructs a full Twitter profile URL from a profile ID.
 *
 * @param profileId - the Twitter username
 * @returns the full profile URL
 */
export function twitterProfileUrl<P extends TwitterProfileId>(profileId: P): TwitterProfileUrl<P> {
  return `${TWITTER_BASE_URL}/${profileId}`;
}

// MARK: Tiktok
/** Base URL for TikTok profiles. */
export const TIKTOK_BASE_URL = `https://tiktok.com`;
/** TikTok usernames are prefixed with "@" in URLs and stored data. */
export const TIKTOK_USERNAME_PREFIX = '@';
/** {@link WebsiteLinkType} code for TikTok. */
export const TIKTOK_WEBSITE_LINK_TYPE: WebsiteLinkType = 'tt';

export type TikTokBaseUrl = typeof TIKTOK_BASE_URL;
export type TikTokProfileUrl<P extends TikTokProfileId> = `${TikTokBaseUrl}/@${P}`;
export type TikTokProfileId = string;

export type TikTokWebsiteLinkType = typeof TIKTOK_WEBSITE_LINK_TYPE;

/**
 * Converts a TikTok profile ID or URL into a {@link WebsiteLink}.
 *
 * Automatically prepends the "@" prefix if not already present.
 *
 * @param input - a TikTok username (with or without "@") or full profile URL
 * @returns a WebsiteLink with the "@"-prefixed username as data
 */
export function tiktokProfileUrlToWebsiteLink(input: TikTokProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: TIKTOK_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithBaseUrlUsername(input, TIKTOK_USERNAME_PREFIX)
  };
}

/**
 * Constructs a full TikTok profile URL from a profile ID.
 *
 * @param profileId - the TikTok username (without "@" prefix)
 * @returns the full profile URL with "@" prefix
 */
export function tiktokProfileUrl<P extends TikTokProfileId>(profileId: P): TikTokProfileUrl<P> {
  return `${TIKTOK_BASE_URL}/@${profileId}`;
}

// MARK: Snapchat
/** Base URL for Snapchat profiles. */
export const SNAPCHAT_BASE_URL = `https://snapchat.com`;
/** {@link WebsiteLinkType} code for Snapchat. */
export const SNAPCHAT_WEBSITE_LINK_TYPE: WebsiteLinkType = 'sc';

export type SnapchatBaseUrl = typeof SNAPCHAT_BASE_URL;
export type SnapchatProfileUrl<P extends SnapchatProfileId> = `${SnapchatBaseUrl}/add/${P}`;
export type SnapchatProfileId = string;

export type SnapchatWebsiteLinkType = typeof SNAPCHAT_WEBSITE_LINK_TYPE;

/**
 * Isolates a Snapchat username from a URL, ignoring the `/add/` base path segment.
 */
export const SNAPCHAT_WEBSITE_LINK_ISOLATE_PROFILE_ID = isolateWebsitePathFunction({
  ignoredBasePath: 'add',
  isolatePathComponents: 0,
  removeTrailingSlash: true,
  removeQueryParameters: true
});

/**
 * Converts a Snapchat profile ID or URL into a {@link WebsiteLink}.
 *
 * Handles Snapchat's `/add/{username}` URL pattern.
 *
 * @param input - a Snapchat username or full profile URL
 * @returns a WebsiteLink with the isolated username as data
 */
export function snapchatProfileUrlToWebsiteLink(input: SnapchatProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: SNAPCHAT_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithOneOffBaseUrlUsername(input, SNAPCHAT_WEBSITE_LINK_ISOLATE_PROFILE_ID)
  };
}

/**
 * Constructs a full Snapchat profile URL from a profile ID.
 *
 * @param profileId - the Snapchat username
 * @returns the full profile URL with `/add/` path
 */
export function snapchatProfileUrl<P extends SnapchatProfileId>(profileId: P): SnapchatProfileUrl<P> {
  return `${SNAPCHAT_BASE_URL}/add/${profileId}`;
}

// MARK: YouTube
/** Base URL for YouTube channels. */
export const YOUTUBE_BASE_URL = `https://youtube.com`;
/** {@link WebsiteLinkType} code for YouTube. */
export const YOUTUBE_WEBSITE_LINK_TYPE: WebsiteLinkType = 'yt';

export type YouTubeBaseUrl = typeof YOUTUBE_BASE_URL;
export type YouTubeProfileUrl<P extends YouTubeProfileId> = `${YouTubeBaseUrl}/c/${P}`;
export type YouTubeProfileId = string;

export type YouTubeWebsiteLinkType = typeof YOUTUBE_WEBSITE_LINK_TYPE;

/**
 * Isolates a YouTube channel name from a URL, ignoring the `/c/` base path segment.
 */
export const YOUTUBE_WEBSITE_LINK_ISOLATE_PROFILE_ID = isolateWebsitePathFunction({
  ignoredBasePath: 'c',
  isolatePathComponents: 0,
  removeTrailingSlash: true,
  removeQueryParameters: true
});

/**
 * Converts a YouTube channel ID or URL into a {@link WebsiteLink}.
 *
 * Handles YouTube's `/c/{channel}` URL pattern.
 *
 * @param input - a YouTube channel name or full channel URL
 * @returns a WebsiteLink with the isolated channel name as data
 */
export function youtubeProfileUrlToWebsiteLink(input: YouTubeProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: YOUTUBE_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithOneOffBaseUrlUsername(input, YOUTUBE_WEBSITE_LINK_ISOLATE_PROFILE_ID)
  };
}

/**
 * Constructs a full YouTube channel URL from a profile ID.
 *
 * @param profileId - the YouTube channel name
 * @returns the full channel URL with `/c/` path
 */
export function youtubeProfileUrl<P extends YouTubeProfileId>(profileId: P): YouTubeProfileUrl<P> {
  return `${YOUTUBE_BASE_URL}/c/${profileId}`;
}

// MARK: PayPal
/** Base URL for PayPal.me profiles. */
export const PAYPAL_BASE_URL = `https://paypal.me`;
/** {@link WebsiteLinkType} code for PayPal. */
export const PAYPAL_WEBSITE_LINK_TYPE: WebsiteLinkType = 'pp';

export type PayPalBaseUrl = typeof PAYPAL_BASE_URL;
export type PayPalProfileUrl<P extends PayPalProfileId> = `${PayPalBaseUrl}/${P}`;
export type PayPalProfileId = string;

export type PayPalWebsiteLinkType = typeof PAYPAL_WEBSITE_LINK_TYPE;

/**
 * Converts a PayPal profile ID or URL into a {@link WebsiteLink}.
 *
 * @param input - a PayPal username or full PayPal.me URL
 * @returns a WebsiteLink with the isolated username as data
 */
export function paypalProfileUrlToWebsiteLink(input: PayPalProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: PAYPAL_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithBaseUrlUsername(input)
  };
}

/**
 * Constructs a full PayPal.me profile URL from a profile ID.
 *
 * @param profileId - the PayPal username
 * @returns the full PayPal.me URL
 */
export function paypalProfileUrl<P extends PayPalProfileId>(profileId: P): PayPalProfileUrl<P> {
  return `${PAYPAL_BASE_URL}/${profileId}`;
}

// MARK: Cashapp
/** Base URL for Cash App profiles. */
export const CASHAPP_BASE_URL = `https://cash.app`;
/** Cash App usernames are prefixed with "$" (cashtag). */
export const CASHAPP_USERNAME_PREFIX = '$';
/** {@link WebsiteLinkType} code for Cash App. */
export const CASHAPP_WEBSITE_LINK_TYPE: WebsiteLinkType = 'ca';

export type CashappBaseUrl = typeof CASHAPP_BASE_URL;
export type CashappProfileUrl<P extends CashappProfileId> = `${CashappBaseUrl}/$${P}`;
export type CashappProfileId = string;

export type CashappWebsiteLinkType = typeof CASHAPP_WEBSITE_LINK_TYPE;

/**
 * Converts a Cash App profile ID or URL into a {@link WebsiteLink}.
 *
 * Automatically prepends the "$" prefix if not already present.
 *
 * @param input - a Cash App username (with or without "$") or full profile URL
 * @returns a WebsiteLink with the "$"-prefixed username as data
 */
export function cashappProfileUrlToWebsiteLink(input: CashappProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: CASHAPP_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithBaseUrlUsername(input, CASHAPP_USERNAME_PREFIX)
  };
}

/**
 * Constructs a full Cash App profile URL from a profile ID.
 *
 * @param profileId - the Cash App username (without "$" prefix)
 * @returns the full Cash App URL with "$" prefix
 */
export function cashappProfileUrl<P extends CashappProfileId>(profileId: P): CashappProfileUrl<P> {
  return `${CASHAPP_BASE_URL}/$${profileId}`;
}

// MARK: Venmo
/** Base URL for Venmo profiles. */
export const VENMO_BASE_URL = `https://account.venmo.com`;
/** {@link WebsiteLinkType} code for Venmo. */
export const VENMO_WEBSITE_LINK_TYPE: WebsiteLinkType = 'vn';

export type VenmoBaseUrl = typeof VENMO_BASE_URL;
export type VenmoProfileUrl<P extends VenmoProfileId> = `${VenmoBaseUrl}/u/${P}`;
export type VenmoProfileId = string;

export type VenmoWebsiteLinkType = typeof VENMO_WEBSITE_LINK_TYPE;

/**
 * Isolates a Venmo username from a URL, ignoring the `/u/` base path segment.
 */
export const VENMO_WEBSITE_LINK_ISOLATE_PROFILE_ID = isolateWebsitePathFunction({
  ignoredBasePath: 'u',
  isolatePathComponents: 0,
  removeTrailingSlash: true,
  removeQueryParameters: true
});

/**
 * Converts a Venmo profile ID or URL into a {@link WebsiteLink}.
 *
 * Handles Venmo's `/u/{username}` URL pattern.
 *
 * @param input - a Venmo username or full profile URL
 * @returns a WebsiteLink with the isolated username as data
 */
export function venmoProfileUrlToWebsiteLink(input: VenmoProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: VENMO_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithOneOffBaseUrlUsername(input, VENMO_WEBSITE_LINK_ISOLATE_PROFILE_ID)
  };
}

/**
 * Constructs a full Venmo profile URL from a profile ID.
 *
 * @param profileId - the Venmo username
 * @returns the full profile URL with `/u/` path
 */
export function venmoProfileUrl<P extends VenmoProfileId>(profileId: P): VenmoProfileUrl<P> {
  return `${VENMO_BASE_URL}/u/${profileId}`;
}

// MARK: Spotify
/** Base URL for Spotify profiles. */
export const SPOTIFY_BASE_URL = `https://open.spotify.com/`;
/** {@link WebsiteLinkType} code for Spotify. */
export const SPOTIFY_WEBSITE_LINK_TYPE: WebsiteLinkType = 'sp';

export type SpotifyBaseUrl = typeof SPOTIFY_BASE_URL;
export type SpotifyProfileUrl<P extends SpotifyProfileId> = `${SpotifyBaseUrl}/user/${P}`;
export type SpotifyProfileId = string;

export type SpotifyWebsiteLinkType = typeof SPOTIFY_WEBSITE_LINK_TYPE;

/**
 * Isolates a Spotify username from a URL, ignoring the `/user/` base path segment.
 */
export const SPOTIFY_WEBSITE_LINK_ISOLATE_PROFILE_ID = isolateWebsitePathFunction({
  ignoredBasePath: 'user',
  isolatePathComponents: 0,
  removeTrailingSlash: true,
  removeQueryParameters: true
});

/**
 * Converts a Spotify profile ID or URL into a {@link WebsiteLink}.
 *
 * Handles Spotify's `/user/{username}` URL pattern.
 *
 * @param input - a Spotify username or full profile URL
 * @returns a WebsiteLink with the isolated username as data
 */
export function spotifyProfileUrlToWebsiteLink(input: SpotifyProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: SPOTIFY_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithOneOffBaseUrlUsername(input, SPOTIFY_WEBSITE_LINK_ISOLATE_PROFILE_ID)
  };
}

/**
 * Constructs a full Spotify profile URL from a profile ID.
 *
 * @param profileId - the Spotify username
 * @returns the full profile URL with `/user/` path
 */
export function spotifyProfileUrl<P extends SpotifyProfileId>(profileId: P): SpotifyProfileUrl<P> {
  return `${SPOTIFY_BASE_URL}/user/${profileId}`;
}
