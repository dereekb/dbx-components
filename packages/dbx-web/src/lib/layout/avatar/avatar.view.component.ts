import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { type Maybe, nameToInitials, type WebsitePath, type WebsiteUrlWithPrefix } from '@dereekb/util';
import { DbxAvatarViewService } from './avatar.service';
import { type DbxAvatarContext, DBX_AVATAR_CONTEXT_DATA_TOKEN, type DbxAvatarImageFit, type DbxAvatarStyle } from './avatar';
import { DbxColorDirective } from '../style/style.color.directive';
import { DbxColorService } from '../style/style.color.service';
import { type DbxColorConfig, type DbxColorInput, type DbxColorTone, dbxCuratedColorConfigForString } from '../style/style';

/**
 * Displays an avatar image with automatic fallback to name initials and then a Material icon when no image is
 * available or when the image fails to load.
 *
 * Supports circle and square styles, and can optionally hide entirely on image error.
 * Receives context via the {@link DBX_AVATAR_CONTEXT_DATA_TOKEN} injection token or direct inputs.
 *
 * In tile mode the host also takes the `dbx-icon-tile` class, so the `--dbx-icon-tile-*` customizations and the
 * tile's own `.dbx-color` surface rule apply to the avatar. The color is pushed into the host
 * {@link DbxColorDirective} rather than bound by the caller, since the avatar view is usually created dynamically
 * by {@link DbxAvatarComponent} and has no template bindings of its own.
 *
 * @example
 * ```html
 * <dbx-avatar-view [avatarUrl]="user.photoUrl" [avatarStyle]="'circle'" [avatarIcon]="'account_circle'"></dbx-avatar-view>
 * ```
 */
@Component({
  selector: 'dbx-avatar-view',
  template: `
    @if (avatarUrlSignal()) {
      <img (error)="onAvatarImageError($event)" class="dbx-avatar-view-img" [class.dbx-avatar-view-img-contain]="avatarImageFitSignal() === 'contain'" [style.filter]="avatarImageFilterSignal()" [src]="avatarUrlSignal()!" alt="." loading="lazy" decoding="async" />
    } @else if (initialsSignal()) {
      <div class="dbx-avatar-view-initials" [dbxColor]="curatedColorSignal()" aria-hidden="true">{{ initialsSignal() }}</div>
    } @else {
      <div class="dbx-avatar-view-fallback" aria-hidden="true">
        <mat-icon>{{ avatarIconSignal() }}</mat-icon>
      </div>
    }
  `,
  host: {
    class: 'dbx-avatar-view',
    '[class.dbx-avatar-view-error]': 'hasAvatarErrorSignal()',
    '[class.dbx-avatar-view-circle]': 'avatarStyleClassSignal() === "circle"',
    '[class.dbx-avatar-view-square]': 'avatarStyleClassSignal() === "square"',
    '[class.dbx-avatar-view-with-avatar]': 'hasAvatarSignal()',
    '[class.dbx-avatar-view-no-avatar]': 'missingAvatarSignal()',
    '[class.dbx-avatar-view-with-initials]': 'hasInitialsSignal()',
    '[class.dbx-avatar-view-hide-avatar]': 'hideAvatarSignal()',
    // both: `dbx-icon-tile` brings the tile's presentation and customization vocabulary, and
    // `dbx-avatar-view-tile` is the avatar-owned marker its overrides are scoped on.
    '[class.dbx-icon-tile]': 'avatarTileSignal()',
    '[class.dbx-avatar-view-tile]': 'avatarTileSignal()'
  },
  imports: [MatIconModule, DbxColorDirective],
  hostDirectives: [DbxColorDirective]
})
export class DbxAvatarViewComponent {
  readonly defaultContext: Maybe<DbxAvatarContext> = inject(DBX_AVATAR_CONTEXT_DATA_TOKEN, { optional: true });

  readonly avatarService = inject(DbxAvatarViewService);
  readonly colorService = inject(DbxColorService, { optional: true });

  readonly defaultAvatarUrl = this.avatarService.defaultAvatarUrl;

  readonly avatarUrl = input<Maybe<WebsiteUrlWithPrefix>>();
  readonly avatarErrorUrlSignal = signal<Maybe<boolean | WebsiteUrlWithPrefix>>(null);

  readonly avatarName = input<Maybe<string>>();
  readonly avatarStyle = input<Maybe<DbxAvatarStyle>>();
  readonly avatarIcon = input<Maybe<string>>();
  readonly avatarHideOnError = input<Maybe<boolean>>();
  readonly avatarTile = input<Maybe<boolean>>();
  readonly avatarColor = input<Maybe<DbxColorInput>>();
  readonly avatarColorTone = input<Maybe<DbxColorTone>>();
  readonly avatarImageFit = input<Maybe<DbxAvatarImageFit>>();
  readonly avatarImageFilter = input<Maybe<string>>();
  readonly avatarIgnoreDefaultUrl = input<Maybe<boolean>>();

