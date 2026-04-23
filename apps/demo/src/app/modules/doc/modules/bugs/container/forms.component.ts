import { ChangeDetectionStrategy, Component } from '@angular/core';
import { dbxForgeNameField, dbxForgePhoneField, DbxFormSourceDirective, DbxActionFormDirective } from '@dereekb/dbx-form';
import type { FormConfig } from '@ng-forge/dynamic-forms';
import { type WorkUsingObservable } from '@dereekb/rxjs';
import { of, delay } from 'rxjs';
import { DbxContentContainerDirective, DbxButtonComponent, DbxErrorComponent, DbxActionErrorDirective } from '@dereekb/dbx-web';
import { DbxActionDirective, DbxActionHandlerDirective, DbxActionButtonDirective, DbxActionEnforceModifiedDirective } from '@dereekb/dbx-core';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFormForgeExampleComponent } from '../../form/component/forge.example.form.component';

@Component({
  templateUrl: './forms.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFormForgeExampleComponent, DbxFormSourceDirective, DbxActionDirective, DbxActionHandlerDirective, DbxActionFormDirective, DbxButtonComponent, DbxActionButtonDirective, DbxActionEnforceModifiedDirective, DbxErrorComponent, DbxActionErrorDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocBugsFormsComponent {
  // -- Phone Dirty State --
  readonly phoneDirtyStateConfig: FormConfig = {
    fields: [dbxForgeNameField({ required: true }), dbxForgePhoneField({ key: 'phone' })]
  } as FormConfig;

  readonly phoneDirtyStateDefaultValue$ = of({
    name: 'Test User',
    phone: '+12025551234'
  });

  readonly handlePhoneDirtyStateAction: WorkUsingObservable<object> = () => {
    return of(true).pipe(delay(1000));
  };
}
