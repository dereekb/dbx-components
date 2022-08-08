import {
  facebookProfileUrlToWebsiteLink,
  FACEBOOK_WEBSITE_LINK_TYPE,
  instagramProfileUrlToWebsiteLink,
  INSTAGRAM_WEBSITE_LINK_TYPE,
  paypalProfileUrlToWebsiteLink,
  PAYPAL_WEBSITE_LINK_TYPE,
  snapchatProfileUrlToWebsiteLink,
  SNAPCHAT_WEBSITE_LINK_TYPE,
  tiktokProfileUrlToWebsiteLink,
  TIKTOK_WEBSITE_LINK_TYPE,
  twitterProfileUrlToWebsiteLink,
  TWITTER_WEBSITE_LINK_TYPE,
  youtubeProfileUrlToWebsiteLink,
  YOUTUBE_WEBSITE_LINK_TYPE,
  CASHAPP_USERNAME_PREFIX,
  cashappProfileUrlToWebsiteLink,
  CASHAPP_WEBSITE_LINK_TYPE,
  venmoProfileUrlToWebsiteLink,
  venmoProfileUrl,
  VENMO_WEBSITE_LINK_TYPE,
  spotifyProfileUrl,
  spotifyProfileUrlToWebsiteLink,
  SPOTIFY_WEBSITE_LINK_TYPE,
  websiteUrlToWebsiteLink,
  WEBSITE_URL_WEBSITE_LINK_TYPE
} from './link.website';

describe('websiteProfileUrlToWebsiteLink()', () => {
  it('should create a WebsiteLink from the url', () => {
    const domainAndPath = 'components.dereekb.com/landing';
    const input = `https://` + domainAndPath;
    const { t, d } = websiteUrlToWebsiteLink(input);
    expect(d).toBe(domainAndPath);
    expect(t).toBe(WEBSITE_URL_WEBSITE_LINK_TYPE);
  });
});

describe('facebookProfileUrlToWebsiteLink()', () => {
  const username = 'facebook';

  it('should create a WebsiteLink from a full path', () => {
    const input = `https://www.facebook.com/${username}`;
    const { t, d } = facebookProfileUrlToWebsiteLink(input);
    expect(d).toBe(username);
    expect(t).toBe(FACEBOOK_WEBSITE_LINK_TYPE);
  });

  it('should create a WebsiteLink from the username', () => {
    const input = username;
    const { t, d } = facebookProfileUrlToWebsiteLink(input);
    expect(d).toBe(username);
    expect(t).toBe(FACEBOOK_WEBSITE_LINK_TYPE);
  });
});

describe('instagramProfileUrlToWebsiteLink()', () => {
  const username = 'instagram';

  it('should create a WebsiteLink from a full path', () => {
    const input = `https://www.instagram.com/${username}`;
    const { t, d } = instagramProfileUrlToWebsiteLink(input);
    expect(d).toBe(username);
    expect(t).toBe(INSTAGRAM_WEBSITE_LINK_TYPE);
  });

  it('should create a WebsiteLink from the username', () => {
    const input = username;
    const { t, d } = instagramProfileUrlToWebsiteLink(input);
    expect(d).toBe(username);
    expect(t).toBe(INSTAGRAM_WEBSITE_LINK_TYPE);
  });
});

describe('twitterProfileUrlToWebsiteLink()', () => {
  const username = 'twitter';

  it('should create a WebsiteLink from a full path', () => {
    const input = `https://www.twitter.com/${username}`;
    const { t, d } = twitterProfileUrlToWebsiteLink(input);
    expect(d).toBe(username);
    expect(t).toBe(TWITTER_WEBSITE_LINK_TYPE);
  });

  it('should create a WebsiteLink from the username', () => {
    const input = username;
    const { t, d } = twitterProfileUrlToWebsiteLink(input);
    expect(d).toBe(username);
    expect(t).toBe(TWITTER_WEBSITE_LINK_TYPE);
  });
});

describe('tiktokProfileUrlToWebsiteLink()', () => {
  const prefix = '@';
  const username = 'tiktok';

  it('should create a WebsiteLink from a full path', () => {
    const input = `https://www.tiktok.com/${prefix + username}`;
    const { t, d } = tiktokProfileUrlToWebsiteLink(input);
    expect(d).toBe(prefix + username);
    expect(t).toBe(TIKTOK_WEBSITE_LINK_TYPE);
  });

  it('should create a WebsiteLink from the username (no prefix)', () => {
    const input = username;
    const { t, d } = tiktokProfileUrlToWebsiteLink(input);
    expect(d).toBe(prefix + username);
    expect(t).toBe(TIKTOK_WEBSITE_LINK_TYPE);
  });

  it('should create a WebsiteLink from the username (prefix)', () => {
    const input = prefix + username;
    const { t, d } = tiktokProfileUrlToWebsiteLink(input);
    expect(d).toBe(prefix + username);
    expect(t).toBe(TIKTOK_WEBSITE_LINK_TYPE);
  });
});

