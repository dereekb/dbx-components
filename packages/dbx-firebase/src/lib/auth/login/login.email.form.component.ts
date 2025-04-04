import { Component, OnDestroy } from '@angular/core';
import { TextPasswordFieldConfig, usernamePasswordLoginFields, DefaultUsernameLoginFieldsValue, AbstractConfigAsyncFormlyFormDirective, FORMLY_FORM_COMPONENT_TEMPLATE } from '@dereekb/dbx-form';
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
  template: FORMLY_FORM_COMPONENT_TEMPLATE.template,
  imports: FORMLY_FORM_COMPONENT_TEMPLATE.imports,
  providers: FORMLY_FORM_COMPONENT_TEMPLATE.providers,
  changeDetection: FORMLY_FORM_COMPONENT_TEMPLATE.changeDetection,
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
