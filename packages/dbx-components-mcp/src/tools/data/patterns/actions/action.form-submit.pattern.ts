import type { ActionExamplePattern } from '../action-patterns.js';

export const ACTION_PATTERN_FORM_SUBMIT: ActionExamplePattern = {
  slug: 'form-submit',
  name: 'Form submit with snackbar',
  summary: 'A `<form>` with `dbxActionForm` providing the value, a save button as the trigger, snackbar + error feedback.',
  usesActionSlugs: ['action', 'handler', 'error-handler'],
  snippets: {
    minimal: `<form dbxAction [dbxActionHandler]="handleSave">
  <my-form dbxActionForm [dbxFormSource]="data$"></my-form>
  <dbx-button text="Save" dbxActionButton></dbx-button>
</form>`,
    brief: `<form dbxAction dbxActionSnackbar dbxActionSnackbarDefault="save" [dbxActionHandler]="handleSave">
  <my-form dbxActionForm [dbxFormSource]="data$"></my-form>
  <dbx-button [raised]="true" text="Save" dbxActionButton></dbx-button>
  <dbx-error dbxActionError></dbx-error>
</form>`,
    full: `import { Component, inject } from '@angular/core';
import { type WorkUsingContext } from '@dereekb/rxjs';

@Component({
  selector: 'app-edit-profile-page',
  template: \`
    <form
      dbxAction
      dbxActionSnackbar
      dbxActionSnackbarDefault="save"
      [dbxActionHandler]="handleSave">
      <my-profile-form dbxActionForm [dbxFormSource]="profile$"></my-profile-form>
      <dbx-button [raised]="true" text="Save" dbxActionButton></dbx-button>
      <dbx-error dbxActionError></dbx-error>
    </form>
  \`,
  standalone: true
})
export class EditProfilePageComponent {
  private readonly profileStore = inject(ProfileDocumentStore);
  readonly profile$ = this.profileStore.data$;

  readonly handleSave: WorkUsingContext<ProfileFormValue, ProfileResult> = (value, context) => {
    context.startWorkingWithLoadingStateObservable(this.profileStore.updateProfile(value));
  };
}`
  },
  notes: "`dbxActionForm` lives in `@dereekb/dbx-form` — it is the value provider in this composition. The form's `dbxFormSource` seeds the initial value and the form's modification status feeds `isModified` on the action store."
};
