import { DbxFormSourceDirective, dbxForgeUsernamePasswordLoginFields, dbxForgeWebsiteUrlField, dbxForgeTimezoneStringField } from '@dereekb/dbx-form';
import { Component } from '@angular/core';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormForgeExampleComponent } from '../../shared/component/forge.example.form.component';
import { DocFeatureDerivedComponent } from '../../shared/component/feature.derived.component';

@Component({
  templateUrl: './template.component.html',
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormForgeExampleComponent, DbxFormSourceDirective, DocFeatureDerivedComponent]
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
        label: 'Custom Label (Prefix Not Required)',
        requirePrefix: false
      }),
      dbxForgeWebsiteUrlField({
        key: 'websiteWithRequiredDomain',
        label: 'Custom Label For Specific Domain (www.google.com)',
        validDomains: ['www.google.com']
      })
    ]
  };

  readonly forgeWebsiteUrlWithBaseUrlFieldsConfig: FormConfig = {
    fields: [
      dbxForgeWebsiteUrlField({
        key: 'linkedInUrl',
        label: 'LinkedIn Profile',
        hint: 'Type your username or paste your profile url. Saves the full url.',
        baseUrl: 'https://linkedin.com/in/'
      }),
      dbxForgeWebsiteUrlField({
        key: 'linkedInUrlAllowHttp',
        label: 'LinkedIn Profile (Allow Http)',
        hint: 'Pasting an http:// url keeps the http:// protocol.',
        baseUrl: 'https://linkedin.com/in/',
        allowHttp: true
      }),
      dbxForgeWebsiteUrlField({
        key: 'linkedInUsername',
        label: 'LinkedIn Username',
        hint: 'Type your username or paste your profile url. Saves only the username.',
        baseUrl: 'https://linkedin.com/in/',
        valueMode: 'relative'
      })
    ]
  };

  readonly websiteUrlWithBaseUrlContent = { linkedInUrl: 'https://www.linkedin.com/in/dereekb/', linkedInUsername: 'dereekb' };

  readonly invalidVerifyContent = { username: 'test@test.com', password: 'verify', verifyPassword: 'other' };
}
