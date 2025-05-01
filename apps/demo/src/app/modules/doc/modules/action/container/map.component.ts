import { BehaviorSubject, delay, of, tap } from 'rxjs';
import { DocActionFormExampleValue } from './../component/action.example.form.component';
import { Component, OnDestroy } from '@angular/core';
import { WorkUsingObservable } from '@dereekb/rxjs';
import { MS_IN_SECOND, type Maybe } from '@dereekb/util';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxActionContextMapDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/map/action.map.directive';
import { DocActionExampleToolsComponent } from '../component/action.example.tool.component';
import { DbxActionDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/context/action.directive';
import { DbxActionMapSourceDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/map/action.map.source.directive';
import { DbxActionMapWorkingDisableDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/map/action.map.working.disable.directive';
import { DbxActionHandlerDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/state/action.handler.directive';
import { DbxActionDisabledDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/state/action.disabled.directive';
import { DbxActionSnackbarDirective } from '../../../../../../../../../packages/dbx-web/src/lib/action/snackbar/action.snackbar.directive';
import { DocActionFormExampleFormComponent } from '../component/action.example.form.component';
import { DbxActionFormDirective } from '../../../../../../../../../packages/dbx-form/src/lib/form/action/form.action.directive';
import { DbxFormSourceDirective } from '../../../../../../../../../packages/dbx-form/src/lib/form/io/form.input.directive';
import { DbxButtonComponent } from '../../../../../../../../../packages/dbx-web/src/lib/button/button.component';
import { DbxActionFromMapDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/map/action.map.key.directive';
import { DbxActionButtonDirective } from '../../../../../../../../../packages/dbx-core/src/lib/button/action/action.button.directive';
import { DbxActionValueDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/state/action.value.directive';
import { AsyncPipe } from '@angular/common';

@Component({
    templateUrl: './map.component.html',
    standalone: true,
    imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxActionContextMapDirective, DocActionExampleToolsComponent, DbxActionDirective, DbxActionMapSourceDirective, DbxActionMapWorkingDisableDirective, DbxActionHandlerDirective, DbxActionDisabledDirective, DbxActionSnackbarDirective, DocActionFormExampleFormComponent, DbxActionFormDirective, DbxFormSourceDirective, DbxButtonComponent, DbxActionFromMapDirective, DbxActionButtonDirective, DbxActionValueDirective, AsyncPipe]
})
export class DocActionMapComponent implements OnDestroy {
  private _value = new BehaviorSubject<Maybe<DocActionFormExampleValue>>({
    name: 'test',
    date: new Date()
  });

  readonly value$ = this._value.asObservable();
  readonly saveThrottleTime = MS_IN_SECOND * 2;

  constructor() {}

  ngOnDestroy(): void {
    this._value.complete();
  }

  handleSaveDraft: WorkUsingObservable<DocActionFormExampleValue, any> = (value: DocActionFormExampleValue) => {
    return of(value).pipe(
      delay(MS_IN_SECOND),
      tap(() => {
        this._value.next(value);
      })
    );
  };

  handleSendDraft: WorkUsingObservable<DocActionFormExampleValue, any> = (value: DocActionFormExampleValue) => {
    return of(value).pipe(delay(MS_IN_SECOND));
  };
}
