import { BehaviorSubject, delay, of, tap } from 'rxjs';
import { DocActionFormExampleValue } from './../component/action.example.form.component';
import { Component, Input, OnDestroy } from '@angular/core';
import { HandleActionFunction } from '@dereekb/dbx-core';
import ms from 'ms';
import { Maybe } from '@dereekb/util';

@Component({
  templateUrl: './map.component.html'
})
export class DocActionMapComponent implements OnDestroy {

  private _value = new BehaviorSubject<Maybe<DocActionFormExampleValue>>({
    name: 'test',
    date: new Date()
  });

  readonly value$ = this._value.asObservable();
  readonly saveThrottleTime = ms('2s');

  constructor() { }

  ngOnDestroy(): void {
    this._value.complete();
  }

  handleSaveDraft: HandleActionFunction<DocActionFormExampleValue, any> = (value: DocActionFormExampleValue) => {
    return of(value).pipe(
      delay(ms('1s')),
      tap(() => {
        this._value.next(value);
      })
    );
  }

  handleSendDraft: HandleActionFunction<DocActionFormExampleValue, any> = (value: DocActionFormExampleValue) => {
    return of(value).pipe(
      delay(ms('1s'))
    );
  }

}
