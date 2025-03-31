import { ChangeDetectionStrategy, Component, Input, OnDestroy } from '@angular/core';
import { TextPasswordFieldConfig, provideFormlyContext, AbstractAsyncFormlyFormDirective, usernamePasswordLoginFields, DefaultUsernameLoginFieldsValue, DbxFormlyModule, AbstractConfigAsyncFormlyFormDirective } from '@dereekb/dbx-form';
import { type Maybe } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { DbxFirebaseLoginMode } from './login';

export type DbxFirebaseEmailFormValue = DefaultUsernameLoginFieldsValue;

export interface DbxFirebaseEmailFormConfig {
  loginMode: DbxFirebaseLoginMode;
  passwordConfig?: TextPasswordFieldConfig;
}

@Component({
  template: `
    <dbx-formly></dbx-formly>
  `,
  selector: 'dbx-firebase-email-form',
  standalone: true,
  imports: [DbxFormlyModule],
  providers: [provideFormlyContext()],
  changeDetection: ChangeDetectionStrategy.OnPush
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
