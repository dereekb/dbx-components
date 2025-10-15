import { usernamePasswordLoginFields, timezoneStringField, DbxFormTimezoneStringFieldModule, DbxFormSourceDirective, websiteUrlField } from '@dereekb/dbx-form';
import { Component } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFormExampleComponent } from '../component/example.form.component';
import { DocFeatureDerivedComponent } from '../../shared/component/feature.derived.component';

@Component({
  templateUrl: './template.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFormExampleComponent, DbxFormSourceDirective, DocFeatureDerivedComponent, DbxFormTimezoneStringFieldModule]
})
export class DocFormTemplateComponent {
  readonly usernamePasswordLoginField: FormlyFieldConfig[] = usernamePasswordLoginFields({
    username: 'email'
  });

  readonly usernamePasswordLoginWithVerifyField: FormlyFieldConfig[] = usernamePasswordLoginFields({
    username: 'email',
    verifyPassword: true
  });

  readonly timezoneSelectionField: FormlyFieldConfig[] = [timezoneStringField()];

  readonly websiteUrlFields: FormlyFieldConfig[] = [
    websiteUrlField({
      label: 'Custom Label',
      key: 'websiteWithPrefix',
      requirePrefix: true
    }),
    websiteUrlField({
      key: 'websiteWithoutPrefix',
      label: 'Custom Label (Prefix Not Required)',
      requirePrefix: false
    }),
    websiteUrlField({
      key: 'websiteWithRequiredDomain',
      label: 'Custom Label For Specific Domain (www.google.com)',
      validDomains: ['www.google.com'],
      requirePrefix: false
    })
  ];

  readonly invalidVerifyContent = { username: 'test@test.com', password: 'verify', verifyPassword: 'other' };
}
