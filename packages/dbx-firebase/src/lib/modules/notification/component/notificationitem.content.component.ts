import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Maybe } from '@dereekb/util';

@Component({
  selector: 'dbx-firebase-notificationitem-content',
  templateUrl: './notificationitem.content.component.html',
  styleUrls: ['./notificationitem.content.scss'],
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseNotificationItemContentComponent {
  readonly subject = input<Maybe<string>>();
  readonly message = input<Maybe<string>>();
  readonly date = input<Maybe<Date>>();
}
