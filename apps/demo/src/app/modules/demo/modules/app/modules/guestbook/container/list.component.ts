import { AnchorForValueFunction } from '@dereekb/dbx-web';
import { GuestbookWithId } from 'demo-firebase';
import { Component, inject } from '@angular/core';
import { DemoAppRouterService } from '../../../demo.app.router.service';

@Component({
    templateUrl: './list.component.html',
    standalone: true
})
export class DemoGuestbookListPageComponent {
  readonly demoAppRouterService = inject(DemoAppRouterService);

  readonly guestbookListRef = this.demoAppRouterService.guestbookListRef();
  readonly makeGuestbookAnchor: AnchorForValueFunction<GuestbookWithId> = (doc) => this.demoAppRouterService.guestbookRef(doc.id);
}
