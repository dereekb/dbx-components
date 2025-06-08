import { AnchorForValueFunction, DbxListItemAnchorModifierDirective, DbxListModifierModule, DbxTwoColumnLayoutModule } from '@dereekb/dbx-web';
import { GuestbookWithId, publishedGuestbook } from 'demo-firebase';
import { Component, inject, viewChild, OnInit } from '@angular/core';
import { DemoAppRouterService } from '../../../demo.app.router.service';
import { DemoGuestbookCollectionStoreDirective, DemoGuestbookDocumentStoreDirective, DemoGuestbookListComponent } from 'demo-components';
import { DbxFirebaseCollectionListDirective, DbxFirebaseModelViewedEventDirective } from '@dereekb/dbx-firebase';
import { DbxRouteModelIdDirective } from '@dereekb/dbx-core';
import { UIView } from '@uirouter/angular';

@Component({
  templateUrl: './list.component.html',
  imports: [UIView, DbxTwoColumnLayoutModule, DemoGuestbookCollectionStoreDirective, DemoGuestbookListComponent, DbxFirebaseCollectionListDirective, DbxListModifierModule, DemoGuestbookDocumentStoreDirective, DbxRouteModelIdDirective, DbxFirebaseModelViewedEventDirective, DbxListItemAnchorModifierDirective],
  standalone: true
})
export class DemoGuestbookListPageComponent implements OnInit {
  readonly demoAppRouterService = inject(DemoAppRouterService);
  readonly demoGuestbookCollectionStoreDirective = viewChild(DemoGuestbookCollectionStoreDirective);

  readonly guestbookConstraints = publishedGuestbook();

  readonly guestbookListRef = this.demoAppRouterService.guestbookListRef();
  readonly makeGuestbookAnchor: AnchorForValueFunction<GuestbookWithId> = (doc) => this.demoAppRouterService.guestbookRef(doc.id);

  ngOnInit(): void {
    const x = this.demoGuestbookCollectionStoreDirective();

    x?.setMaxPages(5);
    x?.setItemsPerPage(10);
  }
}
