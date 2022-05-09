import { Component } from '@angular/core';
import { HandleActionFunction } from '@dereekb/dbx-core';
import { IsModifiedFunction, IsValidFunction, WorkInstance } from '@dereekb/rxjs';
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

  readonly isFormModified: IsModifiedFunction<DocActionFormExampleValue> = (value: DocActionFormExampleValue) => {
    return this.defaultValue$.pipe(
      map((defaultValue) => {
        const isModified = Boolean(value.name === defaultValue.name) || !isSameMinute(value.date, defaultValue.date);
        return isModified;
      }));
  }

  readonly validateForm: IsValidFunction<DocActionFormExampleValue> = (value: DocActionFormExampleValue) => {
    return of(isFriday(value.date));
  }

  readonly handleFormAction: HandleActionFunction = (filter: DocActionFormExampleValue, instance: WorkInstance) => {
    return of(true).pipe(delay(1000));
  }

}
