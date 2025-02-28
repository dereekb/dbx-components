import { Component, Input, OnDestroy } from '@angular/core';
import { TextPasswordFieldConfig, provideFormlyContext, AbstractAsyncFormlyFormDirective, usernamePasswordLoginFields, DefaultUsernameLoginFieldsValue } from '@dereekb/dbx-form';
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
  providers: [provideFormlyContext()]
})
export class DbxFirebaseEmailFormComponent extends AbstractAsyncFormlyFormDirective<DbxFirebaseEmailFormValue> implements OnDestroy {
  private _config = new BehaviorSubject<DbxFirebaseEmailFormConfig>({ loginMode: 'login' });

  readonly fields$: Observable<Maybe<FormlyFieldConfig[]>> = this._config.pipe(
    map(({ loginMode = 'login', passwordConfig }) => {
      const fields: FormlyFieldConfig[] = usernamePasswordLoginFields({ username: 'email', password: passwordConfig, verifyPassword: loginMode === 'register' });
      return fields;
    })
  );

  @Input()
  set config(config: DbxFirebaseEmailFormConfig) {
    this._config.next(config);
  }

  override ngOnDestroy() {
    super.ngOnDestroy();
    this._config.complete();
  }
}
