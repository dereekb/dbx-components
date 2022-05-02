import { Directive } from "@angular/core";
import { AbstractDbxFirebaseAsyncModelLoaderInstanceDirective, ProvideDbxFirebaseModelLoader } from "@dereekb/dbx-firebase";
import { DemoFirestoreCollections, GuestbookEntry, GuestbookEntryDocument } from "@dereekb/demo-firebase";
import { FirestoreCollection } from "@dereekb/firebase";
import { Observable, of } from "rxjs";

@Directive({
  selector: '[demoGuestbookEntryLoader]',
  providers: ProvideDbxFirebaseModelLoader(DemoGuestbookEntryLoaderDirective)
})
export class DemoGuestbookEntryLoaderDirective extends AbstractDbxFirebaseAsyncModelLoaderInstanceDirective<GuestbookEntry, GuestbookEntryDocument> {

  // TODO: use an observable for the parent to create the child collection target.

  readonly collection$: Observable<FirestoreCollection<GuestbookEntry, GuestbookEntryDocument>> = of(undefined as any);

  constructor(private readonly collections: DemoFirestoreCollections) {
    super();
  }

}
