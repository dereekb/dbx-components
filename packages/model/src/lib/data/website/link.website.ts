import { addPrefix, E164PhoneNumber, EmailAddress, hasWebsiteDomain, IsolateWebsitePathFunction, isolateWebsitePathFunction, ModelKey, PhoneNumber, removeHttpFromUrl, toAbsoluteSlashPathStartType, toRelativeSlashPathStartType, WebsiteUrl } from '@dereekb/util';
import { WebsiteLink, WebsiteLinkEncodedData, WebsiteLinkType } from './link';

/**
 * Used for isolating a username from a website that has the username as the base url.
 *
 * Example:
 * - https://facebook.com/facebook
 */
export const WEBSITE_LINK_ISOLATE_BASE_URL_PROFILE_ID = isolateWebsitePathFunction({
  isolatePathComponents: 0,
  removeTrailingSlash: true,
  removeQueryParameters: true
});

export function usernameFromUsernameOrWebsiteWithBaseUrlUsername(input: ModelKey | WebsiteUrl, prefix?: string) {
  const username = toRelativeSlashPathStartType(WEBSITE_LINK_ISOLATE_BASE_URL_PROFILE_ID(usernameOrWebsiteUrlToWebsiteUrl(input)));

  if (prefix) {
    return addPrefix(prefix, username);
  } else {
    return username;
  }
}

export function usernameFromUsernameOrWebsiteWithOneOffBaseUrlUsername(input: ModelKey | WebsiteUrl, isolateFn: IsolateWebsitePathFunction) {
  return toRelativeSlashPathStartType(isolateFn(usernameOrWebsiteUrlToWebsiteUrl(input)));
}

export function usernameOrWebsiteUrlToWebsiteUrl(input: string): WebsiteUrl {
  return hasWebsiteDomain(input) ? input : toAbsoluteSlashPathStartType(removeHttpFromUrl(input));
}

// MARK: Website
export const WEBSITE_URL_WEBSITE_LINK_TYPE = 'w';

export function websiteUrlToWebsiteLink(input: WebsiteUrl): WebsiteLink {
  return {
    t: WEBSITE_URL_WEBSITE_LINK_TYPE,
    d: removeHttpFromUrl(input) // website urls are stored as-is without http/https
  };
}

// MARK: Email
export const EMAIL_URL_WEBSITE_LINK_TYPE = 'e';

export function emailAddressToWebsiteLink(input: EmailAddress): WebsiteLink {
  return {
    t: EMAIL_URL_WEBSITE_LINK_TYPE,
    d: input
  };
}

// MARK: Phone
export const PHONE_URL_WEBSITE_LINK_TYPE = 'p';

export function phoneNumberToWebsiteLink(input: E164PhoneNumber): WebsiteLink {
  return {
    t: PHONE_URL_WEBSITE_LINK_TYPE,
    d: input
  };
}

// MARK: Facebook
export const FACEBOOK_BASE_URL = `https://www.facebook.com`;
export const FACEBOOK_WEBSITE_LINK_TYPE: WebsiteLinkType = 'fb';

export type FacebookBaseUrl = typeof FACEBOOK_BASE_URL;
export type FacebookProfileUrl<P extends FacebookProfileId> = `${FacebookBaseUrl}/${P}`;
export type FacebookProfileId = string;
export type FacebookWebsiteLinkType = typeof FACEBOOK_WEBSITE_LINK_TYPE;

export function facebookProfileUrlToWebsiteLink(input: FacebookProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: FACEBOOK_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithBaseUrlUsername(input)
  };
}

export function facebookProfileUrl<P extends FacebookProfileId>(profileId: P): FacebookProfileUrl<P> {
  return `${FACEBOOK_BASE_URL}/${profileId}`;
}

// MARK: Instagram
export const INSTAGRAM_BASE_URL = `https://www.instagram.com`;
export const INSTAGRAM_WEBSITE_LINK_TYPE: WebsiteLinkType = 'ig';

export type InstagramBaseUrl = typeof INSTAGRAM_BASE_URL;
export type InstagramProfileUrl<P extends InstagramProfileId> = `${InstagramBaseUrl}/${P}`;
export type InstagramProfileId = string;
export type InstagramWebsiteLinkType = typeof INSTAGRAM_WEBSITE_LINK_TYPE;

export function instagramProfileUrlToWebsiteLink(input: InstagramProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: INSTAGRAM_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithBaseUrlUsername(input)
  };
}

