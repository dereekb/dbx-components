import { Component, computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { DbxActionButtonDirective, DbxActionDirective, DbxActionEnforceModifiedDirective, DbxActionHandlerDirective } from '@dereekb/dbx-core';
import { DbxActionFormDirective, DbxFormSourceDirective } from '@dereekb/dbx-form';
import { DbxActionSnackbarErrorDirective, DbxButtonComponent } from '@dereekb/dbx-web';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { map } from 'rxjs';
import { type DbxFirebaseNotificationUserSettingsPhoneFormConfig, type DbxFirebaseNotificationUserSettingsPhoneFormValue, DbxFirebaseNotificationUserSettingsPhoneForgeFormComponent } from '../component/notification.user.settings.phone.forge.form.component';
import { DbxFirebaseNotificationUserSettingsStore } from '../store/notificationuser.settings.store';

/**
 * The phone number notification texts are sent to. Saving it turns texts on, which is how the user opts into texts.
 *
 * The number is saved on its own, apart from the pending settings changes. The account phone number, when known, is only
 * suggested as the placeholder. Requires an ancestor {@link DbxFirebaseNotificationUserSettingsStore}.
 */
@Component({
  selector: 'dbx-firebase-notification-user-settings-phone',
  template: `
    <div dbxAction dbxActionEnforceModified dbxActionSnackbarError [dbxActionHandler]="handleSavePhoneNumber">
      <dbx-firebase-notification-user-settings-phone-forge-form dbxActionForm [config]="formConfigSignal()" [dbxFormSource]="formValue$"></dbx-firebase-notification-user-settings-phone-forge-form>
      <dbx-button dbxActionButton [stroked]="true" text="Save Phone Number"></dbx-button>
    </div>
  `,
  host: {
    class: 'd-block dbx-firebase-notification-user-settings-phone'
  },
  imports: [DbxActionDirective, DbxActionEnforceModifiedDirective, DbxActionHandlerDirective, DbxActionButtonDirective, DbxActionFormDirective, DbxFormSourceDirective, DbxActionSnackbarErrorDirective, DbxButtonComponent, DbxFirebaseNotificationUserSettingsPhoneForgeFormComponent]
})
export class DbxFirebaseNotificationUserSettingsPhoneComponent {
  readonly store = inject(DbxFirebaseNotificationUserSettingsStore);

  readonly formConfigSignal = computed<DbxFirebaseNotificationUserSettingsPhoneFormConfig>(() => ({
    preferredCountries: this.store.configSignal().phoneNumberPreferredCountries,
    placeholder: this.store.authPhoneNumberSignal()
  }));

  // only the saved phone number feeds the form, so saving other settings doesn't reset a number being typed
  readonly formValue$ = toObservable(this.store.textPhoneNumberSignal).pipe(map((phoneNumber): DbxFirebaseNotificationUserSettingsPhoneFormValue => ({ phoneNumber })));

  readonly handleSavePhoneNumber: WorkUsingContext<DbxFirebaseNotificationUserSettingsPhoneFormValue> = (value, context) => {
    if (value.phoneNumber) {
      context.startWorkingWithLoadingStateObservable(this.store.saveTextPhoneNumber(value.phoneNumber));
    } else {
      context.reject();
    }
  };
}
