import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { NotificationDeliveryMethod } from '@dereekb/firebase';
import { map } from 'rxjs';
import { NOTIFICATION_DELIVERY_METHOD_SHORT_LABELS } from '../service/healthcheck.presentation';
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
        <mat-slide-toggle [checked]="deliveryMethodSwitch.enabled" [disabled]="disabledSignal() || deliveryMethodSwitch.locked" (change)="store.setMethodEnabled({ method: deliveryMethodSwitch.method, enabled: $event.checked })">{{ deliveryMethodSwitch.label }}</mat-slide-toggle>
        @if (deliveryMethodSwitch.locked) {
          <div class="dbx-hint dbx-small dbx-pt2">{{ textStoppedMessageSignal() }}</div>
        } @else if (deliveryMethodSwitch.awaitingPhoneNumber) {
          <div class="dbx-hint dbx-small dbx-pt2">Save a phone number for texts to turn on text messages.</div>
        } @else if (!deliveryMethodSwitch.enabled) {
          <div class="dbx-hint dbx-small dbx-pt2">{{ deliveryMethodSwitch.offHint }}</div>
        }
      </div>
    }
    @if (textPhoneNumberFormOpenSignal()) {
      <div class="dbx-pb2">
        <dbx-firebase-notification-user-settings-phone></dbx-firebase-notification-user-settings-phone>
        @if (showTextStoppedMessageWithPhoneSignal()) {
          <p class="dbx-hint dbx-small">{{ textStoppedMessageSignal() }}</p>
        }
        <p class="dbx-hint dbx-small">{{ textMessageDisclosureSignal() }}</p>
        @if (textConsentAtSignal(); as textConsentAt) {
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

  readonly switchesSignal = toSignal(
    this.store.deliveryMethodSwitches$.pipe(
      map((switches) =>
        switches.map((x) => ({
          ...x,
          label: dbxFirebaseNotificationUserSettingsDeliveryMethodSwitchLabel(x.method),
          offHint: `${NOTIFICATION_DELIVERY_METHOD_SHORT_LABELS[x.method]} notifications are turned off for every notification type.`
        }))
      )
    ),
    { initialValue: [] }
  );

  readonly disabledSignal = toSignal(this.store.disabled$, { initialValue: true });
  readonly textPhoneNumberFormOpenSignal = toSignal(this.store.textPhoneNumberFormOpen$, { initialValue: false });
  readonly textMessageDisclosureSignal = toSignal(this.store.textMessageDisclosure$);
  readonly textConsentAtSignal = toSignal(this.store.textConsentAt$);
  readonly textStoppedMessageSignal = toSignal(this.store.textStoppedMessage$);
  readonly textPhoneNumberStoppedSignal = toSignal(this.store.textPhoneNumberStopped$, { initialValue: false });

  /**
   * Whether the stopped message shows beside the phone number, which is when texts have no switch to show it beside.
   */
  readonly showTextStoppedMessageWithPhoneSignal = computed(() => this.textPhoneNumberStoppedSignal() && !this.switchesSignal().some((x) => x.method === NotificationDeliveryMethod.TEXT));
}
