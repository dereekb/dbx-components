import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxFirebaseFormSpaceModule, FormSpaceDocumentStore } from '@dereekb/dbx-firebase';
import { DbxActionModule, DbxButtonModule, DbxErrorComponent, DbxSectionComponent } from '@dereekb/dbx-web';
import { cleanSubscription } from '@dereekb/dbx-core';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { GuestbookDocumentStore } from 'demo-components';
import { DEMO_GUESTBOOK_FORM_SPACE_PHOTOS_MAX_FILES, DEMO_GUESTBOOK_FORM_SPACE_PHOTOS_SLOT, DEMO_GUESTBOOK_FORM_SPACE_TYPE, demoGuestbookFormSpaceId } from 'demo-firebase';
import { map, shareReplay } from 'rxjs';

/**
 * The guestbook's SHARED FormSpace — one album per guestbook, filled by everyone who signed it.
 *
 * The whole point of the multi-user shape lives here: the space's `u` is the guestbook's creator, its `o`
 * is the guestbook's key, and every signer reaches it through the ownership key rather than through `u`.
 * So a signer can read it and upload into it, and cannot submit or delete it.
 *
 * The id is DERIVED from the guestbook, so this subscribes to `fsp/gb_<id>` before the album exists —
 * "no data" is the "nobody has started it yet" state, the same way the calendar page renders empty before
 * `cal/pr_<uid>` is written.
 */
@Component({
  selector: 'app-guestbook-album',
  templateUrl: './guestbook.album.component.html',
  providers: [FormSpaceDocumentStore],
  imports: [
    //
    DbxActionModule,
    DbxButtonModule,
    DbxErrorComponent,
    DbxSectionComponent,
    DbxFirebaseFormSpaceModule
  ]
})
export class DemoGuestbookAlbumComponent {
  readonly guestbookStore = inject(GuestbookDocumentStore);
  readonly formSpaceDocumentStore = inject(FormSpaceDocumentStore);

  readonly photosSlot = DEMO_GUESTBOOK_FORM_SPACE_PHOTOS_SLOT;
  readonly photosMaxFiles = DEMO_GUESTBOOK_FORM_SPACE_PHOTOS_MAX_FILES;

  readonly guestbookKey$ = this.guestbookStore.key$.pipe(shareReplay(1));
  readonly guestbookKeySignal = toSignal(this.guestbookKey$);

  readonly hasAlbumSignal = toSignal(this.formSpaceDocumentStore.currentData$.pipe(map((x) => x != null)), { initialValue: false });

  constructor() {
    cleanSubscription(this.formSpaceDocumentStore.setId(this.guestbookKey$.pipe(map((key) => demoGuestbookFormSpaceId(key)))));
  }

  readonly handleStartAlbum: WorkUsingContext = (_, context) => {
    const targetModelKey = this.guestbookKeySignal();

    // the server's create is get-or-create on the derived id, so two signers clicking at the same moment
    // resolve to the same album rather than racing two into existence
    context.startWorkingWithLoadingStateObservable(this.formSpaceDocumentStore.createFormSpace({ formSpaceType: DEMO_GUESTBOOK_FORM_SPACE_TYPE, targetModelKey, displayName: 'Guestbook Album' }));
  };
}
