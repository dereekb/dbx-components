import { InjectionToken } from '@angular/core';
import { AuthUserIdentifier } from '@dereekb/dbx-core';
import { Maybe, WebsiteUrlWithPrefix } from '@dereekb/util';

/**
 * Arbitrary string selector used to differentiate avatars.
 */
export type DbxAvatarSelector = string;

/**
 * Arbitrary key that is used to configure an avatar path.
 */
export type DbxAvatarKey = string;

/**
 * Provides contextual information for displaying an avatar.
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
   * Arbitrary key that is used to configure an avatar.
   */
  readonly key?: Maybe<DbxAvatarKey>;
}

// MARK: Injection Token
/**
 * Injection token for the avatar context data.
 */
export const DBX_AVATAR_CONTEXT_DATA_TOKEN = new InjectionToken<DbxAvatarContext>('DbxAvatarContextData');
