import { Directive } from "@angular/core";
import { AbstractDbxFirebaseModelLoaderDirective, ProvideDbxFirebaseModelLoader } from "@dereekb/dbx-firebase";
import { DemoFirestoreCollections, Guestbook, GuestbookDocument } from "@dereekb/demo-firebase";

@Directive({
  selector: '[demoGuestbookLoader]',
  providers: ProvideDbxFirebaseModelLoader(DemoGuestbookLoaderDirective)
})
export class DemoGuestbookLoaderDirective extends AbstractDbxFirebaseModelLoaderDirective<Guestbook, GuestbookDocument> {

  constructor(collections: DemoFirestoreCollections) {
    super(collections.guestbookFirestoreCollection);
  }

}
