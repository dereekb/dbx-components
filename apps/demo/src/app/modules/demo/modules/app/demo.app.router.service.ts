import { Injectable } from '@angular/core';
import { SegueRef } from '@dereekb/dbx-core';

@Injectable({
  providedIn: 'root'
})
export class DemoAppRouterService {
  constructor() {}

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
