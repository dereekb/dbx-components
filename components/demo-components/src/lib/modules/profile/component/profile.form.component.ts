import { Component } from '@angular/core';
import { AbstractSyncForgeFormDirective, DBX_FORGE_FORM_COMPONENT_TEMPLATE, DbxForgeFormComponentImportsModule, dbxForgeFormComponentProviders } from '@dereekb/dbx-form';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { type Profile } from 'demo-firebase';
import { profileFields } from './profile.form';

export type DemoProfileFormValue = Pick<Profile, 'bio'>;

@Component({
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  selector: 'demo-profile-form',
  providers: dbxForgeFormComponentProviders(),
  standalone: true,
  imports: [DbxForgeFormComponentImportsModule]
})
export class DemoProfileFormComponent extends AbstractSyncForgeFormDirective<DemoProfileFormValue> {
  readonly formConfig: FormConfig = { fields: profileFields() };
}
