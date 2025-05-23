import { Component, inject } from '@angular/core';
import { provideFormlyContext, AbstractSyncFormlyFormDirective, DbxFormTextAvailableFieldModule , DbxFormlyComponent } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DemoProfileService } from '../profile.service';
import { profileUsernameFields } from './profile.form';
import { of } from 'rxjs';

export interface DemoProfileUsernameFormValue {
  username: string;
}

@Component({
  template: `
    <dbx-formly></dbx-formly>
  `,
  selector: 'demo-profile-username-form',
  providers: [provideFormlyContext()],
  standalone: true,
  imports: [DbxFormlyComponent, DbxFormTextAvailableFieldModule]
})
export class DemoProfileUsernameFormComponent extends AbstractSyncFormlyFormDirective<DemoProfileUsernameFormValue> {
  readonly profileService = inject(DemoProfileService);

  readonly fields: FormlyFieldConfig[] = profileUsernameFields({
    checkUsernameIsAvailable: (username) => {
      // not allowed to check this way, no permissions for users to list available usernames
      return of(true); // this.profileService.isUsernameAvailable(username);
    }
  });
}
