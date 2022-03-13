import { BehaviorSubject, delay, of, tap } from 'rxjs';
import { DocActionFormExampleValue } from './../component/action.example.form.component';
import { Component, Input } from '@angular/core';
import { HandleActionFunction } from '@dereekb/dbx-core';
import ms from 'ms';
import { Maybe } from '@dereekb/util';

@Component({
  templateUrl: './map.component.html'
})
export class DocActionMapComponent {

  private _value = new BehaviorSubject<Maybe<DocActionFormExampleValue>>({
    name: 'test',
    date: new Date()
  });

  value$ = this._value.asObservable();

  saveThrottleTime = ms('2s');

  handleSaveDraft: HandleActionFunction<DocActionFormExampleValue, any> = (value: DocActionFormExampleValue) => {
    console.log('Save?');
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
