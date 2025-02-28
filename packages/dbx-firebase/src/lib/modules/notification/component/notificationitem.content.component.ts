import { Component, Input } from '@angular/core';
import { Maybe } from '@dereekb/util';

@Component({
  selector: 'dbx-firebase-notificationitem-content',
  templateUrl: './notificationitem.content.component.html',
  styleUrls: ['./notificationitem.content.scss']
})
export class DbxFirebaseNotificationItemContentComponent {
  @Input()
  subject?: Maybe<string>;

  @Input()
  message?: Maybe<string>;

  @Input()
  date?: Maybe<Date>;
}
