import { Component } from "@angular/core";
import { ProvideFormlyContext, AbstractSyncFormlyFormDirective } from "@dereekb/dbx-form";
import { Profile } from "@dereekb/demo-firebase";
import { FormlyFieldConfig } from "@ngx-formly/core";
import { profileFields } from "./profile.form";

export interface DemoProfileFormValue extends Pick<Profile, 'bio'> { }

@Component({
  template: `<dbx-formly></dbx-formly>`,
  selector: 'demo-profile-form',
  providers: [ProvideFormlyContext()]
})
export class DemoProfileFormComponent extends AbstractSyncFormlyFormDirective<DemoProfileFormValue> {

  readonly fields: FormlyFieldConfig[] = profileFields();

}
