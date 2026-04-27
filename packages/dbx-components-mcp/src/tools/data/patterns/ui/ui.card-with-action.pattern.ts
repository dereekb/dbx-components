import type { UiExamplePattern } from '../ui-patterns.js';

export const UI_PATTERN_CARD_WITH_ACTION: UiExamplePattern = {
  slug: 'card-with-action',
  name: 'Card with destructive action',
  summary: 'A dbx-card-box with a confirm-protected delete button — the canonical pattern for "danger zone" UI.',
  usesUiSlugs: ['card-box', 'bar', 'button', 'action-confirm'],
  snippets: {
    minimal: `<dbx-card-box header="Danger zone">
  <p>Deleting this account is permanent.</p>
  <dbx-button text="Delete" color="warn" [dbxAction]="deleteAction" [dbxActionConfirm]="confirmConfig"></dbx-button>
</dbx-card-box>`,
    brief: `<dbx-card-box header="Danger zone" icon="warning">
  <p>Deleting your account is permanent and cannot be undone.</p>
  <dbx-bar>
    <span class="spacer"></span>
    <dbx-button
      text="Delete account"
      icon="delete"
      stroked
      color="warn"
      [dbxAction]="deleteAccountAction"
      [dbxActionConfirm]="{ header: 'Delete account?', prompt: 'This cannot be undone.', confirmText: 'Delete' }">
    </dbx-button>
  </dbx-bar>
</dbx-card-box>`,
    full: `import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxCardBoxComponent, DbxBarDirective, DbxButtonComponent, DbxActionConfirmDirective } from '@dereekb/dbx-web';
import { DbxActionDirective } from '@dereekb/dbx-core';
import { DbxActionConfirmConfig } from '@dereekb/dbx-web';

@Component({
  selector: 'app-danger-zone',
  standalone: true,
  imports: [DbxCardBoxComponent, DbxBarDirective, DbxButtonComponent, DbxActionDirective, DbxActionConfirmDirective],
  template: \`
    <dbx-card-box header="Danger zone" icon="warning">
      <p>Deleting your account is permanent and cannot be undone.</p>
      <dbx-bar>
        <span class="spacer"></span>
        <dbx-button
          text="Delete account"
          icon="delete"
          stroked
          color="warn"
          [dbxAction]="deleteAccountAction"
          [dbxActionConfirm]="confirmConfig">
        </dbx-button>
      </dbx-bar>
    </dbx-card-box>
  \`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DangerZoneComponent {
  readonly deleteAccountAction = /* DbxActionContextStoreSourceInstance<...> */ null;
  readonly confirmConfig: DbxActionConfirmConfig = {
    header: 'Delete account?',
    prompt: 'This cannot be undone.',
    confirmText: 'Delete'
  };
}`
  },
  notes: 'Wire `[dbxActionSnackbar]` alongside `[dbxActionConfirm]` to surface success/error toasts after the confirm fires.'
};
