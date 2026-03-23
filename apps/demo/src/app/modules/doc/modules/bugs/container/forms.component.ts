import { type FormlyFieldConfig } from '@ngx-formly/core';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { nameField, phoneField, DbxFormFormlyTextFieldModule, DbxFormFormlyPhoneFieldModule, DbxFormlyFieldsContextDirective, DbxFormSourceDirective, DbxActionFormDirective } from '@dereekb/dbx-form';
import { type WorkUsingObservable } from '@dereekb/rxjs';
import { of, delay } from 'rxjs';
import { DbxContentContainerDirective, DbxButtonComponent, DbxErrorComponent, DbxActionErrorDirective } from '@dereekb/dbx-web';
import { DbxActionDirective, DbxActionHandlerDirective, DbxActionButtonDirective, DbxActionEnforceModifiedDirective } from '@dereekb/dbx-core';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFormExampleComponent } from '../../form/component/example.form.component';

@Component({
  templateUrl: './forms.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFormExampleComponent, DbxFormlyFieldsContextDirective, DbxFormSourceDirective, DbxFormFormlyTextFieldModule, DbxFormFormlyPhoneFieldModule, DbxActionDirective, DbxActionHandlerDirective, DbxActionFormDirective, DbxButtonComponent, DbxActionButtonDirective, DbxActionEnforceModifiedDirective, DbxErrorComponent, DbxActionErrorDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocBugsFormsComponent {
  // -- Phone Dirty State --
  readonly phoneDirtyStateFields: FormlyFieldConfig[] = [nameField({ required: true }), phoneField()];

  readonly phoneDirtyStateDefaultValue$ = of({
    name: 'Test User',
    phone: '+12025551234'
  });

  readonly handlePhoneDirtyStateAction: WorkUsingObservable<object> = () => {
    return of(true).pipe(delay(1000));
  };
}
