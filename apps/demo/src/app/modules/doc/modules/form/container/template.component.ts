import { usernamePasswordLoginFields, timezoneStringField } from '@dereekb/dbx-form';
import { Component } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFormExampleComponent } from '../component/example.form.component';
import { DbxFormSourceDirective } from '@dereekb/dbx-form';
import { DocFeatureDerivedComponent } from '../../shared/component/feature.derived.component';

@Component({
  templateUrl: './template.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFormExampleComponent, DbxFormSourceDirective, DocFeatureDerivedComponent]
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

  readonly invalidVerifyContent = { username: 'test@test.com', password: 'verify', verifyPassword: 'other' };
}
