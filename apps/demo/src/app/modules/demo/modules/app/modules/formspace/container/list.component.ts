import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxFirebaseFormSpaceModule, type DbxFirebaseFormSpaceListValue, DbxFirebaseAuthService, FormSpaceCollectionStore, FormSpaceDocumentStore } from '@dereekb/dbx-firebase';
import { type AnchorForValueFunction, DbxActionModule, DbxActionSnackbarErrorDirective, DbxButtonModule, DbxListEmptyContentComponent, DbxListItemAnchorModifierDirective, DbxListModifierModule, DbxListTitleGroupDirective, type DbxListTitleGroupTitleDelegate, DbxTwoBlockComponent, DbxTwoColumnLayoutModule } from '@dereekb/dbx-web';
import { type DbxActionSuccessHandlerFunction, DbxRouteModelIdDirective, DbxRouterService, cleanSubscription } from '@dereekb/dbx-core';
import { FormSpaceState, type OnCallCreateModelResult, firestoreModelId, firestoreModelKey, formSpacesForOwnerQuery } from '@dereekb/firebase';
import { mapLoadingState, type WorkUsingContext } from '@dereekb/rxjs';
import { firstValue } from '@dereekb/util';
import { DEMO_TEST_FORM_SPACE_TYPE, profileIdentity } from 'demo-firebase';
import { UIView } from '@uirouter/angular';
import { map, shareReplay } from 'rxjs';
import { DemoAppRouterService } from '../../../demo.app.router.service';

/**
 * Which group of the listing a space belongs to.
 *
 * Split on EDITABLE rather than on any of the five states, because that is the only distinction the page
 * acts on: a draft is the one space there is still something to do with, and everything else — submitted,
 * processing, expired, archived — is a record.
 */
export type DemoFormSpaceListGroup = 'active' | 'past';

/**
 * The order the listing's groups render in — the draft first, since it is the only one there is anything
 * left to do with.
 */
export const DEMO_FORM_SPACE_LIST_GROUP_ORDER: Record<DemoFormSpaceListGroup, number> = {
  active: 0,
  past: 1
};

/**
 * The signed-in user's test FormSpaces, listed beside whichever one is open.
 *
 * A FormSpace is a container for work in progress, so arriving back here with a half-filled form and a file
 * already uploaded is the behaviour the model exists for — the draft is grouped to the top of the listing so
 * resuming it is one click. A space that has been SUBMITTED is still listed — as the read-only record of what
 * was sent and how its processing went — because a submission that disappears the moment it is made looks
 * like a submission that was lost. Resolution goes through an owner-scoped query, which is the same scoping
 * `firestore.rules` grants `list` on `/fsp` for.
 *
 * @dbxRouteModelList formSpace - The caller's own form spaces
 */
@Component({
  templateUrl: './list.component.html',
  // the collection store backs the listing; the document store is here only so the head's create action has
  // one to call through — the OPEN space's store is the separate one `dbxFirebaseFormSpaceDocument` provides
  // on the right column's <ui-view>, keyed off the route
  providers: [FormSpaceCollectionStore, FormSpaceDocumentStore],
  imports: [
    //
    UIView,
    DbxActionModule,
    DbxActionSnackbarErrorDirective,
    DbxButtonModule,
    DbxListEmptyContentComponent,
    DbxListItemAnchorModifierDirective,
    DbxListModifierModule,
    DbxListTitleGroupDirective,
    DbxTwoBlockComponent,
    DbxTwoColumnLayoutModule,
    DbxRouteModelIdDirective,
    DbxFirebaseFormSpaceModule
  ]
})
export class DemoFormSpaceListPageComponent {
  readonly auth = inject(DbxFirebaseAuthService);
  readonly dbxRouterService = inject(DbxRouterService);
  readonly demoAppRouterService = inject(DemoAppRouterService);
  readonly formSpaceCollectionStore = inject(FormSpaceCollectionStore);
  readonly formSpaceDocumentStore = inject(FormSpaceDocumentStore);

  readonly formSpaceListRef = this.demoAppRouterService.formSpaceListRef();

  readonly ownerKey$ = this.auth.userIdentifier$.pipe(
    map((uid) => firestoreModelKey(profileIdentity, uid)),
    shareReplay(1)
  );

