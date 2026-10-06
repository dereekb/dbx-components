import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { NotificationDeliveryMethod } from '@dereekb/firebase';
import { NOTIFICATION_DELIVERY_METHOD_SHORT_LABELS } from '../service/healthcheck.presentation';
import { DEFAULT_DBX_FIREBASE_NOTIFICATION_TEXT_MESSAGE_DISCLOSURE } from '../service/notification.settings';
import { DbxFirebaseNotificationUserSettingsStore } from '../store/notificationuser.settings.store';
import { DbxFirebaseNotificationUserSettingsPhoneComponent } from './notification.user.settings.phone.component';

/**
 * Returns the label of a delivery method's account-wide switch, e.g. "Allow text messages".
 *
 * @param method - The delivery method.
 * @returns The switch label.
 */
export function dbxFirebaseNotificationUserSettingsDeliveryMethodSwitchLabel(method: NotificationDeliveryMethod): string {
  return method === NotificationDeliveryMethod.TEXT ? 'Allow text messages' : `Allow ${NOTIFICATION_DELIVERY_METHOD_SHORT_LABELS[method].toLowerCase()} notifications`;
}

/**
 * Account-wide delivery settings: an on/off switch per switchable delivery method, and the text message phone number,
 * disclosure and consent.
 *
 * Switch changes are pending until the settings are saved. Requires an ancestor {@link DbxFirebaseNotificationUserSettingsStore}.
 */
@Component({
  selector: 'dbx-firebase-notification-user-settings-delivery',
  template: `
    @for (deliveryMethodSwitch of switchesSignal(); track deliveryMethodSwitch.method) {
      <div class="dbx-pb2">
        <mat-slide-toggle [checked]="deliveryMethodSwitch.enabled" [disabled]="store.disabledSignal()" (change)="store.setMethodEnabled(deliveryMethodSwitch.method, $event.checked)">{{ deliveryMethodSwitch.label }}</mat-slide-toggle>
        @if (deliveryMethodSwitch.awaitingPhoneNumber) {
          <div class="dbx-hint dbx-small">Save a phone number for texts to turn on text messages.</div>
        } @else if (!deliveryMethodSwitch.enabled) {
          <div class="dbx-hint dbx-small">{{ deliveryMethodSwitch.offHint }}</div>
        }
      </div>
    }
    @if (showTextSettingsSignal()) {
      <div class="dbx-pb2">
        <dbx-firebase-notification-user-settings-phone></dbx-firebase-notification-user-settings-phone>
        <p class="dbx-hint dbx-small">{{ textMessageDisclosureSignal() }}</p>
        @if (store.textConsentAtSignal(); as textConsentAt) {
          <p class="dbx-hint dbx-small no-margin">Texts enabled on {{ textConsentAt | date: 'mediumDate' }}.</p>
        }
      </div>
    }
  `,
  host: {
    class: 'd-block dbx-pt2 dbx-firebase-notification-user-settings-delivery'
  },
  imports: [DatePipe, MatSlideToggle, DbxFirebaseNotificationUserSettingsPhoneComponent]
})
export class DbxFirebaseNotificationUserSettingsDeliveryComponent {
  readonly store = inject(DbxFirebaseNotificationUserSettingsStore);

  readonly switchesSignal = computed(() =>
    this.store.deliveryMethodSwitchesSignal().map((x) => ({
      ...x,
      label: dbxFirebaseNotificationUserSettingsDeliveryMethodSwitchLabel(x.method),
      offHint: `${NOTIFICATION_DELIVERY_METHOD_SHORT_LABELS[x.method]} notifications are turned off for every notification type.`
    }))
  );

  /**
   * Shows the text settings, including the phone number form, once the text switch is turned on. Without a text switch they
   * always show, since saving a phone number is the only way to turn texts on.
   */
  readonly showTextSettingsSignal = computed(() => {
    const columns = this.store.columnsSignal();
    const switchable = this.store.switchableDeliveryMethodsSignal();
    const formOpen = this.store.textPhoneNumberFormOpenSignal();
    return columns.includes(NotificationDeliveryMethod.TEXT) && (formOpen || !switchable.includes(NotificationDeliveryMethod.TEXT));
  });
  readonly textMessageDisclosureSignal = computed(() => this.store.configSignal().textMessageDisclosure ?? DEFAULT_DBX_FIREBASE_NOTIFICATION_TEXT_MESSAGE_DISCLOSURE);
}
