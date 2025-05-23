import { incrementingNumberTimer, SubscriptionObject, successResult } from '@dereekb/rxjs';
import { OnDestroy, Component, OnInit } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';
import { DbxFormFormlyTextFieldModule, DbxFormFormlyWrapperModule, DbxFormSourceDirectiveMode, textField, DbxFormlyFieldsContextDirective, DbxFormSourceDirective, DbxFormLoadingSourceDirective, DbxFormValueChangeDirective } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DbxContentContainerDirective, DbxContentBorderDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFormExampleComponent } from '../component/example.form.component';
import { MatButton } from '@angular/material/button';
import { JsonPipe } from '@angular/common';

@Component({
  templateUrl: './directive.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFormExampleComponent, DbxFormlyFieldsContextDirective, DbxFormSourceDirective, MatButton, DbxFormLoadingSourceDirective, DbxFormValueChangeDirective, DbxContentBorderDirective, JsonPipe, DbxFormFormlyTextFieldModule, DbxFormFormlyWrapperModule]
})
export class DocFormDirectiveComponent implements OnInit, OnDestroy {
  private _sub = new SubscriptionObject();

  readonly _data = new BehaviorSubject<{ test: string }>({ test: 'test' });
  readonly data$ = this._data.asObservable();

  readonly loadingData$ = this.data$.pipe(map((x) => successResult(x)));

  value: any;

  formSourceMode: DbxFormSourceDirectiveMode = 'always';

  testFields() {
    return [
      textField({
        key: 'test',
        required: true
      })
    ];
  }

  readonly testFieldsA: FormlyFieldConfig[] = this.testFields();
  readonly testFieldsB: FormlyFieldConfig[] = this.testFields();
  readonly testFieldsC: FormlyFieldConfig[] = this.testFields();
  readonly testFieldsD: FormlyFieldConfig[] = this.testFields();
  readonly testFieldsE: FormlyFieldConfig[] = this.testFields();
  readonly testFieldsF: FormlyFieldConfig[] = this.testFields();

  ngOnInit(): void {
    this._sub.subscription = incrementingNumberTimer().subscribe((i) => {
      const test = `test ${i}`;
      this._data.next({ test });
    });
  }

  ngOnDestroy(): void {
    this._data.complete();
    this._sub.destroy();
  }
}