  /**
   * The user's spaces of this page's own type, newest first.
   *
   * Filtered client-side rather than by a second `where`: adding `t` to the owner query would make it
   * composite, and a composite index is a poor trade for a list one user's own forms can never be long.
   *
   * @param spaces - Every space the owner query returned.
   * @returns The spaces of this page's type, newest first.
   */
  readonly filterTestFormSpaces = (spaces: DbxFirebaseFormSpaceListValue[]) => spaces.filter((x) => x.t === DEMO_TEST_FORM_SPACE_TYPE).sort((a, b) => b.cat.getTime() - a.cat.getTime());

  readonly testFormSpaces$ = this.formSpaceCollectionStore.allDocumentData$.pipe(map(this.filterTestFormSpaces), shareReplay(1));

  /**
   * What the listing renders.
   *
   * The store's own loading state rather than a bare array of what has arrived, so the list can tell "no
   * spaces yet" apart from "the query has not answered yet" and show its empty content only for the first.
   */
  readonly formSpaceListState$ = this.formSpaceCollectionStore.pageLoadingState$.pipe(mapLoadingState({ mapValue: this.filterTestFormSpaces }), shareReplay(1));

  readonly formSpaceListStateSignal = toSignal(this.formSpaceListState$);
  readonly hasDraftSignal = toSignal(this.testFormSpaces$.pipe(map((all) => all.some((x) => x.s === FormSpaceState.DRAFT))), { initialValue: false });

  /**
   * Puts the draft in a titled group of its own above the rest.
   *
   * The listing's whole job is to get the user back to the one space they can still act on, and a
   * newest-first ordering does not promise that: a space submitted after the draft was started sorts above
   * it. Grouping states the distinction rather than relying on the sort to imply it.
   *
   * Title only — no icon, no hint. The default header renders those in the same two-line-with-icon shape a
   * ROW uses, which reads as one more thing to click; a bare title reads as the label it is.
   */
  readonly formSpaceGroupDelegate: DbxListTitleGroupTitleDelegate<DbxFirebaseFormSpaceListValue, DemoFormSpaceListGroup> = {
    groupValueForItem: (item) => (item.itemValue.s === FormSpaceState.DRAFT ? 'active' : 'past'),
    dataForGroupValue: (value) => ({ value, title: value === 'active' ? 'Active' : 'Past' }),
    sortGroupsByData: (a, b) => DEMO_FORM_SPACE_LIST_GROUP_ORDER[a.value] - DEMO_FORM_SPACE_LIST_GROUP_ORDER[b.value]
  };

  constructor() {
    // an unscoped list fails the rules, so the constraint is not an optimization
    cleanSubscription(this.formSpaceCollectionStore.setConstraints(this.ownerKey$.pipe(map((ownerKey) => formSpacesForOwnerQuery(ownerKey)))));
  }

  /**
   * Opens a space from the listing.
   *
   * A route rather than a key change, so the open space is in the URL: a submitted space opens read-only on
   * the same page, since `isEditable$` is the predicate every control over there already hangs off.
   *
   * @param formSpace - The space the row lists.
   * @returns The row's anchor.
   */
  readonly makeFormSpaceAnchor: AnchorForValueFunction<DbxFirebaseFormSpaceListValue> = (formSpace) => this.demoAppRouterService.formSpaceViewRef(formSpace.id);

  readonly handleCreateFormSpace: WorkUsingContext<unknown, OnCallCreateModelResult> = (_, context) => {
    context.startWorkingWithLoadingStateObservable(this.formSpaceDocumentStore.createFormSpace({ formSpaceType: DEMO_TEST_FORM_SPACE_TYPE, displayName: 'Test FormSpace' }));
  };

  /**
   * Opens the space the create just made.
   *
   * Off the create's own result rather than off the owner query catching up, so the page lands on the new
   * space immediately — and on the right one, which a query emission arriving later cannot promise.
   *
   * @param result - The create's result, naming the space it made.
   */
  readonly onFormSpaceCreated: DbxActionSuccessHandlerFunction<OnCallCreateModelResult> = (result) => {
    const key = firstValue(result.modelKeys);

    if (key != null) {
      void this.dbxRouterService.go(this.demoAppRouterService.formSpaceViewRef(firestoreModelId(key)));
    }
  };
}
