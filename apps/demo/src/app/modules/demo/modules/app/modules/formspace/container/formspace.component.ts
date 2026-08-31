import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxFirebaseAuthService, DbxFirebaseFormSpaceModule, FormSpaceCollectionStore, FormSpaceDocumentStore } from '@dereekb/dbx-firebase';
import { DbxActionModule, DbxButtonModule, DbxContentBoxDirective, DbxErrorComponent, DbxSectionComponent, DbxSectionLayoutModule } from '@dereekb/dbx-web';
import { DbxActionFormDirective, DbxFormSourceDirective } from '@dereekb/dbx-form';
import { TimeDistancePipe, cleanSubscription } from '@dereekb/dbx-core';
import { FormSpaceProcessingState, FormSpaceState, firestoreModelKey, formSpacesForOwnerQuery } from '@dereekb/firebase';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { DEMO_TEST_FORM_SPACE_COVER_SLOT, DEMO_TEST_FORM_SPACE_FOLDER_MAX_FILES, DEMO_TEST_FORM_SPACE_FOLDER_SLOT, DEMO_TEST_FORM_SPACE_TYPE, type DemoTestFormSpaceData, profileIdentity } from 'demo-firebase';
import { DemoTestFormSpaceFormComponent, type DemoTestFormSpaceFormValue } from 'demo-components';
import { first, map, shareReplay } from 'rxjs';

/**
 * The signed-in user's test FormSpace.
 *
 * The page resumes a draft rather than starting a new space every visit: a FormSpace is a container for
 * work in progress, so arriving back on this page with a half-filled form and a file already uploaded is
 * the behaviour the model exists for. Resolution goes through an owner-scoped query, which is the same
 * scoping `firestore.rules` grants `list` on `/fsp` for.
 */
@Component({
  templateUrl: './formspace.component.html',
  providers: [FormSpaceCollectionStore, FormSpaceDocumentStore],
  imports: [
    //
    DbxActionModule,
    DbxButtonModule,
    DbxContentBoxDirective,
    DbxErrorComponent,
    DbxSectionComponent,
    DbxSectionLayoutModule,
    DbxActionFormDirective,
    DbxFormSourceDirective,
    DbxFirebaseFormSpaceModule,
    DemoTestFormSpaceFormComponent,
    TimeDistancePipe
  ],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoFormSpaceViewComponent {
  readonly auth = inject(DbxFirebaseAuthService);
  readonly formSpaceCollectionStore = inject(FormSpaceCollectionStore);
  readonly formSpaceDocumentStore = inject(FormSpaceDocumentStore);

  readonly formSpaceProcessingState = FormSpaceProcessingState;

  readonly coverSlot = DEMO_TEST_FORM_SPACE_COVER_SLOT;
  readonly folderSlot = DEMO_TEST_FORM_SPACE_FOLDER_SLOT;
  readonly folderMaxFiles = DEMO_TEST_FORM_SPACE_FOLDER_MAX_FILES;

  readonly ownerKey$ = this.auth.userIdentifier$.pipe(
    map((uid) => firestoreModelKey(profileIdentity, uid)),
    shareReplay(1)
  );

  /**
   * The newest draft of the test type this user holds, if any.
   *
   * Filtered client-side rather than by a second `where`: adding `t` and `s` to the owner query would make
   * it composite, and a composite index is a poor trade for a list this user's own drafts can never be long.
   */
  readonly existingDraft$ = this.formSpaceCollectionStore.allDocumentData$.pipe(
    map((all) =>
      all
        .filter((x) => x.t === DEMO_TEST_FORM_SPACE_TYPE && x.s === FormSpaceState.DRAFT)
        .sort((a, b) => b.cat.getTime() - a.cat.getTime())
        .at(0)
    ),
    shareReplay(1)
  );

  readonly hasFormSpaceSignal = toSignal(this.formSpaceDocumentStore.currentKey$.pipe(map((x) => x != null)), { initialValue: false });
  readonly formSpaceSignal = toSignal(this.formSpaceDocumentStore.currentData$);
  readonly isEditableSignal = toSignal(this.formSpaceDocumentStore.isEditable$, { initialValue: false });

  readonly formData$ = this.formSpaceDocumentStore.formSpaceDataOfType$<DemoTestFormSpaceData>().pipe(
    map((x) => (x ?? {}) as DemoTestFormSpaceFormValue),
    shareReplay(1)
  );

  /**
   * Whether the JSON step is done.
   *
   * The PAGE's rule, not the model's: `d` is opaque to the framework, so no slot config and no submit
   * blocker can speak for it, and the section takes the verdict as a plain `[complete]`. It is deliberately
   * read off the SAVED data rather than the form's current value — a title typed but not saved is not on the
   * space yet.
   *
   * Note this is not part of the submit gate: the server's rule is about slots, and the submit button
   * mirrors the server rather than adding a requirement of its own.
   */
  readonly isTestInformationCompleteSignal = toSignal(this.formSpaceDocumentStore.formSpaceDataOfType$<DemoTestFormSpaceData>().pipe(map((data) => (data?.title ?? '').trim().length > 0 && data?.agreed === true)), { initialValue: false });

  constructor() {
    // an unscoped list fails the rules, so the constraint is not an optimization
    cleanSubscription(this.formSpaceCollectionStore.setConstraints(this.ownerKey$.pipe(map((ownerKey) => formSpacesForOwnerQuery(ownerKey)))));

    // resume the newest draft. `first()` so a later query emission cannot steer the page off the space a
    // create just put the user on.
    cleanSubscription(
      this.existingDraft$
        .pipe(
          map((x) => x?.key),
          first((x) => x != null)
        )
        .subscribe((key) => this.formSpaceDocumentStore.setKey(key))
    );
  }

  readonly handleCreateFormSpace: WorkUsingContext = (_, context) => {
    // the store's create sets its own key from the result, so the page flips to the editor with no
    // navigation and without waiting for the owner query to catch up
    context.startWorkingWithLoadingStateObservable(this.formSpaceDocumentStore.createFormSpace({ formSpaceType: DEMO_TEST_FORM_SPACE_TYPE, displayName: 'Test FormSpace' }));
  };

  readonly handleUpdateFormSpace: WorkUsingContext<DemoTestFormSpaceFormValue> = (data, context) => {
    // the whole object, not a patch: `update:_` REPLACES `d`, which is what makes clearing a field
    // expressible at all
    context.startWorkingWithLoadingStateObservable(this.formSpaceDocumentStore.updateFormSpace({ data }));
  };
}
