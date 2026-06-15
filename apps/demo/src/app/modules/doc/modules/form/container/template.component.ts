import { DbxFormSourceDirective, dbxForgeUsernamePasswordLoginFields, dbxForgeWebsiteUrlField, dbxForgeTimezoneStringField } from '@dereekb/dbx-form';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormForgeExampleComponent } from '../../shared/component/forge.example.form.component';
import { DocFeatureDerivedComponent } from '../../shared/component/feature.derived.component';

@Component({
  templateUrl: './template.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormForgeExampleComponent, DbxFormSourceDirective, DocFeatureDerivedComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormTemplateComponent {
  readonly forgeUsernamePasswordLoginConfig: FormConfig = {
    fields: dbxForgeUsernamePasswordLoginFields({ username: 'email' })
  };

  readonly forgeUsernamePasswordLoginWithVerifyConfig: FormConfig = {
    fields: dbxForgeUsernamePasswordLoginFields({ username: 'email', verifyPassword: true })
  };

  readonly forgeTimezoneSelectionConfig: FormConfig = {
    fields: [dbxForgeTimezoneStringField()]
  };

  readonly forgeWebsiteUrlFieldsConfig: FormConfig = {
    fields: [
      dbxForgeWebsiteUrlField({
        label: 'Custom Label',
        key: 'websiteWithPrefix'
      }),
      dbxForgeWebsiteUrlField({
        key: 'websiteWithoutPrefix',
        label: 'Custom Label (Prefix Not Required)'
      }),
      dbxForgeWebsiteUrlField({
        key: 'websiteWithRequiredDomain',
        label: 'Custom Label For Specific Domain (www.google.com)'
      })
    ]
  };

  readonly invalidVerifyContent = { username: 'test@test.com', password: 'verify', verifyPassword: 'other' };
}
