import { Component, OnDestroy } from '@angular/core';
import { WorkUsingObservable } from '@dereekb/rxjs';
import { of, delay, BehaviorSubject } from 'rxjs';
import { DbxContentContainerDirective, DbxButtonComponent } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocActionExampleToolsComponent } from '../component/action.example.tool.component';
import { DbxActionDirective, DbxActionHandlerDirective, DbxActionHandlerValueDirective, DbxActionValueDirective, DbxActionButtonDirective, DbxActionSuccessHandlerDirective, DbxActionHasSuccessDirective, DbxActionPreSuccessDirective, DbxActionDisabledOnSuccessDirective, DbxActionAutoModifyDirective, DbxActionAutoTriggerDirective, DbxActionValueStreamDirective, DbxActionDisabledDirective, DbxActionEnforceModifiedDirective } from '@dereekb/dbx-core';
import { MatButton } from '@angular/material/button';
import { DocActionFormExampleFormComponent } from '../component/action.example.form.component';
import { DbxActionFormDirective } from '@dereekb/dbx-form';
import { AsyncPipe, JsonPipe } from '@angular/common';

@Component({
  templateUrl: './directives.component.html',
  standalone: true,
  imports: [
    DbxContentContainerDirective,
    DocFeatureLayoutComponent,
    DocFeatureExampleComponent,
    DocActionExampleToolsComponent,
    DbxActionDirective,
    DbxActionHandlerDirective,
    DbxActionValueDirective,
    DbxButtonComponent,
    DbxActionButtonDirective,
    DbxActionHandlerValueDirective,
    DbxActionSuccessHandlerDirective,
    DbxActionHasSuccessDirective,
    DbxActionPreSuccessDirective,
    DbxActionDisabledOnSuccessDirective,
    DbxActionAutoModifyDirective,
    DbxActionAutoTriggerDirective,
    DbxActionValueStreamDirective,
    MatButton,
    DbxActionDisabledDirective,
    DbxActionEnforceModifiedDirective,
    DocActionFormExampleFormComponent,
    DbxActionFormDirective,
    AsyncPipe,
    JsonPipe
  ]
})
export class DocActionDirectivesComponent implements OnDestroy {
  successValue: any;
  actionHandlerValue = 5;

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
