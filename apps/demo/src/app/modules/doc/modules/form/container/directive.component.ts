import { incrementingNumberTimer, successResult } from '@dereekb/rxjs';
import { Component, type OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { cleanSubscription, completeOnDestroy } from '@dereekb/dbx-core';
import { BehaviorSubject, map } from 'rxjs';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { type DbxFormSourceDirectiveMode, dbxForgeTextField, dbxForgeEmailField, dbxForgeToggleField, dbxForgeNumberField, DbxFormSourceDirective, DbxFormLoadingSourceDirective, DbxFormValueChangeDirective, DbxForgeActionDialogComponent } from '@dereekb/dbx-form';
import { DbxContentContainerDirective, DbxContentBorderDirective } from '@dereekb/dbx-web';
import { MatDialog } from '@angular/material/dialog';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormForgeExampleComponent } from '../../shared/component/forge.example.form.component';
import { MatButton } from '@angular/material/button';
import { JsonPipe } from '@angular/common';

@Component({
  templateUrl: './directive.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormForgeExampleComponent, DbxFormSourceDirective, MatButton, DbxFormLoadingSourceDirective, DbxFormValueChangeDirective, DbxContentBorderDirective, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormDirectiveComponent implements OnInit {
  private readonly _sub = cleanSubscription();
  private readonly _matDialog = inject(MatDialog);

  readonly _data = completeOnDestroy(new BehaviorSubject<{ test: string }>({ test: 'test' }));
  readonly data$ = this._data.asObservable();

  readonly loadingData$ = this.data$.pipe(map((x) => successResult(x)));

  forgeValue: any;
  forgeDirectiveValue: any;
  forgeDialogResult: any;

  formSourceMode: DbxFormSourceDirectiveMode = 'always';

  readonly forgeTestFieldsConfig: FormConfig = {
    fields: [
      dbxForgeTextField({
        key: 'test',
        props: {
          type: 'password'
        }
      })
    ]
  } as const satisfies FormConfig;

  readonly forgeExampleConfig: FormConfig = {
    fields: [dbxForgeTextField({ key: 'name', label: 'Name', required: true, placeholder: 'Enter a name...' }), dbxForgeEmailField({ key: 'email' }), dbxForgeNumberField({ key: 'age', label: 'Age', min: 0, max: 120 }), dbxForgeToggleField({ key: 'active', label: 'Active', description: 'Toggle active state.' })]
  };

  readonly forgeExampleData = { name: 'Test User', email: 'test@example.com', age: 25, active: true };

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
