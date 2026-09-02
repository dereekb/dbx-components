import { ChangeDetectionStrategy, Component, computed, inject, Injector, input } from '@angular/core';
import { DBX_AVATAR_CONTEXT_DATA_TOKEN, type DbxAvatarContext, type DbxAvatarImageFit, type DbxAvatarKey, type DbxAvatarSelector, type DbxAvatarSize, type DbxAvatarStyle } from './avatar';
import { DbxAvatarViewService } from './avatar.service';
import { type AuthUserIdentifier, DbxInjectionComponent, type DbxInjectionComponentConfig, mergeStaticProviders } from '@dereekb/dbx-core';
import { type Maybe, type WebsiteUrlWithPrefix } from '@dereekb/util';
import { type DbxColorInput, type DbxColorTone } from '../style/style';

/**
 * Renders an avatar by dynamically injecting the appropriate avatar view component based on the provided context.
 *
 * Merges individual input properties with the optional `context` input and delegates rendering
 * to the component resolved by {@link DbxAvatarViewService}. Supports size variants via CSS classes.
 *
 * Renders an image when one is available, then name initials on a curated color, then a Material icon.
 * With `[avatarTile]` the avatar takes the `<dbx-icon-tile>` presentation — every `--dbx-icon-tile-*`
 * customization applies and `[avatarColor]` / `[avatarColorTone]` paint the tile surface — which makes
 * it the right choice for a branded row (a connected app, an integration) rather than a person.
 *
 * @dbxWebComponent
 * @dbxWebSlug avatar
 * @dbxWebCategory layout
 * @dbxWebRelated icon-tile, dbx-color, avatar-view
 * @dbxWebMinimalExample ```html
 * <dbx-avatar [avatarUrl]="user.photoUrl"></dbx-avatar>
 * ```
 *
 * @example
 * ```html
 * <dbx-avatar [avatarUrl]="user.photoUrl" [avatarStyle]="'circle'" [avatarSize]="'large'"></dbx-avatar>
 * ```
 *
 * @example
 * ```html
 * <!-- branded tile: logo image when there is one, Material icon otherwise -->
 * <dbx-avatar [avatarTile]="true" avatarStyle="square" [avatarUrl]="provider.logoUrl" avatarIcon="link" [avatarIgnoreDefaultUrl]="true" avatarColor="success" [avatarColorTone]="18"></dbx-avatar>
 * ```
 *
 * @example
 * ```html
 * <dbx-avatar [context]="avatarContext"></dbx-avatar>
 * ```
 */
@Component({
  selector: 'dbx-avatar',
  template: `
    <dbx-injection [config]="configSignal()"></dbx-injection>
  `,
  imports: [DbxInjectionComponent],
  host: {
    class: 'dbx-avatar',
    '[class.dbx-avatar-small]': `avatarSize() === 'small'`,
    '[class.dbx-avatar-large]': `avatarSize() === 'large'`
  }
})
export class DbxAvatarComponent {
  readonly injector = inject(Injector);
  readonly avatarService = inject(DbxAvatarViewService);

  readonly context = input<DbxAvatarContext>();

  readonly avatarSelector = input<Maybe<DbxAvatarSelector>>();
  readonly avatarUid = input<Maybe<AuthUserIdentifier>>();
  readonly avatarUrl = input<Maybe<WebsiteUrlWithPrefix>>();
  readonly avatarName = input<Maybe<string>>();
  readonly avatarKey = input<Maybe<DbxAvatarKey>>();
  readonly avatarIcon = input<Maybe<string>>();
  readonly avatarStyle = input<Maybe<DbxAvatarStyle>>();
  readonly avatarSize = input<Maybe<DbxAvatarSize>>(undefined);
  readonly avatarHideOnError = input<Maybe<boolean>>();
  readonly avatarTile = input<Maybe<boolean>>();
  readonly avatarColor = input<Maybe<DbxColorInput>>();
  readonly avatarColorTone = input<Maybe<DbxColorTone>>();
  readonly avatarImageFit = input<Maybe<DbxAvatarImageFit>>();
  readonly avatarImageFilter = input<Maybe<string>>();
  readonly avatarIgnoreDefaultUrl = input<Maybe<boolean>>();

  // NOTE: every DbxAvatarContext field is enumerated here. A field added to the interface and to the
  // inputs above but forgotten here silently does nothing when bound as an input.
  readonly contextSignal = computed<DbxAvatarContext>(() => {
    const inputContext = this.context();

    const selector = this.avatarSelector() ?? inputContext?.selector;
    const uid = this.avatarUid() ?? inputContext?.uid;
    const url = this.avatarUrl() ?? inputContext?.url;
    const name = this.avatarName() ?? inputContext?.name;
    const key = this.avatarKey() ?? inputContext?.key;
    const icon = this.avatarIcon() ?? inputContext?.icon;
    const style = this.avatarStyle() ?? inputContext?.style;
    const hideOnError = this.avatarHideOnError() ?? inputContext?.hideOnError;
    const tile = this.avatarTile() ?? inputContext?.tile;
    const color = this.avatarColor() ?? inputContext?.color;
    const colorTone = this.avatarColorTone() ?? inputContext?.colorTone;
    const imageFit = this.avatarImageFit() ?? inputContext?.imageFit;
    const imageFilter = this.avatarImageFilter() ?? inputContext?.imageFilter;
    const ignoreDefaultUrl = this.avatarIgnoreDefaultUrl() ?? inputContext?.ignoreDefaultUrl;

    return {
      selector,
      uid,
      url,
      name,
      key,
      icon,
      style,
      hideOnError,
      tile,
      color,
      colorTone,
      imageFit,
      imageFilter,
      ignoreDefaultUrl
    };
  });

  readonly configSignal = computed(() => {
    const context = this.contextSignal();
    const returnedConfig = this.avatarService.avatarComponentForContext(context);

    const dataProvider = {
      provide: DBX_AVATAR_CONTEXT_DATA_TOKEN,
      useValue: context
    };

    const injector = Injector.create({
      parent: this.injector,
      providers: mergeStaticProviders(dataProvider, returnedConfig.providers)
    });

    const config: DbxInjectionComponentConfig = {
      ...returnedConfig,
      injector
    };

    return config;
  });
}
