import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { type Maybe, nameToInitials, type WebsitePath, type WebsiteUrlWithPrefix } from '@dereekb/util';
import { DbxAvatarViewService } from './avatar.service';
import { type DbxAvatarContext, DBX_AVATAR_CONTEXT_DATA_TOKEN, type DbxAvatarStyle } from './avatar';
import { DbxColorDirective } from '../style/style.color.directive';
import { DbxColorService } from '../style/style.color.service';
import { type DbxColorConfig, dbxCuratedColorConfigForString } from '../style/style';

/**
 * Displays an avatar image with automatic fallback to a Material icon when no image is available or when the image fails to load.
 *
 * Supports circle and square styles, and can optionally hide entirely on image error.
 * Receives context via the {@link DBX_AVATAR_CONTEXT_DATA_TOKEN} injection token or direct inputs.
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
      <img (error)="onAvatarImageError($event)" class="dbx-avatar-view-img" [src]="avatarUrlSignal()!" alt="." loading="lazy" decoding="async" />
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
    '[class.dbx-avatar-view-hide-avatar]': 'hideAvatarSignal()'
  },
  imports: [MatIconModule, DbxColorDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
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

  readonly avatarHideOnErrorSignal = computed(() => {
    return this.avatarHideOnError() ?? this.defaultContext?.hideOnError ?? false;
  });

  readonly currentAvatarUrlSignal = computed<Maybe<WebsiteUrlWithPrefix | WebsitePath>>(() => {
    const directUrl = this.avatarUrl();
    const contextUrl = this.defaultContext?.url;

    const url: Maybe<WebsiteUrlWithPrefix | WebsitePath> = directUrl ?? contextUrl ?? this.defaultAvatarUrl ?? undefined;
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

  readonly curatedColorSignal = computed<Maybe<DbxColorConfig>>(() => {
    const name = this.nameSignal();
    return name ? (this.colorService?.getCuratedColorForValue(name) ?? dbxCuratedColorConfigForString(name)) : null;
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
