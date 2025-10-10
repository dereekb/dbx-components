import { Component, computed, inject, input, signal } from '@angular/core';
import { Maybe, WebsiteUrlWithPrefix } from '@dereekb/util';
import { DbxAvatarService } from './avatar.service';
import { DbxAvatarContext, DBX_AVATAR_CONTEXT_DATA_TOKEN } from './avatar';

/**
 * Component that displays an avatar image. It has a configurable default avatar.
 */
@Component({
  selector: 'dbx-avatar-view',
  template: `
    <img [src]="avatarUrlSignal()" />
  `,
  host: {
    class: 'dbx-avatar-view',
    '[class.dbx-avatar-view-with-avatar]': 'avatarUrlSignal()',
    '[class.dbx-avatar-view-no-avatar]': '!avatarUrlSignal()'
  },
  standalone: true
})
export class DbxAvatarViewComponent {
  readonly defaultContext: Maybe<DbxAvatarContext> = inject(DBX_AVATAR_CONTEXT_DATA_TOKEN, { optional: true });

  readonly avatarService = inject(DbxAvatarService);

  readonly defaultAvatarUrl = this.avatarService.defaultAvatarUrl;

  readonly avatarUrl = input<Maybe<WebsiteUrlWithPrefix>>();

  readonly avatarUrlSignal = computed(() => {
    const url = this.avatarUrl();
    return url ?? this.defaultAvatarUrl;
  });
}
