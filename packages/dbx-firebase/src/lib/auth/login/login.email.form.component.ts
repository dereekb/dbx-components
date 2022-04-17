import { Component, Input, OnDestroy } from "@angular/core";
import { ProvideFormlyContext, AbstractAsyncFormlyFormDirective, usernamePasswordLoginFields, UsernameLoginFieldsConfig, DefaultUsernameLoginFieldsValue } from "@dereekb/dbx-form";
import { Maybe } from "@dereekb/util";
import { FormlyFieldConfig } from "@ngx-formly/core";
import { BehaviorSubject, map, Observable } from "rxjs";
import { DbxFirebaseLoginMode } from "./login";

export interface DbxFirebaseEmailFormValue extends DefaultUsernameLoginFieldsValue { }

@Component({
  template: `<dbx-formly></dbx-formly>`,
  selector: 'dbx-firebase-email-form',
  providers: [ProvideFormlyContext()]
})
export class DbxFirebaseEmailFormComponent extends AbstractAsyncFormlyFormDirective<DbxFirebaseEmailFormValue> implements OnDestroy {

  private _mode = new BehaviorSubject<DbxFirebaseLoginMode>('login');

  readonly fields$: Observable<Maybe<FormlyFieldConfig[]>> = this._mode.pipe(
    map((mode) => {
      const fields: FormlyFieldConfig[] = usernamePasswordLoginFields({ username: 'email', verifyPassword: (mode === 'register') });
      return fields;
    })
  );

  @Input()
  set loginMode(loginMode: DbxFirebaseLoginMode) {
    this._mode.next(loginMode);
  }

  override ngOnDestroy() {
    super.ngOnDestroy();
    this._mode.complete();
  }

}
