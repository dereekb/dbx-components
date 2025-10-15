import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Maybe, WebsitePath, WebsiteUrlWithPrefix } from '@dereekb/util';
import { DbxAvatarViewService } from './avatar.service';
import { DbxAvatarContext, DBX_AVATAR_CONTEXT_DATA_TOKEN, DbxAvatarStyle } from './avatar';

/**
 * Component that displays an avatar image. It has a configurable default avatar.
 */
@Component({
  selector: 'dbx-avatar-view',
  template: `
    @if (avatarUrlSignal()) {
      <img (error)="onAvatarImageError($event)" class="dbx-avatar-view-img" [src]="avatarUrlSignal()!" alt="." loading="lazy" decoding="async" />
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
    '[class.dbx-avatar-view-hide-avatar]': 'hideAvatarSignal()'
  },
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxAvatarViewComponent {
  readonly defaultContext: Maybe<DbxAvatarContext> = inject(DBX_AVATAR_CONTEXT_DATA_TOKEN, { optional: true });

  readonly avatarService = inject(DbxAvatarViewService);

  readonly defaultAvatarUrl = this.avatarService.defaultAvatarUrl;

  readonly avatarUrl = input<Maybe<WebsiteUrlWithPrefix>>();
  readonly avatarErrorUrlSignal = signal<Maybe<boolean | WebsiteUrlWithPrefix>>(null);

  readonly avatarStyle = input<Maybe<DbxAvatarStyle>>();
  readonly avatarIcon = input<Maybe<string>>();
  readonly avatarHideOnError = input<Maybe<boolean>>();

  readonly avatarHideOnErrorSignal = computed(() => {
    const hideOnError = this.avatarHideOnError() ?? this.defaultContext?.hideOnError ?? false;
    return hideOnError;
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
    let icon = this.avatarIcon() ?? this.defaultContext?.icon;

    if (!icon && this.hasAvatarErrorSignal()) {
      icon = this.avatarService.defaultAvatarErrorIcon;
    } else {
      icon = icon ?? this.avatarService.defaultAvatarIcon;
    }

    return icon ?? 'person';
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
