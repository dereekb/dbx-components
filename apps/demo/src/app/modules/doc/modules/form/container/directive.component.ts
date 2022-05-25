import { incrementingNumberTimer, SubscriptionObject, successResult } from '@dereekb/rxjs';
import { OnDestroy, Component, OnInit } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';
import { DbxFormSourceDirectiveMode, textField } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';


@Component({
  templateUrl: './directive.component.html'
})
export class DocFormDirectiveComponent implements OnInit, OnDestroy {

  private _sub = new SubscriptionObject();

  readonly _data = new BehaviorSubject<{ test: string }>({ test: 'test' });
  readonly data$ = this._data.asObservable();

  readonly loadingData$ = this.data$.pipe(map(x => successResult(x)));

  value: any;
  
  formSourceMode: DbxFormSourceDirectiveMode = 'always';

  testFields() {
    return [textField({
      key: 'test',
      required: true
    })];
  }

  readonly testFieldsA: FormlyFieldConfig[] = this.testFields();
  readonly testFieldsB: FormlyFieldConfig[] = this.testFields();
  readonly testFieldsC: FormlyFieldConfig[] = this.testFields();
  readonly testFieldsD: FormlyFieldConfig[] = this.testFields();

  ngOnInit(): void {
    this._sub.subscription = incrementingNumberTimer().subscribe((i) => {
      const test = `test ${i}`;
      this._data.next({ test });
    })
  }

  ngOnDestroy(): void {
    this._data.complete();
    this._sub.destroy();
  }


}
