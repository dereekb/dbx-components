import { Component, OnDestroy } from '@angular/core';
import { HandleActionFunction } from '@dereekb/dbx-core';
import { of, delay, BehaviorSubject } from 'rxjs';

@Component({
  templateUrl: './directives.component.html'
})
export class DocActionDirectivesComponent implements OnDestroy {

  successValue: any;

  private _value = new BehaviorSubject<{ test: number }>({ test: 0 });
  readonly value$ = this._value.asObservable();

  constructor() { }

  readonly handleAction: HandleActionFunction = (value: any) => {
    return of(true).pipe(delay(1000));
  }

  ngOnDestroy(): void {
    this._value.complete();
  }

  onActionSuccess = (value: any) => {
    this.successValue = value;
  };

  resetValue() {
    this._value.next({ test: this._value.value.test + 1 });
  }

}
