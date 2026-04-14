import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractSyncForgeFormDirective, DBX_FORGE_FORM_COMPONENT_TEMPLATE, dbxForgeFormComponentProviders, DbxForgeFormComponentImportsModule, forgeEmailField } from '@dereekb/dbx-form';
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
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  providers: dbxForgeFormComponentProviders(),
  imports: [DbxForgeFormComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseEmailRecoveryForgeFormComponent extends AbstractSyncForgeFormDirective<DbxFirebaseEmailRecoveryFormValue> {
  readonly formConfig: FormConfig = { fields: [forgeEmailField({ key: 'email', required: true })] };
}
