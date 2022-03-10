import { Component } from '@angular/core';
import { HandleActionFunction, WorkHandlerContext } from '@dereekb/dbx-core';
import { DbxActionFormModifiedFn, DbxActionFormValidateFn } from '@dereekb/dbx-form';
import { addDays, isSameMinute, isFriday } from 'date-fns';
import { map, of, delay } from 'rxjs';
import { DocActionFormExampleValue } from '../component/action.example.form.component';

@Component({
  templateUrl: './form.component.html'
})
export class DocActionFormComponent {

  readonly defaultValue: DocActionFormExampleValue = {
    name: 'test',
    date: addDays(new Date(), 2)
  };

  readonly defaultValue$ = of(this.defaultValue);

  readonly isFormModified: DbxActionFormModifiedFn<DocActionFormExampleValue> = (value: DocActionFormExampleValue) => {
    return this.defaultValue$.pipe(
      map((defaultValue) => {
        const isModified = Boolean(value.name === defaultValue.name) || !isSameMinute(value.date, defaultValue.date);
        return isModified;
      }));
  }

  readonly validateForm: DbxActionFormValidateFn<DocActionFormExampleValue> = (value: DocActionFormExampleValue) => {
    return of(isFriday(value.date));
  }

  readonly handleFormAction: HandleActionFunction = (filter: DocActionFormExampleValue, context: WorkHandlerContext) => {
    return of(true).pipe(delay(1000));
  }

}
