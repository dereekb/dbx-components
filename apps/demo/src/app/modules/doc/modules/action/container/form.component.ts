import { Component } from '@angular/core';
import { WorkUsingObservable, IsModifiedFunction, IsValidFunction, IsEqualFunction } from '@dereekb/rxjs';
import { addDays, isSameMinute, isFriday } from 'date-fns';
import { map, of, delay } from 'rxjs';
import { DocActionFormExampleValue, DocActionFormExampleFormComponent } from '../component/action.example.form.component';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocActionExampleToolsComponent } from '../component/action.example.tool.component';
import { DbxActionDirective } from '@dereekb/dbx-core';
import { DbxActionHandlerDirective } from '@dereekb/dbx-core';
import { DbxActionFormDirective } from '@dereekb/dbx-form';
import { DbxButtonComponent } from '@dereekb/dbx-web';
import { DbxActionButtonDirective } from '@dereekb/dbx-core';
import { DbxActionEnforceModifiedDirective } from '@dereekb/dbx-core';
import { DbxFormSourceDirective } from '@dereekb/dbx-form';
import { DocActionFormExampleFormTwoComponent } from '../component/action.example.form.two.component';
import { DbxErrorComponent } from '@dereekb/dbx-web';
import { DbxActionErrorDirective } from '@dereekb/dbx-web';

@Component({
  templateUrl: './form.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocActionExampleToolsComponent, DbxActionDirective, DbxActionHandlerDirective, DocActionFormExampleFormComponent, DbxActionFormDirective, DbxButtonComponent, DbxActionButtonDirective, DbxActionEnforceModifiedDirective, DbxFormSourceDirective, DocActionFormExampleFormTwoComponent, DbxErrorComponent, DbxActionErrorDirective]
})
export class DocActionFormComponent {
  readonly defaultValue: DocActionFormExampleValue = {
    name: 'test',
    date: addDays(new Date(), 2)
  };

  readonly defaultValue$ = of(this.defaultValue);

  readonly isFormModified: IsModifiedFunction<DocActionFormExampleValue> = (value: DocActionFormExampleValue) => {
    return this.defaultValue$.pipe(
      map((defaultValue) => {
        const isModified = value.name !== defaultValue.name || !isSameMinute(value.date, defaultValue.date);
        return isModified;
      })
    );
  };

  readonly isFormEqual: IsEqualFunction<DocActionFormExampleValue> = (value: DocActionFormExampleValue) => {
    return this.defaultValue$.pipe(
      map((defaultValue) => {
        const isEqual = value.name === defaultValue.name && isSameMinute(value.date, defaultValue.date);
        return isEqual;
      })
    );
  };

  readonly validateForm: IsValidFunction<DocActionFormExampleValue> = (value: DocActionFormExampleValue) => {
    return of(isFriday(value.date));
  };

  readonly handleFormAction: WorkUsingObservable<DocActionFormExampleValue> = () => {
    return of(true).pipe(delay(1000));
  };
}
