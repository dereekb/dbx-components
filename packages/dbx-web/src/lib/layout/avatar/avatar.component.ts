import { ChangeDetectionStrategy, Component, computed, inject, Injector, input } from '@angular/core';
import { DBX_AVATAR_CONTEXT_DATA_TOKEN, DbxAvatarContext, DbxAvatarKey, DbxAvatarSelector, DbxAvatarSize, DbxAvatarStyle } from './avatar';
import { DbxAvatarViewService } from './avatar.service';
import { AuthUserIdentifier, DbxInjectionComponent, DbxInjectionComponentConfig, mergeStaticProviders } from '@dereekb/dbx-core';
import { Maybe, WebsiteUrlWithPrefix } from '@dereekb/util';

/**
 * Component that displays an avatar based on the input context.
 */
@Component({
  selector: 'dbx-avatar',
  template: `
    <dbx-injection [config]="configSignal()"></dbx-injection>
  `,
  imports: [DbxInjectionComponent],
  host: {
    '[class.dbx-avatar-small]': `avatarSize() === 'small'`,
    '[class.dbx-avatar-large]': `avatarSize() === 'large'`
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxAvatarComponent {
  readonly injector = inject(Injector);
  readonly avatarService = inject(DbxAvatarViewService);

  readonly context = input<DbxAvatarContext>();

  readonly avatarSelector = input<Maybe<DbxAvatarSelector>>();
  readonly avatarUid = input<Maybe<AuthUserIdentifier>>();
  readonly avatarUrl = input<Maybe<WebsiteUrlWithPrefix>>();
  readonly avatarKey = input<Maybe<DbxAvatarKey>>();
  readonly avatarIcon = input<Maybe<string>>();
  readonly avatarStyle = input<Maybe<DbxAvatarStyle>>();
  readonly avatarSize = input<Maybe<DbxAvatarSize>>(undefined);

  readonly contextSignal = computed(() => {
    const inputContext = this.context();

    const selector = this.avatarSelector() ?? inputContext?.selector;
    const uid = this.avatarUid() ?? inputContext?.uid;
    const url = this.avatarUrl() ?? inputContext?.url;
    const key = this.avatarKey() ?? inputContext?.key;
    const icon = this.avatarIcon() ?? inputContext?.icon;
    const style = this.avatarStyle() ?? inputContext?.style;

    const context = {
      selector,
      uid,
      url,
      key,
      icon,
      style
    };

    return context;
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
