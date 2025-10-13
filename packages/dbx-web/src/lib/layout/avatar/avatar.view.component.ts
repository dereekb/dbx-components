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
    '[class.dbx-avatar-view-circle]': 'avatarStyleClassSignal() === "circle"',
    '[class.dbx-avatar-view-square]': 'avatarStyleClassSignal() === "square"',
    '[class.dbx-avatar-view-with-avatar]': 'hasAvatarSignal()',
    '[class.dbx-avatar-view-no-avatar]': 'missingAvatarSignal()'
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

  readonly avatarUrlSignal = computed<Maybe<WebsiteUrlWithPrefix | WebsitePath>>(() => {
    const directUrl = this.avatarUrl();
    const contextUrl = this.defaultContext?.url;

    let url = directUrl ?? contextUrl ?? this.defaultAvatarUrl ?? null;

    // if the error url is true or matches the url, then the url is invalid.
    const errorUrl = this.avatarErrorUrlSignal();

    if (errorUrl === true || errorUrl === url) {
      url = null;
    }

    return url;
  });

  readonly hasAvatarSignal = computed(() => !!this.avatarUrlSignal());

  readonly missingAvatarSignal = computed(() => !this.hasAvatarSignal());

  readonly avatarStyleClassSignal = computed<'circle' | 'square'>(() => {
    return this.avatarStyle() ?? this.defaultContext?.style ?? 'circle';
  });

  readonly avatarIconSignal = computed(() => {
    let icon = this.avatarIcon() ?? this.defaultContext?.icon;

    if (!icon && this.avatarErrorUrlSignal()) {
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
