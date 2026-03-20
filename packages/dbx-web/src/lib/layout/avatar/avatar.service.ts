import { inject, Injectable } from '@angular/core';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxAvatarViewComponent } from './avatar.view.component';
import { type DbxAvatarContext } from './avatar';
import { type Maybe, type WebsitePath, type WebsiteUrlWithPrefix } from '@dereekb/util';

/**
 * Injection component configuration for an avatar view, excluding the `injector` property.
 *
 * The injector is managed internally by {@link DbxAvatarComponent} to provide
 * {@link DBX_AVATAR_CONTEXT_DATA_TOKEN} with the current avatar context.
 */
export type DbxAvatarInjectionComponentConfig = Omit<DbxInjectionComponentConfig, 'injector'>;

/**
 * Returns a component configuration for the given avatar context, allowing context-specific avatar rendering.
 *
 * Return `null` or `undefined` to fall back to the default avatar component.
 */
export type DbxAvatarComponentForContextFunction = (context: DbxAvatarContext) => Maybe<DbxAvatarInjectionComponentConfig>;

/**
 * Abstract configuration class for customizing the avatar view service defaults.
 *
 * Provide this via Angular DI to configure default URLs, icons, and component overrides
 * for all avatar instances in the application.
 */
export abstract class DbxAvatarViewServiceConfig {
  /**
   * The default avatar URL to use in DbxAvatarViewComponent if no other url is available
   */
  readonly defaultAvatarUrl?: Maybe<WebsitePath | WebsiteUrlWithPrefix>;
  /**
   * The default fallback icon to use when no avatar image is provided.
   */
  readonly defaultAvatarIcon?: Maybe<string>;
  /**
   * The default fallback icon to use when an avatar image is provided but fails to load.
   */
  readonly defaultAvatarErrorIcon?: Maybe<string>;
  /**
   * Overrides the default avatar component.
   */
  readonly defaultAvatarComponentConfig?: Maybe<DbxAvatarInjectionComponentConfig>;
  /**
   * Custom function that returns a DbxInjectionComponentConfig for the given context.
   */
  readonly avatarComponentForContext?: DbxAvatarComponentForContextFunction;
}

/**
 * Root-level service that manages avatar defaults and resolves the avatar component to render for a given context.
 *
 * Provides fallback URLs, icons, and component configurations used by {@link DbxAvatarComponent}
 * and {@link DbxAvatarViewComponent}. Configure application-wide defaults by providing {@link DbxAvatarViewServiceConfig}.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxAvatarViewService {
  private readonly _serviceConfig = inject(DbxAvatarViewServiceConfig, { optional: true });

  private _defaultAvatarUrl: Maybe<WebsitePath | WebsiteUrlWithPrefix> = this._serviceConfig?.defaultAvatarUrl;
  private _defaultAvatarIcon: Maybe<string> = this._serviceConfig?.defaultAvatarIcon ?? 'person';
  private _defaultAvatarErrorIcon: Maybe<string>;

  private _defaultAvatarComponentConfig: DbxAvatarInjectionComponentConfig = this._serviceConfig?.defaultAvatarComponentConfig ?? {
    componentClass: DbxAvatarViewComponent
  };

  private _avatarComponentForContext?: DbxAvatarComponentForContextFunction = this._serviceConfig?.avatarComponentForContext;

  /**
   * Resolves the injection component configuration for the given avatar context.
   *
   * Falls back to the default component config if no custom resolver is configured or if it returns null.
   *
   * @param context - the avatar context used to resolve the appropriate component configuration
   * @returns the resolved injection component config, or the default if no custom resolver matches
   */
  avatarComponentForContext(context: DbxAvatarContext): DbxAvatarInjectionComponentConfig {
    let config: DbxAvatarInjectionComponentConfig = this._defaultAvatarComponentConfig;

    if (this._avatarComponentForContext) {
      config = this._avatarComponentForContext(context) ?? config;
    }

    return config;
  }

  get defaultAvatarUrl() {
    return this._defaultAvatarUrl;
  }

  get defaultAvatarIcon() {
    return this._defaultAvatarIcon;
  }

  get defaultAvatarErrorIcon() {
    return this._defaultAvatarErrorIcon;
  }

  /**
   * Sets the default avatar image URL used when no context-specific URL is provided.
   *
   * @param url - the URL to use as the default avatar image, or nullish to clear
   */
  setDefaultAvatarUrl(url: Maybe<WebsitePath | WebsiteUrlWithPrefix>) {
    this._defaultAvatarUrl = url;
  }

  /**
   * Sets the default Material icon name used as a fallback when no avatar image is available.
   *
   * @param icon - the Material icon name to use, or nullish to clear
   */
  setDefaultAvatarIcon(icon: Maybe<string>) {
    this._defaultAvatarIcon = icon;
  }

  /**
   * Sets the Material icon name displayed when the avatar image fails to load.
   *
   * @param icon - the Material icon name to display on image load error, or nullish to clear
   */
  setDefaultAvatarErrorIcon(icon: Maybe<string>) {
    this._defaultAvatarErrorIcon = icon;
  }

  /**
   * Overrides the default component used to render avatars when no context-specific component is resolved.
   *
   * @param config - the injection component config to use as the new default
   */
  setDefaultAvatarComponentConfig(config: DbxAvatarInjectionComponentConfig) {
    this._defaultAvatarComponentConfig = config;
  }
}
