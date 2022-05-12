import { Component } from "@angular/core";
import { ProvideFormlyContext, AbstractSyncFormlyFormDirective, DbxFormlyContext } from "@dereekb/dbx-form";
import { FormlyFieldConfig } from "@ngx-formly/core";
import { DemoProfileService } from "../profile.service";
import { ProfileCollectionStore } from "../store/profile.collection.store";
import { profileUsernameFields } from "./profile.form";

export interface DemoProfileUsernameFormValue {
  username: string;
}

@Component({
  template: `<dbx-formly></dbx-formly>`,
  selector: 'demo-profile-username-form',
  providers: [ProvideFormlyContext()]
})
export class DemoProfileUsernameFormComponent extends AbstractSyncFormlyFormDirective<DemoProfileUsernameFormValue> {

  readonly fields: FormlyFieldConfig[] = profileUsernameFields({
    checkUsernameIsAvailable: (username) => {
      return this.profileService.isUsernameAvailable(username);
    }
  });

  constructor(context: DbxFormlyContext, readonly profileService: DemoProfileService) {
    super(context);
  }

}
