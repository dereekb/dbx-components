import { Component } from '@angular/core';
import { DbxActionButtonDirective } from '@dereekb/dbx-core';
import { AbstractDialogDirective } from '../../interaction/dialog/abstract.dialog.directive';
import { DbxDialogContentDirective } from '../../interaction/dialog/dialog.content.directive';
import { type DbxPromptConfirmConfig, DbxPromptConfirmComponent } from '../../interaction/prompt/prompt.confirm.component';
import { DbxErrorComponent } from '../../error/error.component';
import { DbxActionErrorDirective } from '../../error/error.action.directive';
import { DbxButtonComponent } from '../../button/button.component';
import { DbxButtonSpacerDirective } from '../../button/button.spacer.directive';

/**
 * Possible outcomes of the transition safety dialog.
 *
 * - `'success'` - The action completed successfully; allow the transition.
 * - `'stay'` - The user chose to stay on the current page.
 * - `'discard'` - The user chose to discard changes and allow the transition.
 * - `'none'` - The dialog was closed programmatically without a user decision.
 */
export type DbxActionTransitionSafetyDialogResult = 'success' | 'stay' | 'discard' | 'none';

/**
 * Confirmation dialog displayed by {@link DbxActionTransitionSafetyDirective} when the user
 * attempts to navigate away with unsaved changes. Offers options to stay on the page,
 * leave without saving, or save before leaving.
 */
@Component({
  template: `
    <dbx-dialog-content>
      <dbx-prompt-confirm [config]="config" (confirm)="confirm()" (cancel)="cancel()">
        <dbx-error dbxActionError></dbx-error>
        <dbx-button buttons [raised]="true" color="primary" text="Save Changes" dbxActionButton></dbx-button>
        <dbx-button-spacer buttons></dbx-button-spacer>
      </dbx-prompt-confirm>
    </dbx-dialog-content>
  `,
  imports: [DbxDialogContentDirective, DbxPromptConfirmComponent, DbxErrorComponent, DbxActionErrorDirective, DbxButtonComponent, DbxActionButtonDirective, DbxButtonSpacerDirective]
})
export class DbxActionUIRouterTransitionSafetyDialogComponent extends AbstractDialogDirective {
  readonly config: DbxPromptConfirmConfig = {
    title: 'Unsaved Changes',
    prompt: 'You have unsaved changes on this page.',
    confirmText: 'Stay',
    cancelText: 'Leave without saving'
  };

  confirm(): void {
    this.dialogRef.close('stay');
  }

  cancel(): void {
    this.dialogRef.close('discard');
  }
}
