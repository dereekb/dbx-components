import { incrementingNumberTimer, SubscriptionObject, successResult } from '@dereekb/rxjs';
import { OnDestroy, Component, OnInit } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';
import { DbxFormSourceDirectiveMode, textField } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFormExampleComponent } from '../component/example.form.component';
import { DbxFormlyFieldsContextDirective } from '../../../../../../../../../packages/dbx-form/src/lib/formly/formly.context.directive';
import { DbxFormSourceDirective } from '../../../../../../../../../packages/dbx-form/src/lib/form/io/form.input.directive';
import { MatButton } from '@angular/material/button';
import { DbxFormLoadingSourceDirective } from '../../../../../../../../../packages/dbx-form/src/lib/form/io/form.loading.directive';
import { DbxFormValueChangeDirective } from '../../../../../../../../../packages/dbx-form/src/lib/form/io/form.change.directive';
import { DbxContentBorderDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.border.directive';
import { JsonPipe } from '@angular/common';

@Component({
    templateUrl: './directive.component.html',
    standalone: true,
    imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFormExampleComponent, DbxFormlyFieldsContextDirective, DbxFormSourceDirective, MatButton, DbxFormLoadingSourceDirective, DbxFormValueChangeDirective, DbxContentBorderDirective, JsonPipe]
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
