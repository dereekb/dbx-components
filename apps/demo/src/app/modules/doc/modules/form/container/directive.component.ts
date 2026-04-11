import { incrementingNumberTimer, successResult } from '@dereekb/rxjs';
import { Component, type OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { cleanSubscription, completeOnDestroy } from '@dereekb/dbx-core';
import { BehaviorSubject, map } from 'rxjs';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { DbxFormFormlyTextFieldModule, DbxFormFormlyWrapperModule, type DbxFormSourceDirectiveMode, formlyTextField, forgeTextField, forgeEmailField, forgeToggleField, forgeNumberField, DbxFormlyFieldsContextDirective, DbxFormSourceDirective, DbxFormLoadingSourceDirective, DbxFormValueChangeDirective, DbxFormActionDialogComponent, DbxForgeActionDialogComponent } from '@dereekb/dbx-form';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { DbxContentContainerDirective, DbxContentBorderDirective } from '@dereekb/dbx-web';
import { MatDialog } from '@angular/material/dialog';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormExampleComponent } from '../component/example.form.component';
import { DocFormForgeExampleComponent } from '../component/forge.example.form.component';
import { MatButton } from '@angular/material/button';
import { JsonPipe } from '@angular/common';

@Component({
  templateUrl: './directive.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormExampleComponent, DocFormForgeExampleComponent, DbxFormlyFieldsContextDirective, DbxFormSourceDirective, MatButton, DbxFormLoadingSourceDirective, DbxFormValueChangeDirective, DbxContentBorderDirective, JsonPipe, DbxFormFormlyTextFieldModule, DbxFormFormlyWrapperModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormDirectiveComponent implements OnInit {
  private readonly _sub = cleanSubscription();
  private readonly _matDialog = inject(MatDialog);

  readonly _data = completeOnDestroy(new BehaviorSubject<{ test: string }>({ test: 'test' }));
  readonly data$ = this._data.asObservable();

  readonly loadingData$ = this.data$.pipe(map((x) => successResult(x)));

  value: any;
  forgeValue: any;
  forgeDirectiveValue: any;
  formlyDialogResult: any;
  forgeDialogResult: any;

  formSourceMode: DbxFormSourceDirectiveMode = 'always';

  testFields() {
    return [
      formlyTextField({
        key: 'test',
        required: true
      })
    ];
  }

  readonly forgeTestFieldsConfig: FormConfig = {
    fields: [
      forgeTextField({
        key: 'test',
        required: true
      })
    ]
  };

  readonly forgeExampleConfig: FormConfig = {
    fields: [forgeTextField({ key: 'name', label: 'Name', required: true, placeholder: 'Enter a name...' }), forgeEmailField({ key: 'email' }), forgeNumberField({ key: 'age', label: 'Age', min: 0, max: 120 }), forgeToggleField({ key: 'active', label: 'Active', description: 'Toggle active state.' })]
  };

  readonly forgeExampleData = { name: 'Test User', email: 'test@example.com', age: 25, active: true };

  readonly testFieldsA: FormlyFieldConfig[] = this.testFields();
  readonly testFieldsB: FormlyFieldConfig[] = this.testFields();
  readonly testFieldsC: FormlyFieldConfig[] = this.testFields();
  readonly testFieldsD: FormlyFieldConfig[] = this.testFields();
  readonly testFieldsE: FormlyFieldConfig[] = this.testFields();
  readonly testFieldsF: FormlyFieldConfig[] = this.testFields();

  openFormlyDialog(): void {
    const dialogRef = DbxFormActionDialogComponent.openDialogWithForm(this._matDialog, {
      header: 'Formly Dialog',
      fields: this.testFields(),
      initialValue: { test: 'hello' }
    });

    dialogRef.afterClosed().subscribe((result) => {
      this.formlyDialogResult = result;
    });
  }

  openForgeDialog(): void {
    const dialogRef = DbxForgeActionDialogComponent.openDialogWithForm(this._matDialog, {
      header: 'Forge Dialog',
      config: this.forgeTestFieldsConfig,
      initialValue: { test: 'hello' }
    });

    dialogRef.afterClosed().subscribe((result) => {
      this.forgeDialogResult = result;
    });
  }

  ngOnInit(): void {
    this._sub.subscription = incrementingNumberTimer().subscribe((i) => {
      const test = `test ${i}`;
      this._data.next({ test });
    });
  }
}
