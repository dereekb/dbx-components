import { Component } from '@angular/core';
import { WorkUsingObservable, IsModifiedFunction, IsValidFunction, IsEqualFunction } from '@dereekb/rxjs';
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
