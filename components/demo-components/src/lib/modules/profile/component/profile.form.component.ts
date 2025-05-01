import { Component } from '@angular/core';
import { provideFormlyContext, AbstractSyncFormlyFormDirective } from '@dereekb/dbx-form';
import { Profile } from 'demo-firebase';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { profileFields } from './profile.form';
import { DbxFormlyComponent } from '@dereekb/dbx-form';

export type DemoProfileFormValue = Pick<Profile, 'bio'>;

@Component({
  template: `
    <dbx-formly></dbx-formly>
  `,
  selector: 'demo-profile-form',
  providers: [provideFormlyContext()],
  standalone: true,
  imports: [DbxFormlyComponent]
})
export class DemoProfileFormComponent extends AbstractSyncFormlyFormDirective<DemoProfileFormValue> {
  readonly fields: FormlyFieldConfig[] = profileFields();
}
