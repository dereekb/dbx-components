import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractSyncForgeFormDirective, provideDbxForgeFormContext, DbxForgeFormComponent, forgeEmailField } from '@dereekb/dbx-form';
import type { FormConfig } from '@ng-forge/dynamic-forms';

/**
 * Form value for the password recovery form containing the email address.
 */
export interface DbxFirebaseEmailRecoveryFormValue {
  email: string;
}

/**
 * Forge-based form component for password recovery, containing a single email field.
 */
@Component({
  selector: 'dbx-firebase-email-recovery-forge-form',
  template: `
    <dbx-forge></dbx-forge>
  `,
  providers: provideDbxForgeFormContext(),
  imports: [DbxForgeFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseEmailRecoveryForgeFormComponent extends AbstractSyncForgeFormDirective<DbxFirebaseEmailRecoveryFormValue> {
  readonly config: FormConfig = { fields: [forgeEmailField({ key: 'email', required: true })] };
}
