import { Component } from '@angular/core';
import { HandleActionFunction, WorkHandlerContext } from '@dereekb/dbx-core';
import { of, delay, BehaviorSubject } from 'rxjs';

@Component({
  templateUrl: './directives.component.html'
})
export class DocActionDirectivesComponent {

  successValue: any;

  private _value = new BehaviorSubject<{ test: number }>({ test: 0 });
  readonly value$ = this._value.asObservable();

  readonly handleAction: HandleActionFunction = (value: any, context: WorkHandlerContext) => {
    return of(true).pipe(delay(1000));
  }

  onActionSuccess = (value: any) => {
    this.successValue = value;
  };

  resetValue() {
    this._value.next({ test: this._value.value.test + 1 });
  }

}
