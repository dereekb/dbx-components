import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type TextPasswordFieldConfig, usernamePasswordLoginFields, type DefaultUsernameLoginFieldsValue, AbstractConfigAsyncFormlyFormDirective, DBX_FORMLY_FORM_COMPONENT_TEMPLATE, DbxFormlyFormComponentImportsModule, dbxFormlyFormComponentProviders } from '@dereekb/dbx-form';
import { type Maybe } from '@dereekb/util';
import { type FormlyFieldConfig } from '@ngx-formly/core';
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
  readonly passwordConfig?: TextPasswordFieldConfig;
}

/**
 * Formly-based email/password login form that adapts fields based on login vs. register mode.
 *
 * In register mode, includes a password verification field.
 */
@Component({
  selector: 'dbx-firebase-email-form',
  template: DBX_FORMLY_FORM_COMPONENT_TEMPLATE,
  imports: [DbxFormlyFormComponentImportsModule],
  providers: dbxFormlyFormComponentProviders(),
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseEmailFormComponent extends AbstractConfigAsyncFormlyFormDirective<DbxFirebaseEmailFormValue, DbxFirebaseEmailFormConfig> {
  readonly fields$: Observable<Maybe<FormlyFieldConfig[]>> = this.currentConfig$.pipe(
    map((config) => {
      const loginMode = config?.loginMode ?? 'login';
      const passwordConfig = config?.passwordConfig;

      const fields: FormlyFieldConfig[] = usernamePasswordLoginFields({ username: 'email', password: passwordConfig, verifyPassword: loginMode === 'register' });
      return fields;
    })
  );
}
