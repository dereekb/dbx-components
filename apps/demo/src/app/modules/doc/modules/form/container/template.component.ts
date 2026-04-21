import { formlyUsernamePasswordLoginFields, formlyTimezoneStringField, DbxFormTimezoneStringFieldModule, DbxFormSourceDirective, formlyWebsiteUrlField, dbxForgeUsernamePasswordLoginFields, dbxForgeWebsiteUrlField, dbxForgeTimezoneStringField } from '@dereekb/dbx-form';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormExampleComponent } from '../component/example.form.component';
import { DocFormForgeExampleComponent } from '../component/forge.example.form.component';
import { DocFeatureDerivedComponent } from '../../shared/component/feature.derived.component';

@Component({
  templateUrl: './template.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormExampleComponent, DocFormForgeExampleComponent, DbxFormSourceDirective, DocFeatureDerivedComponent, DbxFormTimezoneStringFieldModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormTemplateComponent {
  readonly usernamePasswordLoginField: FormlyFieldConfig[] = formlyUsernamePasswordLoginFields({
    username: 'email'
  });

  readonly forgeUsernamePasswordLoginConfig: FormConfig = {
    fields: dbxForgeUsernamePasswordLoginFields({ username: 'email' })
  };

  readonly usernamePasswordLoginWithVerifyField: FormlyFieldConfig[] = formlyUsernamePasswordLoginFields({
    username: 'email',
    verifyPassword: true
  });

  readonly timezoneSelectionField: FormlyFieldConfig[] = [formlyTimezoneStringField()];

  readonly forgeTimezoneSelectionConfig: FormConfig = {
    fields: [dbxForgeTimezoneStringField()]
  };

  readonly websiteUrlFields: FormlyFieldConfig[] = [
    formlyWebsiteUrlField({
      label: 'Custom Label',
      key: 'websiteWithPrefix',
      requirePrefix: true
    }),
    formlyWebsiteUrlField({
      key: 'websiteWithoutPrefix',
      label: 'Custom Label (Prefix Not Required)',
      requirePrefix: false
    }),
    formlyWebsiteUrlField({
      key: 'websiteWithRequiredDomain',
      label: 'Custom Label For Specific Domain (www.google.com)',
      validDomains: ['www.google.com'],
      requirePrefix: false
    })
  ];

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
