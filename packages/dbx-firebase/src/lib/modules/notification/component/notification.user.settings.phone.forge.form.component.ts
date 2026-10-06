import { Component } from '@angular/core';
import { AbstractConfigAsyncForgeFormDirective, DBX_FORGE_FORM_COMPONENT_TEMPLATE, dbxForgeFormComponentProviders, DbxForgeFormComponentImportsModule, dbxForgePhoneField } from '@dereekb/dbx-form';
import { type E164PhoneNumber, type Maybe } from '@dereekb/util';
import type { FormConfig } from '@ng-forge/dynamic-forms';
import { map, type Observable } from 'rxjs';

/**
 * Form value for {@link DbxFirebaseNotificationUserSettingsPhoneForgeFormComponent}.
 */
export interface DbxFirebaseNotificationUserSettingsPhoneFormValue {
  /**
   * Phone number texts are sent to.
   */
  readonly phoneNumber?: Maybe<E164PhoneNumber>;
}

/**
 * Config for {@link DbxFirebaseNotificationUserSettingsPhoneForgeFormComponent}.
 */
export interface DbxFirebaseNotificationUserSettingsPhoneFormConfig {
  /**
   * ISO country codes shown first in the country dropdown, e.g. `['US', 'CA']`.
   */
  readonly preferredCountries?: Maybe<string[]>;
  /**
   * Placeholder for the phone number, such as the account phone number to suggest.
   */
  readonly placeholder?: Maybe<string>;
}

/**
 * Forge form with the phone number that notification texts are sent to.
 */
@Component({
  selector: 'dbx-firebase-notification-user-settings-phone-forge-form',
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  imports: [DbxForgeFormComponentImportsModule],
  providers: dbxForgeFormComponentProviders()
})
export class DbxFirebaseNotificationUserSettingsPhoneForgeFormComponent extends AbstractConfigAsyncForgeFormDirective<DbxFirebaseNotificationUserSettingsPhoneFormValue, DbxFirebaseNotificationUserSettingsPhoneFormConfig> {
  readonly formConfig$: Observable<Maybe<FormConfig>> = this.currentConfig$.pipe(
    map((config) => ({
      fields: [dbxForgePhoneField({ key: 'phoneNumber', label: 'Phone Number for Texts', required: true, preferredCountries: config?.preferredCountries ?? undefined, placeholder: config?.placeholder ?? undefined })]
    }))
  );
}
