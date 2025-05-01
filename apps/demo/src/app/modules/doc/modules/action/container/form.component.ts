import { Component } from '@angular/core';
import { WorkUsingObservable, IsModifiedFunction, IsValidFunction, IsEqualFunction } from '@dereekb/rxjs';
import { addDays, isSameMinute, isFriday } from 'date-fns';
import { map, of, delay } from 'rxjs';
import { DocActionFormExampleValue, DocActionFormExampleFormComponent } from '../component/action.example.form.component';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocActionExampleToolsComponent } from '../component/action.example.tool.component';
import { DbxActionDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/context/action.directive';
import { DbxActionHandlerDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/state/action.handler.directive';
import { DbxActionFormDirective } from '../../../../../../../../../packages/dbx-form/src/lib/form/action/form.action.directive';
import { DbxButtonComponent } from '../../../../../../../../../packages/dbx-web/src/lib/button/button.component';
import { DbxActionButtonDirective } from '../../../../../../../../../packages/dbx-core/src/lib/button/action/action.button.directive';
import { DbxActionEnforceModifiedDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/state/action.enforce.modified.directive';
import { DbxFormSourceDirective } from '../../../../../../../../../packages/dbx-form/src/lib/form/io/form.input.directive';
import { DocActionFormExampleFormTwoComponent } from '../component/action.example.form.two.component';
import { DbxErrorComponent } from '../../../../../../../../../packages/dbx-web/src/lib/error/error.component';
import { DbxActionErrorDirective } from '../../../../../../../../../packages/dbx-web/src/lib/error/error.action.directive';

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
