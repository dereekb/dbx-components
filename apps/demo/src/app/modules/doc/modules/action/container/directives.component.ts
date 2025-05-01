import { Component, OnDestroy } from '@angular/core';
import { WorkUsingObservable } from '@dereekb/rxjs';
import { of, delay, BehaviorSubject } from 'rxjs';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocActionExampleToolsComponent } from '../component/action.example.tool.component';
import { DbxActionDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/context/action.directive';
import { DbxActionHandlerDirective, DbxActionHandlerValueDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/state/action.handler.directive';
import { DbxActionValueDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/state/action.value.directive';
import { DbxButtonComponent } from '../../../../../../../../../packages/dbx-web/src/lib/button/button.component';
import { DbxActionButtonDirective } from '../../../../../../../../../packages/dbx-core/src/lib/button/action/action.button.directive';
import { DbxActionSuccessHandlerDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/state/action.success.handler.directive';
import { DbxActionHasSuccessDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/state/action.success.directive';
import { DbxActionPreSuccessDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/state/action.presuccess.directive';
import { DbxActionDisabledOnSuccessDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/state/action.disableonsuccess.directive';
import { DbxActionAutoModifyDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/auto/action.automodify.directive';
import { DbxActionAutoTriggerDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/auto/action.autotrigger.directive';
import { DbxActionValueStreamDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/state/action.value.stream.directive';
import { MatButton } from '@angular/material/button';
import { DbxActionDisabledDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/state/action.disabled.directive';
import { DbxActionEnforceModifiedDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/state/action.enforce.modified.directive';
import { DocActionFormExampleFormComponent } from '../component/action.example.form.component';
import { DbxActionFormDirective } from '../../../../../../../../../packages/dbx-form/src/lib/form/action/form.action.directive';
import { AsyncPipe, JsonPipe } from '@angular/common';

@Component({
    templateUrl: './directives.component.html',
    standalone: true,
    imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocActionExampleToolsComponent, DbxActionDirective, DbxActionHandlerDirective, DbxActionValueDirective, DbxButtonComponent, DbxActionButtonDirective, DbxActionHandlerValueDirective, DbxActionSuccessHandlerDirective, DbxActionHasSuccessDirective, DbxActionPreSuccessDirective, DbxActionDisabledOnSuccessDirective, DbxActionAutoModifyDirective, DbxActionAutoTriggerDirective, DbxActionValueStreamDirective, MatButton, DbxActionDisabledDirective, DbxActionEnforceModifiedDirective, DocActionFormExampleFormComponent, DbxActionFormDirective, AsyncPipe, JsonPipe]
})
export class DocActionDirectivesComponent implements OnDestroy {
  successValue: any;

  private _value = new BehaviorSubject<{ test: number }>({ test: 0 });
  readonly value$ = this._value.asObservable();

  constructor() {}

  readonly handleAction: WorkUsingObservable = (value: any) => {
    return of(true).pipe(delay(1000));
  };

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
