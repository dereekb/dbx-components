import { usernamePasswordLoginFields } from '@dereekb/dbx-form';
import { MatDialog } from '@angular/material/dialog';
import { Component } from '@angular/core';
import { expandWrapper, flexLayoutWrapper, infoWrapper, nameField, sectionWrapper, subsectionWrapper, toggleWrapper, cityField, stateField, zipCodeField, countryField } from '@dereekb/dbx-form';
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
