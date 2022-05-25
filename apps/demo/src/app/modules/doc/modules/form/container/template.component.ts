import { usernamePasswordLoginFields } from '@dereekb/dbx-form';
import { Component } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';

@Component({
  templateUrl: './template.component.html'
})
export class DocFormTemplateComponent {

  readonly usernamePasswordLoginField: FormlyFieldConfig[] = usernamePasswordLoginFields({
    username: 'email'
  });

  readonly usernamePasswordLoginWithVerifyField: FormlyFieldConfig[] = usernamePasswordLoginFields({
    username: 'email',
    verifyPassword: true
  });

  readonly invalidVerifyContent = { username: 'test@test.com', password: 'verify', verifyPassword: 'other' }

}
