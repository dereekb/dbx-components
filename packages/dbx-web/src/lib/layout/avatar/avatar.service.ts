import { inject, Injectable } from '@angular/core';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxAvatarViewComponent } from './avatar.view.component';
import { DbxAvatarContext } from './avatar';
import { Maybe, WebsitePath, WebsiteUrlWithPrefix } from '@dereekb/util';

/**
 * The injection configuration for a DbxAvatar component.
 *
 * Not allowed to override the injector.
 *
 * The final injector that will be passed will provide DBX_AVATAR_CONTEXT_DATA_TOKEN.
 */
export type DbxAvatarInjectionComponentConfig = Omit<DbxInjectionComponentConfig, 'injector'>;

/**
 * Function that returns a DbxInjectionComponentConfig for the given context.
 *
 * Can return null/undefined if the default avatar component should be used.
 *
 * @param context The current context input.
 */
export type DbxAvatarComponentForContextFunction = (context: DbxAvatarContext) => Maybe<DbxAvatarInjectionComponentConfig>;

/**
 * Configuration for a DbxAvatarViewService.
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
 * Service for registering avatars.
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

  setDefaultAvatarUrl(url: Maybe<WebsitePath | WebsiteUrlWithPrefix>) {
    this._defaultAvatarUrl = url;
  }

  setDefaultAvatarIcon(icon: Maybe<string>) {
    this._defaultAvatarIcon = icon;
  }

  setDefaultAvatarErrorIcon(icon: Maybe<string>) {
    this._defaultAvatarErrorIcon = icon;
  }

  setDefaultAvatarComponentConfig(config: DbxAvatarInjectionComponentConfig) {
    this._defaultAvatarComponentConfig = config;
  }
}
