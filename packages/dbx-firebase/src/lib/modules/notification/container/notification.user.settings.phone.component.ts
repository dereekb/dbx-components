import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxActionButtonDirective, DbxActionDirective, DbxActionEnforceModifiedDirective, DbxActionHandlerDirective } from '@dereekb/dbx-core';
import { DbxActionFormDirective, DbxFormSourceDirective } from '@dereekb/dbx-form';
import { DbxActionSnackbarErrorDirective, DbxButtonComponent } from '@dereekb/dbx-web';
import { type IsModifiedFunction, type WorkUsingContext } from '@dereekb/rxjs';
import { combineLatest, first, map, switchMap } from 'rxjs';
import { type DbxFirebaseNotificationUserSettingsPhoneFormConfig, type DbxFirebaseNotificationUserSettingsPhoneFormValue, DbxFirebaseNotificationUserSettingsPhoneForgeFormComponent } from '../component/notification.user.settings.phone.forge.form.component';
import { dbxFirebaseNotificationUserTextPhoneNumberUpdateParams } from '../service/notification.settings';
import { NotificationUserDocumentStore } from '../store/notificationuser.document.store';
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
      <dbx-firebase-notification-user-settings-phone-forge-form dbxActionForm [dbxActionFormIsModified]="isPhoneNumberModified" [config]="formConfigSignal()" [dbxFormSource]="formValue$"></dbx-firebase-notification-user-settings-phone-forge-form>
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
  readonly notificationUserDocumentStore = inject(NotificationUserDocumentStore);

  readonly formConfigSignal = toSignal(combineLatest([this.store.config$, this.store.authPhoneNumber$]).pipe(map(([config, placeholder]): DbxFirebaseNotificationUserSettingsPhoneFormConfig => ({ preferredCountries: config.phoneNumberPreferredCountries, placeholder }))));

  // only the saved phone number feeds the form, so saving other settings doesn't reset a number being typed
  readonly formValue$ = this.store.textPhoneNumber$.pipe(map((phoneNumber): DbxFirebaseNotificationUserSettingsPhoneFormValue => ({ phoneNumber })));

  // saving the number that is already saved does nothing, so it doesn't count as a change
  readonly isPhoneNumberModified: IsModifiedFunction<DbxFirebaseNotificationUserSettingsPhoneFormValue> = (value) =>
    this.store.textPhoneNumber$.pipe(
      first(),
      map((textPhoneNumber) => (value.phoneNumber || undefined) !== (textPhoneNumber ?? undefined))
    );

  readonly handleSavePhoneNumber: WorkUsingContext<DbxFirebaseNotificationUserSettingsPhoneFormValue> = (value, context) => {
    const { phoneNumber } = value;

    if (phoneNumber) {
      const savePhoneNumber = this.store.savedGc$.pipe(
        first(),
        switchMap((gc) => this.notificationUserDocumentStore.updateNotificationUser({ gc: dbxFirebaseNotificationUserTextPhoneNumberUpdateParams({ gc, phoneNumber }) }))
      );

      context.startWorkingWithLoadingStateObservable(savePhoneNumber);
    } else {
      context.reject();
    }
  };
}
