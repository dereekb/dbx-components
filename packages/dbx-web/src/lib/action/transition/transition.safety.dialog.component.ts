import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { DbxPromptConfirmConfig, AbstractDialogDirective, DbxPromptConfirmComponent } from '../../interaction';
import { DbxErrorComponent } from '../../error/error.component';
import { DbxActionErrorDirective } from '../../error/error.action.directive';
import { DbxButtonComponent } from '../../button/button.component';
import { DbxButtonSpacerDirective } from '../../button/button.spacer.directive';

export type DbxActionTransitionSafetyDialogResult = 'success' | 'stay' | 'discard' | 'none';

/**
 * Dialog that is shown/triggered as part of the DbxActionTransitionSafety
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
export class DbxActionUIRouterTransitionSafetyDialogComponent extends AbstractDialogDirective implements OnInit {
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
