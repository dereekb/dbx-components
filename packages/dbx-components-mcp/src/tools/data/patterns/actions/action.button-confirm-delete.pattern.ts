import type { ActionExamplePattern } from '../action-patterns.js';

export const ACTION_PATTERN_BUTTON_CONFIRM_DELETE: ActionExamplePattern = {
  slug: 'button-confirm-delete',
  name: 'Button + confirm + delete',
  summary: 'Standalone button that fires an async delete after a popover confirmation, with snackbar feedback on success/error.',
  usesActionSlugs: ['action', 'value', 'handler', 'error-handler'],
  snippets: {
    minimal: `<ng-container dbxAction dbxActionValue [dbxActionHandler]="handleDelete">
  <dbx-button text="Delete" dbxActionButton></dbx-button>
</ng-container>`,
    brief: `<!-- The host component supplies handleDelete: Work<void, void>. -->
<ng-container dbxAction dbxActionValue dbxActionSnackbarError [dbxActionHandler]="handleDelete">
  <dbx-button [raised]="true" color="warn" text="Delete" dbxActionButton></dbx-button>
</ng-container>`,
    full: `import { Component, inject } from '@angular/core';
import { type Work } from '@dereekb/rxjs';

@Component({
  selector: 'app-delete-account-button',
  template: \`
    <ng-container
      dbxAction
      dbxActionValue
      dbxActionSnackbarError
      [dbxActionHandler]="handleDelete">
      <dbx-button
        [raised]="true"
        color="warn"
        text="Delete account"
        icon="delete"
        dbxActionButton></dbx-button>
    </ng-container>
  \`,
  standalone: true
})
export class DeleteAccountButtonComponent {
  private readonly accountStore = inject(AccountDocumentStore);

  readonly handleDelete: Work<void, void> = (_value, context) => {
    context.startWorkingWithLoadingStateObservable(this.accountStore.deleteAccount());
  };
}`
  },
  notes: 'No form means we still need a value provider — `dbxActionValue` (with no expression) is what unblocks the TRIGGERED → VALUE_READY transition. Formtting it is the most common reason an action button "does nothing".'
};