export function instagramProfileUrl<P extends InstagramProfileId>(profileId: P): InstagramProfileUrl<P> {
  return `${INSTAGRAM_BASE_URL}/${profileId}`;
}

// MARK: Twitter
export const TWITTER_BASE_URL = `https://www.twitter.com`;
export const TWITTER_WEBSITE_LINK_TYPE: WebsiteLinkType = 'tw';

export type TwitterBaseUrl = typeof TWITTER_BASE_URL;
export type TwitterProfileUrl<P extends TwitterProfileId> = `${TwitterBaseUrl}/${P}`;
export type TwitterProfileId = string;
export type TwitterWebsiteLinkType = typeof TWITTER_WEBSITE_LINK_TYPE;

export function twitterProfileUrlToWebsiteLink(input: TwitterProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: TWITTER_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithBaseUrlUsername(input)
  };
}

export function twitterProfileUrl<P extends TwitterProfileId>(profileId: P): TwitterProfileUrl<P> {
  return `${TWITTER_BASE_URL}/${profileId}`;
}

// MARK: Tiktok
export const TIKTOK_BASE_URL = `https://tiktok.com`;
export const TIKTOK_USERNAME_PREFIX = '@';
export const TIKTOK_WEBSITE_LINK_TYPE: WebsiteLinkType = 'tt';

export type TikTokBaseUrl = typeof TIKTOK_BASE_URL;
export type TikTokProfileUrl<P extends TikTokProfileId> = `${TikTokBaseUrl}/@${P}`;
export type TikTokProfileId = string;

export type TikTokWebsiteLinkType = typeof TIKTOK_WEBSITE_LINK_TYPE;

export function tiktokProfileUrlToWebsiteLink(input: TikTokProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: TIKTOK_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithBaseUrlUsername(input, TIKTOK_USERNAME_PREFIX)
  };
}

export function tiktokProfileUrl<P extends TikTokProfileId>(profileId: P): TikTokProfileUrl<P> {
  return `${TIKTOK_BASE_URL}/@${profileId}`;
}

// MARK: Snapchat
export const SNAPCHAT_BASE_URL = `https://snapchat.com`;
export const SNAPCHAT_WEBSITE_LINK_TYPE: WebsiteLinkType = 'sc';

export type SnapchatBaseUrl = typeof SNAPCHAT_BASE_URL;
export type SnapchatProfileUrl<P extends SnapchatProfileId> = `${SnapchatBaseUrl}/add/${P}`;
export type SnapchatProfileId = string;

export type SnapchatWebsiteLinkType = typeof SNAPCHAT_WEBSITE_LINK_TYPE;

export const SNAPCHAT_WEBSITE_LINK_ISOLATE_PROFILE_ID = isolateWebsitePathFunction({
  ignoredBasePath: 'add',
  isolatePathComponents: 0,
  removeTrailingSlash: true,
  removeQueryParameters: true
});

export function snapchatProfileUrlToWebsiteLink(input: SnapchatProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: SNAPCHAT_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithOneOffBaseUrlUsername(input, SNAPCHAT_WEBSITE_LINK_ISOLATE_PROFILE_ID)
  };
}

export function snapchatProfileUrl<P extends SnapchatProfileId>(profileId: P): SnapchatProfileUrl<P> {
  return `${SNAPCHAT_BASE_URL}/add/${profileId}`;
}

// MARK: YouTube
export const YOUTUBE_BASE_URL = `https://youtube.com`;
export const YOUTUBE_WEBSITE_LINK_TYPE: WebsiteLinkType = 'yt';

export type YouTubeBaseUrl = typeof YOUTUBE_BASE_URL;
export type YouTubeProfileUrl<P extends YouTubeProfileId> = `${YouTubeBaseUrl}/c/${P}`;
export type YouTubeProfileId = string;

export type YouTubeWebsiteLinkType = typeof YOUTUBE_WEBSITE_LINK_TYPE;

export const YOUTUBE_WEBSITE_LINK_ISOLATE_PROFILE_ID = isolateWebsitePathFunction({
  ignoredBasePath: 'c',
  isolatePathComponents: 0,
  removeTrailingSlash: true,
  removeQueryParameters: true
});

export function youtubeProfileUrlToWebsiteLink(input: YouTubeProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: YOUTUBE_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithOneOffBaseUrlUsername(input, YOUTUBE_WEBSITE_LINK_ISOLATE_PROFILE_ID)
  };
}

export function youtubeProfileUrl<P extends YouTubeProfileId>(profileId: P): YouTubeProfileUrl<P> {
  return `${YOUTUBE_BASE_URL}/c/${profileId}`;
}

