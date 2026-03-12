import { Injectable } from '@angular/core';
import { type SegueRef } from '@dereekb/dbx-core';

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

  oauthClientCreateRef(): SegueRef {
    return {
      ref: 'demo.app.oauth.clients.create'
    };
  }

  oauthClientListRef(): SegueRef {
    return {
      ref: 'demo.app.oauth.clients'
    };
  }

  oauthClientRef(id: string): SegueRef {
    return {
      ref: 'demo.app.oauth.clients.client',
      refParams: { id }
    };
  }
}
