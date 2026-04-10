import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractConfigAsyncForgeFormDirective, provideDbxForgeFormContext, DbxForgeFormComponent, forgeUsernameLoginField, forgeTextPasswordField, forgeTextVerifyPasswordField, type DbxForgeTextPasswordFieldConfig, type DefaultUsernameLoginFieldsValue } from '@dereekb/dbx-form';
import { type Maybe } from '@dereekb/util';
import type { FormConfig } from '@ng-forge/dynamic-forms';
import { map, type Observable } from 'rxjs';
import { type DbxFirebaseLoginMode } from './login';

/**
 * Form value containing email (username) and password fields.
 */
export type DbxFirebaseEmailFormValue = DefaultUsernameLoginFieldsValue;

/**
 * Configuration for the email login form, specifying mode and optional password constraints.
 */
export interface DbxFirebaseEmailFormConfig {
  readonly loginMode: DbxFirebaseLoginMode;
  readonly passwordConfig?: DbxForgeTextPasswordFieldConfig;
}

/**
 * Forge-based email/password login form that adapts fields based on login vs. register mode.
 *
 * In register mode, includes a password verification field.
 */
@Component({
  selector: 'dbx-firebase-email-forge-form',
  template: `
    <dbx-forge></dbx-forge>
  `,
  providers: provideDbxForgeFormContext(),
  imports: [DbxForgeFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseEmailForgeFormComponent extends AbstractConfigAsyncForgeFormDirective<DbxFirebaseEmailFormValue, DbxFirebaseEmailFormConfig> {
  readonly config$: Observable<Maybe<FormConfig>> = this.currentConfig$.pipe(
    map((config) => {
      if (!config) {
        return undefined;
      }

      const loginMode = config.loginMode ?? 'login';
      const passwordConfig = config.passwordConfig;

      const fields = [forgeUsernameLoginField('email'), forgeTextPasswordField(passwordConfig), ...(loginMode === 'register' ? [forgeTextVerifyPasswordField()] : [])];
      return { fields };
    })
  );
}
