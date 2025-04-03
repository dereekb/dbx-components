import { Component, input, Input } from '@angular/core';
import { Maybe } from '@dereekb/util';

@Component({
  selector: 'dbx-firebase-notificationitem-content',
  templateUrl: './notificationitem.content.component.html',
  styleUrls: ['./notificationitem.content.scss']
})
export class DbxFirebaseNotificationItemContentComponent {
  readonly subject = input<Maybe<string>>();
  readonly message = input<Maybe<string>>();
  readonly date = input<Maybe<Date>>();
}
