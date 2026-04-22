import { Component, inject } from '@angular/core';
import { AbstractSyncForgeFormDirective, DBX_FORGE_FORM_COMPONENT_TEMPLATE, DbxForgeFormComponentImportsModule, dbxForgeFormComponentProviders } from '@dereekb/dbx-form';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { of } from 'rxjs';
import { DemoProfileService } from '../profile.service';
import { profileUsernameFields } from './profile.form';

export interface DemoProfileUsernameFormValue {
  username: string;
}

@Component({
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  selector: 'demo-profile-username-form',
  providers: dbxForgeFormComponentProviders(),
  standalone: true,
  imports: [DbxForgeFormComponentImportsModule]
})
export class DemoProfileUsernameFormComponent extends AbstractSyncForgeFormDirective<DemoProfileUsernameFormValue> {
  readonly profileService = inject(DemoProfileService);

  readonly formConfig: FormConfig = {
    fields: profileUsernameFields({
      checkUsernameIsAvailable: (_username) => {
        // not allowed to check this way, no permissions for users to list available usernames
        return of(true); // this.profileService.isUsernameAvailable(username);
      }
    })
  };
}
