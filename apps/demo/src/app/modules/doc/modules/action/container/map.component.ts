import { BehaviorSubject, delay, of, tap } from 'rxjs';
import { DocActionFormExampleValue } from './../component/action.example.form.component';
import { Component, OnDestroy } from '@angular/core';
import { WorkUsingObservable } from '@dereekb/rxjs';
import { MS_IN_SECOND, Maybe } from '@dereekb/util';

@Component({
  templateUrl: './map.component.html'
})
export class DocActionMapComponent implements OnDestroy {
  private _value = new BehaviorSubject<Maybe<DocActionFormExampleValue>>({
    name: 'test',
    date: new Date()
  });

  readonly value$ = this._value.asObservable();
  readonly saveThrottleTime = MS_IN_SECOND * 2;

  constructor() {}

  ngOnDestroy(): void {
    this._value.complete();
  }

  handleSaveDraft: WorkUsingObservable<DocActionFormExampleValue, any> = (value: DocActionFormExampleValue) => {
    return of(value).pipe(
      delay(MS_IN_SECOND),
      tap(() => {
        this._value.next(value);
      })
    );
  };

  handleSendDraft: WorkUsingObservable<DocActionFormExampleValue, any> = (value: DocActionFormExampleValue) => {
    return of(value).pipe(delay(MS_IN_SECOND));
  };
}
