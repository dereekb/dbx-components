import { usernamePasswordLoginFields, timezoneStringField, DbxFormTimezoneStringFieldModule, DbxFormSourceDirective, websiteUrlField, forgeUsernamePasswordLoginFields, forgeWebsiteUrlField, forgeTimezoneStringField } from '@dereekb/dbx-form';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { DbxBarDirective, DbxContentContainerDirective } from '@dereekb/dbx-web';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormExampleComponent } from '../component/example.form.component';
import { DocFormForgeExampleComponent } from '../component/forge.example.form.component';
import { DocFeatureDerivedComponent } from '../../shared/component/feature.derived.component';

@Component({
  templateUrl: './template.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DbxBarDirective, MatSlideToggle, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormExampleComponent, DocFormForgeExampleComponent, DbxFormSourceDirective, DocFeatureDerivedComponent, DbxFormTimezoneStringFieldModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormTemplateComponent {
  readonly disabled = signal(false);
  readonly usernamePasswordLoginField: FormlyFieldConfig[] = usernamePasswordLoginFields({
    username: 'email'
  });

  readonly forgeUsernamePasswordLoginConfig: FormConfig = {
    fields: forgeUsernamePasswordLoginFields({ username: 'email' })
  };

  readonly usernamePasswordLoginWithVerifyField: FormlyFieldConfig[] = usernamePasswordLoginFields({
    username: 'email',
    verifyPassword: true
  });

  readonly timezoneSelectionField: FormlyFieldConfig[] = [timezoneStringField()];

  readonly forgeTimezoneSelectionConfig: FormConfig = {
    fields: [forgeTimezoneStringField()]
  };

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

  readonly forgeWebsiteUrlFieldsConfig: FormConfig = {
    fields: [
      forgeWebsiteUrlField({
        label: 'Custom Label',
        key: 'websiteWithPrefix'
      }),
      forgeWebsiteUrlField({
        key: 'websiteWithoutPrefix',
        label: 'Custom Label (Prefix Not Required)'
      }),
      forgeWebsiteUrlField({
        key: 'websiteWithRequiredDomain',
        label: 'Custom Label For Specific Domain (www.google.com)'
      })
    ]
  };

  readonly invalidVerifyContent = { username: 'test@test.com', password: 'verify', verifyPassword: 'other' };
}
