import { ChangeDetectionStrategy, Component, type OnDestroy, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxFirebaseFormSpaceModule, FormSpaceDocumentStore } from '@dereekb/dbx-firebase';
import { DbxActionModule, DbxButtonModule, DbxContentContainerDirective, DbxErrorComponent, DbxLoadingComponent, DbxTwoColumnRightComponent } from '@dereekb/dbx-web';
import { DbxActionFormDirective, DbxFormSourceDirective } from '@dereekb/dbx-form';
import { TimeDistancePipe } from '@dereekb/dbx-core';
import { FormSpaceProcessingState } from '@dereekb/firebase';
import { loadingStateContext, type WorkUsingContext } from '@dereekb/rxjs';
import { DEMO_TEST_FORM_SPACE_COVER_SLOT, DEMO_TEST_FORM_SPACE_FOLDER_MAX_FILES, DEMO_TEST_FORM_SPACE_FOLDER_SLOT, type DemoTestFormSpaceData } from 'demo-firebase';
import { DemoTestFormSpaceFormComponent, type DemoTestFormSpaceFormValue } from 'demo-components';
import { map, shareReplay } from 'rxjs';

/**
 * Right-column page for one test FormSpace at `/demo/app/formspace/:id`.
 *
 * The store this reads is the one `dbxFirebaseFormSpaceDocument` provides on the list page's `<ui-view>`, so
 * the space on screen is whatever the route names. A space past its one-way door opens READ-ONLY rather than
 * not opening at all — what was submitted is the point of coming back to look at it — which is why every
 * control here hangs off `isEditable$` instead of the page deciding whether to render at all.
 *
 * @dbxRouteModel formSpace :id - The form space the page is viewing
 */
@Component({
  templateUrl: './list.right.component.html',
  imports: [
    //
    DbxTwoColumnRightComponent,
    DbxContentContainerDirective,
    DbxLoadingComponent,
    DbxActionModule,
    DbxButtonModule,
    DbxErrorComponent,
    DbxActionFormDirective,
    DbxFormSourceDirective,
    DbxFirebaseFormSpaceModule,
    DemoTestFormSpaceFormComponent,
    TimeDistancePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoFormSpaceListPageRightComponent implements OnDestroy {
  readonly formSpaceDocumentStore = inject(FormSpaceDocumentStore);

  readonly formSpaceProcessingState = FormSpaceProcessingState;

  readonly coverSlot = DEMO_TEST_FORM_SPACE_COVER_SLOT;
  readonly folderSlot = DEMO_TEST_FORM_SPACE_FOLDER_SLOT;
  readonly folderMaxFiles = DEMO_TEST_FORM_SPACE_FOLDER_MAX_FILES;

  readonly context = loadingStateContext({ obs: this.formSpaceDocumentStore.dataLoadingState$ });

  readonly formSpaceSignal = toSignal(this.formSpaceDocumentStore.currentData$);
  readonly isEditableSignal = toSignal(this.formSpaceDocumentStore.isEditable$, { initialValue: false });
  readonly headerSignal = toSignal(this.formSpaceDocumentStore.displayName$.pipe(map((x) => x || 'Form Space')), { initialValue: 'Form Space' });

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

  ngOnDestroy(): void {
    this.context.destroy();
  }

  readonly handleUpdateFormSpace: WorkUsingContext<DemoTestFormSpaceFormValue> = (data, context) => {
    // the whole object, not a patch: `update:_` REPLACES `d`, which is what makes clearing a field
    // expressible at all
    context.startWorkingWithLoadingStateObservable(this.formSpaceDocumentStore.updateFormSpace({ data }));
  };
}
