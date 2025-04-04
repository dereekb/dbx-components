import { DbxFirebaseAuthLoginProvider, DbxFirebaseAuthLoginService } from './login.service';
import { DbxFirebaseLoginMode, FirebaseLoginMethodType, FirebaseLoginMethodCategory } from './login';
import { Component, Type, computed, inject, input } from '@angular/core';
import { containsStringAnyCase, Maybe, ArrayOrValue, excludeValuesFromArray, asArray } from '@dereekb/util';
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';

export type DbxFirebaseLoginListItemInjectionComponentConfig = DbxInjectionComponentConfig & Pick<DbxFirebaseAuthLoginProvider, 'loginMethodType'>;

/**
 * Pre-configured login component that displays all configured login types.
 */
@Component({
  selector: 'dbx-firebase-login-list',
  template: `
    @for (config of providersInjectionConfigsSignal(); track config.loginMethodType) {
      <div class="dbx-firebase-login-item">
        <dbx-injection [config]="config"></dbx-injection>
      </div>
    }
  `,
  host: {
    class: 'dbx-firebase-login-list'
  },
  standalone: true,
  imports: [DbxInjectionComponent]
})
export class DbxFirebaseLoginListComponent {
  readonly dbxFirebaseAuthLoginService = inject(DbxFirebaseAuthLoginService);

  readonly loginMode = input<DbxFirebaseLoginMode>('login');
  readonly providerTypes = input<Maybe<ArrayOrValue<FirebaseLoginMethodType>>>();
  readonly omitProviderTypes = input<Maybe<ArrayOrValue<FirebaseLoginMethodType>>>();
  readonly providerCategories = input<Maybe<ArrayOrValue<FirebaseLoginMethodCategory>>>();

  readonly providerTypesSignal = computed(() => {
    const providerTypes = this.providerTypes();
    const omitProviderTypes = this.omitProviderTypes();

    const baseTypes = providerTypes ? asArray(providerTypes) : this.dbxFirebaseAuthLoginService.getEnabledTypes();
    const types = omitProviderTypes ? excludeValuesFromArray(baseTypes, asArray(omitProviderTypes)) : baseTypes;
    return types;
  });

  readonly providersSignal = computed(() => {
    const providerCategories = asArray(this.providerCategories());
    let providers = this.dbxFirebaseAuthLoginService.getLoginProviders(this.providerTypesSignal());

    if (providerCategories.length) {
      const categories = new Set(providerCategories);
      providers = providers.filter((x) => containsStringAnyCase(categories, x.category ?? ''));
    }

    return providers;
  });

  readonly providersInjectionConfigsSignal = computed<DbxFirebaseLoginListItemInjectionComponentConfig[]>(() => {
    let providers = this.providersSignal();
    let mapFn: (x: DbxFirebaseAuthLoginProvider) => DbxFirebaseLoginListItemInjectionComponentConfig;

    if (this.loginMode() === 'register') {
      providers = providers.filter((x) => x.registrationComponentClass !== false); // providers with "registrationComponentClass" set to false are not available for registration
      mapFn = (x: DbxFirebaseAuthLoginProvider) => ({ componentClass: (x.registrationComponentClass ?? x.componentClass) as Type<unknown>, loginMethodType: x.loginMethodType });
    } else {
      mapFn = (x: DbxFirebaseAuthLoginProvider) => ({ componentClass: x.componentClass as Type<unknown>, loginMethodType: x.loginMethodType });
    }

    const configs = providers.map(mapFn);
    return configs;
  });
}
