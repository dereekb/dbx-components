import { Component, inject } from '@angular/core';
import { provideFormlyContext, AbstractSyncFormlyFormDirective } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DemoProfileService } from '../profile.service';
import { profileUsernameFields } from './profile.form';

export interface DemoProfileUsernameFormValue {
  username: string;
}

@Component({
  template: `
    <dbx-formly></dbx-formly>
  `,
  selector: 'demo-profile-username-form',
  providers: [provideFormlyContext()]
})
export class DemoProfileUsernameFormComponent extends AbstractSyncFormlyFormDirective<DemoProfileUsernameFormValue> {
  readonly profileService = inject(DemoProfileService);

  readonly fields: FormlyFieldConfig[] = profileUsernameFields({
    checkUsernameIsAvailable: (username) => {
      return this.profileService.isUsernameAvailable(username);
    }
  });
}