// MARK: PayPal
export const PAYPAL_BASE_URL = `https://paypal.me`;
export const PAYPAL_WEBSITE_LINK_TYPE: WebsiteLinkType = 'pp';

export type PayPalBaseUrl = typeof PAYPAL_BASE_URL;
export type PayPalProfileUrl<P extends PayPalProfileId> = `${PayPalBaseUrl}/${P}`;
export type PayPalProfileId = string;

export type PayPalWebsiteLinkType = typeof PAYPAL_WEBSITE_LINK_TYPE;

export function paypalProfileUrlToWebsiteLink(input: PayPalProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: PAYPAL_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithBaseUrlUsername(input)
  };
}

export function paypalProfileUrl<P extends PayPalProfileId>(profileId: P): PayPalProfileUrl<P> {
  return `${PAYPAL_BASE_URL}/${profileId}`;
}

// MARK: Cashapp
export const CASHAPP_BASE_URL = `https://cash.app`;
export const CASHAPP_USERNAME_PREFIX = '$';
export const CASHAPP_WEBSITE_LINK_TYPE: WebsiteLinkType = 'ca';

export type CashappBaseUrl = typeof CASHAPP_BASE_URL;
export type CashappProfileUrl<P extends CashappProfileId> = `${CashappBaseUrl}/$${P}`;
export type CashappProfileId = string;

export type CashappWebsiteLinkType = typeof CASHAPP_WEBSITE_LINK_TYPE;

export function cashappProfileUrlToWebsiteLink(input: CashappProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: CASHAPP_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithBaseUrlUsername(input, CASHAPP_USERNAME_PREFIX)
  };
}

export function cashappProfileUrl<P extends CashappProfileId>(profileId: P): CashappProfileUrl<P> {
  return `${CASHAPP_BASE_URL}/$${profileId}`;
}

// MARK: Venmo
export const VENMO_BASE_URL = `https://account.venmo.com`;
export const VENMO_WEBSITE_LINK_TYPE: WebsiteLinkType = 'vn';

export type VenmoBaseUrl = typeof VENMO_BASE_URL;
export type VenmoProfileUrl<P extends VenmoProfileId> = `${VenmoBaseUrl}/u/${P}`;
export type VenmoProfileId = string;

export type VenmoWebsiteLinkType = typeof VENMO_WEBSITE_LINK_TYPE;

export const VENMO_WEBSITE_LINK_ISOLATE_PROFILE_ID = isolateWebsitePathFunction({
  ignoredBasePath: 'u',
  isolatePathComponents: 0,
  removeTrailingSlash: true,
  removeQueryParameters: true
});

export function venmoProfileUrlToWebsiteLink(input: VenmoProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: VENMO_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithOneOffBaseUrlUsername(input, VENMO_WEBSITE_LINK_ISOLATE_PROFILE_ID)
  };
}

export function venmoProfileUrl<P extends VenmoProfileId>(profileId: P): VenmoProfileUrl<P> {
  return `${VENMO_BASE_URL}/u/${profileId}`;
}

// MARK: Spotify
export const SPOTIFY_BASE_URL = `https://open.spotify.com/`;
export const SPOTIFY_WEBSITE_LINK_TYPE: WebsiteLinkType = 'sp';

export type SpotifyBaseUrl = typeof SPOTIFY_BASE_URL;
export type SpotifyProfileUrl<P extends SpotifyProfileId> = `${SpotifyBaseUrl}/user/${P}`;
export type SpotifyProfileId = string;

export type SpotifyWebsiteLinkType = typeof SPOTIFY_WEBSITE_LINK_TYPE;

export const SPOTIFY_WEBSITE_LINK_ISOLATE_PROFILE_ID = isolateWebsitePathFunction({
  ignoredBasePath: 'user',
  isolatePathComponents: 0,
  removeTrailingSlash: true,
  removeQueryParameters: true
});

export function spotifyProfileUrlToWebsiteLink(input: SpotifyProfileId | WebsiteUrl): WebsiteLink {
  return {
    t: SPOTIFY_WEBSITE_LINK_TYPE,
    d: usernameFromUsernameOrWebsiteWithOneOffBaseUrlUsername(input, SPOTIFY_WEBSITE_LINK_ISOLATE_PROFILE_ID)
  };
}

export function spotifyProfileUrl<P extends SpotifyProfileId>(profileId: P): SpotifyProfileUrl<P> {
  return `${SPOTIFY_BASE_URL}/user/${profileId}`;
}
