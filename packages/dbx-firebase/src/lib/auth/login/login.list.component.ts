import { type DbxFirebaseAuthLoginProvider, DbxFirebaseAuthLoginService } from './login.service';
import { type DbxFirebaseLoginMode, type FirebaseLoginMethodType, type FirebaseLoginMethodCategory } from './login';
import { Component, type Type, computed, inject, input } from '@angular/core';
import { containsStringAnyCase, type Maybe, type ArrayOrValue, excludeValuesFromArray, asArray } from '@dereekb/util';
import { DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';

/**
 * Injection config for a single login list item, enriched with the login method type for tracking.
 */
export type DbxFirebaseLoginListItemInjectionComponentConfig = DbxInjectionComponentConfig & Pick<DbxFirebaseAuthLoginProvider, 'loginMethodType'>;

/**
 * Renders a list of login provider buttons, filtered by enabled types and categories.
 *
 * Switches between login and registration component classes based on the current login mode.
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
    return omitProviderTypes ? excludeValuesFromArray(baseTypes, asArray(omitProviderTypes)) : baseTypes;
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
    const loginMode = this.loginMode();
    let mapFn: (x: DbxFirebaseAuthLoginProvider) => DbxFirebaseLoginListItemInjectionComponentConfig;

    switch (loginMode) {
      case 'register':
        providers = providers.filter((x) => x.registrationComponentClass !== false);
        mapFn = (x: DbxFirebaseAuthLoginProvider) => ({ componentClass: (x.registrationComponentClass ?? x.componentClass) as Type<unknown>, loginMethodType: x.loginMethodType, data: { loginMode } });
        break;
      case 'link':
        providers = providers.filter((x) => x.allowLinking !== false);
        mapFn = (x: DbxFirebaseAuthLoginProvider) => ({ componentClass: x.componentClass as Type<unknown>, loginMethodType: x.loginMethodType, data: { loginMode } });
        break;
      default:
        mapFn = (x: DbxFirebaseAuthLoginProvider) => ({ componentClass: x.componentClass as Type<unknown>, loginMethodType: x.loginMethodType, data: { loginMode } });
        break;
    }

    return providers.map(mapFn);
  });
}