  constructor() {
    const dbxColorDirective = inject(DbxColorDirective, { self: true });

    // Pushes the resolved color/tone into the host DbxColorDirective, which provides the color tokens and the
    // `.dbx-color` marker the surface paints from. Both are models for exactly this: the avatar view is created
    // dynamically, so the caller has no element to bind the directive's inputs on.
    effect(() => {
      dbxColorDirective.dbxColor.set(this.avatarColorSignal());
      dbxColorDirective.dbxColorTone.set(this.avatarColorToneSignal());
    });
  }

  readonly avatarHideOnErrorSignal = computed(() => {
    return this.avatarHideOnError() ?? this.defaultContext?.hideOnError ?? false;
  });

  readonly avatarTileSignal = computed(() => this.avatarTile() ?? this.defaultContext?.tile ?? false);

  readonly avatarColorSignal = computed<Maybe<DbxColorInput>>(() => this.avatarColor() ?? this.defaultContext?.color);
  readonly avatarColorToneSignal = computed<Maybe<DbxColorTone>>(() => this.avatarColorTone() ?? this.defaultContext?.colorTone);
  readonly avatarImageFilterSignal = computed<Maybe<string>>(() => this.avatarImageFilter() ?? this.defaultContext?.imageFilter);

  /**
   * A tile is a branded surface, so its image defaults to `'contain'` — cropping a logo is never right.
   */
  readonly avatarImageFitSignal = computed<DbxAvatarImageFit>(() => {
    const avatarTile = this.avatarTileSignal();
    return this.avatarImageFit() ?? this.defaultContext?.imageFit ?? (avatarTile ? 'contain' : 'cover');
  });

  readonly avatarIgnoreDefaultUrlSignal = computed(() => this.avatarIgnoreDefaultUrl() ?? this.defaultContext?.ignoreDefaultUrl ?? false);

  readonly currentAvatarUrlSignal = computed<Maybe<WebsiteUrlWithPrefix | WebsitePath>>(() => {
    const directUrl = this.avatarUrl();
    const contextUrl = this.defaultContext?.url;
    // the service default is an app-wide person placeholder; an avatar that means to fall through to its icon
    // (a provider tile, say) opts out of it rather than rendering someone else's placeholder.
    const serviceDefaultUrl = this.avatarIgnoreDefaultUrlSignal() ? undefined : this.defaultAvatarUrl;

    const url: Maybe<WebsiteUrlWithPrefix | WebsitePath> = directUrl ?? contextUrl ?? serviceDefaultUrl ?? undefined;
    return url;
  });

  readonly hasAvatarErrorSignal = computed(() => {
    const errorUrl = this.avatarErrorUrlSignal();
    const currentUrl = this.currentAvatarUrlSignal();
    return errorUrl === currentUrl;
  });

  readonly avatarUrlSignal = computed<Maybe<WebsiteUrlWithPrefix | WebsitePath>>(() => {
    let url = this.currentAvatarUrlSignal();
    const hasError = this.hasAvatarErrorSignal();

    if (hasError) {
      url = null;
    }

    return url;
  });

  readonly hasAvatarSignal = computed(() => !!this.avatarUrlSignal());
  readonly missingAvatarSignal = computed(() => !this.hasAvatarSignal());

  readonly avatarStyleClassSignal = computed<'circle' | 'square'>(() => {
    return this.avatarStyle() ?? this.defaultContext?.style ?? 'circle';
  });

  readonly hideAvatarSignal = computed(() => {
    const hideOnError = this.avatarHideOnErrorSignal();
    const hasError = this.hasAvatarErrorSignal();
    return hideOnError && hasError;
  });

  readonly avatarIconSignal = computed(() => {
    const hasAvatarError = this.hasAvatarErrorSignal();
    let icon = this.avatarIcon() ?? this.defaultContext?.icon;

    if (!icon && hasAvatarError) {
      icon = this.avatarService.defaultAvatarErrorIcon;
    } else {
      icon = icon ?? this.avatarService.defaultAvatarIcon;
    }

    return icon ?? 'person';
  });

  readonly nameSignal = computed<Maybe<string>>(() => this.avatarName() ?? this.defaultContext?.name);

  readonly initialsSignal = computed<Maybe<string>>(() => {
    const name = this.nameSignal();
    return name ? nameToInitials(name) : null;
  });

  readonly hasInitialsSignal = computed(() => {
    const initials = this.initialsSignal();
    return !this.avatarUrlSignal() && !!initials;
  });

  /**
   * The curated color the initials are painted on.
   *
   * Null when an explicit color is set: the initials surface is 100% of the avatar box, so a curated color would
   * cover the host's painted surface entirely, and the host's inherited `--dbx-color-bg-tone` would wash it out.
   */
  readonly curatedColorSignal = computed<Maybe<DbxColorConfig>>(() => {
    const name = this.nameSignal();
    const hasExplicitColor = Boolean(this.avatarColorSignal());
    return name && !hasExplicitColor ? (this.colorService?.getCuratedColorForValue(name) ?? dbxCuratedColorConfigForString(name)) : null;
  });

  onAvatarImageError(event: Event) {
    if (event.target) {
      const target = event.target as HTMLImageElement;
      this.avatarErrorUrlSignal.set(target.src);
    } else {
      this.avatarErrorUrlSignal.set(true);
    }
  }
}
