import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { TextPasswordFieldConfig, usernamePasswordLoginFields, DefaultUsernameLoginFieldsValue, AbstractConfigAsyncFormlyFormDirective, DBX_FORMLY_FORM_COMPONENT_TEMPLATE, DbxFormlyFormComponentImportsModule, dbxFormlyFormComponentProviders } from '@dereekb/dbx-form';
import { type Maybe } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { map, Observable } from 'rxjs';
import { DbxFirebaseLoginMode } from './login';

export type DbxFirebaseEmailFormValue = DefaultUsernameLoginFieldsValue;

export interface DbxFirebaseEmailFormConfig {
  readonly loginMode: DbxFirebaseLoginMode;
  readonly passwordConfig?: TextPasswordFieldConfig;
}

@Component({
  selector: 'dbx-firebase-email-form',
  template: DBX_FORMLY_FORM_COMPONENT_TEMPLATE,
  imports: [DbxFormlyFormComponentImportsModule],
  providers: dbxFormlyFormComponentProviders(),
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseEmailFormComponent extends AbstractConfigAsyncFormlyFormDirective<DbxFirebaseEmailFormValue, DbxFirebaseEmailFormConfig> implements OnDestroy {
  readonly fields$: Observable<Maybe<FormlyFieldConfig[]>> = this.currentConfig$.pipe(
    map((config) => {
      const loginMode = config?.loginMode ?? 'login';
      const passwordConfig = config?.passwordConfig;

      const fields: FormlyFieldConfig[] = usernamePasswordLoginFields({ username: 'email', password: passwordConfig, verifyPassword: loginMode === 'register' });
      return fields;
    })
  );
}
