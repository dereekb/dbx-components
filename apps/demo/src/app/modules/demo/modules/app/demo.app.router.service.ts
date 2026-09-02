import { Service } from '@angular/core';
import { type SegueRef } from '@dereekb/dbx-core';

@Service()
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

  formSpaceListRef(): SegueRef {
    return {
      ref: 'demo.app.formspace.list'
    };
  }

  formSpaceViewRef(id: string): SegueRef {
    return {
      ref: 'demo.app.formspace.list.formspace',
      refParams: { id }
    };
  }

  oidcClientCreateRef(): SegueRef {
    return {
      ref: 'demo.app.oidc.clients.create'
    };
  }

  oidcClientListRef(): SegueRef {
    return {
      ref: 'demo.app.oidc.clients'
    };
  }

  oidcClientRef(id: string): SegueRef {
    return {
      ref: 'demo.app.oidc.clients.client',
      refParams: { id }
    };
  }

  oidcGrantListRef(): SegueRef {
    return {
      ref: 'demo.app.oidc.grants'
    };
  }
}
