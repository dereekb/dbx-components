import { Injectable } from '@angular/core';
import { SegueRef } from '@dereekb/dbx-core';

@Injectable({
  providedIn: 'root'
})
export class DemoAppRouterService {
  userNotificationListRef(): SegueRef {
    return {
      ref: 'demo.app.notification.list'
    };
  }

  userNotificationListNotificationRef(id: string): SegueRef {
    return {
      ref: 'demo.app.notification.list.notification',
      refParams: { id }
    };
  }

  guestbookListRef(): SegueRef {
    return {
      ref: 'demo.app.guestbook.list'
    };
  }

  guestbookRef(id: string): SegueRef {
    return {
      ref: 'demo.app.guestbook.list.guestbook',
      refParams: { id }
    };
  }
}