describe('snapchatProfileUrlToWebsiteLink()', () => {
  const username = 'snapchat';

  it('should create a WebsiteLink from a full path', () => {
    const input = `https://www.snapchat.com/add/${username}`;
    const { t, d } = snapchatProfileUrlToWebsiteLink(input);
    expect(d).toBe(username);
    expect(t).toBe(SNAPCHAT_WEBSITE_LINK_TYPE);
  });

  it('should create a WebsiteLink from the username', () => {
    const input = username;
    const { t, d } = snapchatProfileUrlToWebsiteLink(input);
    expect(d).toBe(username);
    expect(t).toBe(SNAPCHAT_WEBSITE_LINK_TYPE);
  });
});

describe('youtubeProfileUrlToWebsiteLink()', () => {
  const username = 'youtube';

  it('should create a WebsiteLink from a full path', () => {
    const input = `https://www.youtube.com/c/${username}`;
    const { t, d } = youtubeProfileUrlToWebsiteLink(input);
    expect(d).toBe(username);
    expect(t).toBe(YOUTUBE_WEBSITE_LINK_TYPE);
  });

  it('should create a WebsiteLink from the username', () => {
    const input = username;
    const { t, d } = youtubeProfileUrlToWebsiteLink(input);
    expect(d).toBe(username);
    expect(t).toBe(YOUTUBE_WEBSITE_LINK_TYPE);
  });
});

describe('paypalProfileUrlToWebsiteLink()', () => {
  const username = 'paypal';

  it('should create a WebsiteLink from a full path', () => {
    const input = `https://www.paypal.com/${username}`;
    const { t, d } = paypalProfileUrlToWebsiteLink(input);
    expect(d).toBe(username);
    expect(t).toBe(PAYPAL_WEBSITE_LINK_TYPE);
  });

  it('should create a WebsiteLink from the username', () => {
    const input = username;
    const { t, d } = paypalProfileUrlToWebsiteLink(input);
    expect(d).toBe(username);
    expect(t).toBe(PAYPAL_WEBSITE_LINK_TYPE);
  });
});

describe('cashappProfileUrlToWebsiteLink()', () => {
  const prefix = CASHAPP_USERNAME_PREFIX;
  const username = 'cashapp';

  it('should create a WebsiteLink from a full path', () => {
    const input = `https://cash.app/${prefix + username}`;
    const { t, d } = cashappProfileUrlToWebsiteLink(input);
    expect(d).toBe(prefix + username);
    expect(t).toBe(CASHAPP_WEBSITE_LINK_TYPE);
  });

  it('should create a WebsiteLink from the username (no prefix)', () => {
    const input = username;
    const { t, d } = cashappProfileUrlToWebsiteLink(input);
    expect(d).toBe(prefix + username);
    expect(t).toBe(CASHAPP_WEBSITE_LINK_TYPE);
  });

  it('should create a WebsiteLink from the username (prefix)', () => {
    const input = prefix + username;
    const { t, d } = cashappProfileUrlToWebsiteLink(input);
    expect(d).toBe(prefix + username);
    expect(t).toBe(CASHAPP_WEBSITE_LINK_TYPE);
  });
});

describe('venmoProfileUrlToWebsiteLink()', () => {
  const username = 'venmo';

  it('should create a WebsiteLink from a full path', () => {
    const input = venmoProfileUrl(username);
    const { t, d } = venmoProfileUrlToWebsiteLink(input);
    expect(d).toBe(username);
    expect(t).toBe(VENMO_WEBSITE_LINK_TYPE);
  });

  it('should create a WebsiteLink from the username', () => {
    const input = username;
    const { t, d } = venmoProfileUrlToWebsiteLink(input);
    expect(d).toBe(username);
    expect(t).toBe(VENMO_WEBSITE_LINK_TYPE);
  });
});

describe('spotifyProfileUrlToWebsiteLink()', () => {
  const username = 'spotify';

  it('should create a WebsiteLink from a full path', () => {
    const input = spotifyProfileUrl(username);
    const { t, d } = spotifyProfileUrlToWebsiteLink(input);
    expect(d).toBe(username);
    expect(t).toBe(SPOTIFY_WEBSITE_LINK_TYPE);
  });

  it('should create a WebsiteLink from the username', () => {
    const input = username;
    const { t, d } = spotifyProfileUrlToWebsiteLink(input);
    expect(d).toBe(username);
    expect(t).toBe(SPOTIFY_WEBSITE_LINK_TYPE);
  });
});
