import { Component } from '@angular/core';
import { AbstractDbxFirebaseNotificationItemWidgetComponent } from './notificationitem.view.directive';
import { DbxFirebaseNotificationItemContentComponent } from './notificationitem.content.component';

@Component({
  selector: 'dbx-firebase-notificationitem-view-default',
  template: '<dbx-firebase-notificationitem-content [subject]="subject" [message]="message" [date]="date"></dbx-firebase-notificationitem-content>',
  imports: [DbxFirebaseNotificationItemContentComponent],
  standalone: true
})
export class DbxFirebaseNotificationItemDefaultViewComponent extends AbstractDbxFirebaseNotificationItemWidgetComponent {
  get subject() {
    return this.notificationItem.s;
  }

  get message() {
    return this.notificationItem.g;
  }

  get date() {
    return this.notificationItem.cat;
  }
}
