import { InjectionToken } from '@angular/core';
import { type AuthUserIdentifier } from '@dereekb/dbx-core';
import { type Maybe, type WebsiteUrlWithPrefix } from '@dereekb/util';
import { type DbxColorInput, type DbxColorTone } from '../style/style';

/**
 * Arbitrary string selector used to differentiate avatars by category or context.
 */
export type DbxAvatarSelector = string;

/**
 * Arbitrary key used to configure an avatar from a predefined set of avatar options.
 */
export type DbxAvatarKey = string;

/**
 * Shape style applied to the avatar container. Defaults to `'circle'` when not specified.
 */
export type DbxAvatarStyle = 'circle' | 'square';

/**
 * Size variant for the avatar display. Controls the rendered dimensions of the avatar.
 */
export type DbxAvatarSize = 'small' | 'normal' | 'large';

/**
 * How an avatar image is fitted into the avatar box.
 *
 * `'cover'` fills the box and crops (the right choice for a photo); `'contain'` fits the whole image
 * inside the box (the right choice for a brand logo, which must never be cropped).
 */
export type DbxAvatarImageFit = 'cover' | 'contain';

/**
 * Contextual information for displaying an avatar, including its image URL, fallback icon, style, and user association.
 *
 * Passed to avatar components via the {@link DBX_AVATAR_CONTEXT_DATA_TOKEN} injection token.
 */
export interface DbxAvatarContext {
  /**
   * An arbitrary discriminator used to differentiate avatars.
   */
  readonly selector?: Maybe<DbxAvatarSelector>;
  /**
   * User identifier.
   *
   * May be used in some cases to display a user-specific avatar.
   */
  readonly uid?: Maybe<AuthUserIdentifier>;
  /**
   * A full website URL to an avatar image.
   */
  readonly url?: Maybe<WebsiteUrlWithPrefix>;
  /**
   * Name or characters used to render initials (e.g. `'Michelle B'` -> `'MB'`, `'BB'` -> `'BB'`) on a
   * curated color background when no avatar image is shown. The same value always maps to the same
   * curated color.
   */
  readonly name?: Maybe<string>;
  /**
   * Arbitrary key that is used to configure an avatar.
   */
  readonly key?: Maybe<DbxAvatarKey>;
  /**
   * The avatar style.
   */
  readonly style?: DbxAvatarStyle;
  /**
   * Icon name to use for the fallback avatar when no image is provided.
   */
  readonly icon?: Maybe<string>;
  /**
   * If true, when the image cannot be loaded then the entire avatar view should be hidden.
   */
  readonly hideOnError?: Maybe<boolean>;
  /**
   * If true, the avatar renders with the `<dbx-icon-tile>` presentation: the avatar view takes the
   * `dbx-icon-tile` class, so the `--dbx-icon-tile-*` customizations and the tile's `[dbxColor]`
   * surface apply. Use it for a branded/iconographic avatar rather than a person's photo.
   */
  readonly tile?: Maybe<boolean>;
  /**
   * Color painted behind the avatar. Pair with {@link colorTone} for a tonal (muted) surface.
   */
  readonly color?: Maybe<DbxColorInput>;
  /**
   * Background tone level (0-100) for {@link color}.
   */
  readonly colorTone?: Maybe<DbxColorTone>;
  /**
   * How the avatar image fills the avatar box. Defaults to `'contain'` in {@link tile} mode (a logo
   * must not be cropped) and `'cover'` otherwise.
   */
  readonly imageFit?: Maybe<DbxAvatarImageFit>;
  /**
   * Optional CSS filter applied to the avatar image (e.g. `'brightness(0) invert(1)'` to force a
   * single-color logo to render white).
   */
  readonly imageFilter?: Maybe<string>;
  /**
   * If true, `DbxAvatarViewService.defaultAvatarUrl` is not used when no url is available.
   *
   * That default is an app-wide *person* placeholder; an avatar that means to fall through to its
   * {@link icon} (a provider tile, say) has to be able to opt out of it.
   */
  readonly ignoreDefaultUrl?: Maybe<boolean>;
}

// MARK: Injection Token
/**
 * Injection token for the avatar context data.
 */
export const DBX_AVATAR_CONTEXT_DATA_TOKEN = new InjectionToken<DbxAvatarContext>('DbxAvatarContextData');
