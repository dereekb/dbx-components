import { Component, computed, inject, InjectionToken, Injector, input } from '@angular/core';
import { DBX_AVATAR_CONTEXT_DATA_TOKEN, DbxAvatarContext, DbxAvatarKey, DbxAvatarSelector } from './avatar';
import { DbxAvatarService } from './avatar.service';
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
  standalone: true
})
export class DbxAvatarComponent {
  readonly injector = inject(Injector);
  readonly avatarService = inject(DbxAvatarService);

  readonly context = input<DbxAvatarContext>();

  readonly avatarSelector = input<Maybe<DbxAvatarSelector>>();
  readonly avatarUid = input<Maybe<AuthUserIdentifier>>();
  readonly avatarUrl = input<Maybe<WebsiteUrlWithPrefix>>();
  readonly avatarKey = input<Maybe<DbxAvatarKey>>();

  readonly contextSignal = computed(() => {
    const inputContext = this.context();

    const selector = this.avatarSelector() ?? inputContext?.selector;
    const uid = this.avatarUid() ?? inputContext?.uid;
    const url = this.avatarUrl() ?? inputContext?.url;
    const key = this.avatarKey() ?? inputContext?.key;

    const context = {
      selector,
      uid,
      url,
      key
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
