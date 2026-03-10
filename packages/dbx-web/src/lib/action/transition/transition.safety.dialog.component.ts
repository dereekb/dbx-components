import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractDialogDirective } from '../../interaction/dialog/abstract.dialog.directive';
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
 * discard changes, or save before leaving.
 */
@Component({
  template: `
    <dbx-prompt-confirm [config]="config" (confirm)="confirm()" (cancel)="cancel()">
      <ng-container>
        <dbx-error dbxActionError></dbx-error>
        <dbx-button text="Save Changes" dbxActionButton></dbx-button>
        <dbx-button-spacer></dbx-button-spacer>
      </ng-container>
    </dbx-prompt-confirm>
  `,
  standalone: true,
  imports: [DbxPromptConfirmComponent, DbxErrorComponent, DbxActionErrorDirective, DbxButtonComponent, DbxButtonSpacerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxActionUIRouterTransitionSafetyDialogComponent extends AbstractDialogDirective {
  readonly config: DbxPromptConfirmConfig = {
    title: 'Unsaved Changes',
    prompt: 'You have unsaved changes on this page.',
    confirmText: 'Stay',
    cancelText: 'Discard Changes'
  };

  confirm(): void {
    this.dialogRef.close('stay');
  }

  cancel(): void {
    this.dialogRef.close('discard');
  }
}
