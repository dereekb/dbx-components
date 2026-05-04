import { BehaviorSubject, delay, of, tap } from 'rxjs';
import { type DocActionFormExampleValue, DocActionFormExampleFormComponent } from './../component/action.example.form.component';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type WorkUsingObservable } from '@dereekb/rxjs';
import { MS_IN_SECOND, type Maybe } from '@dereekb/util';
import { DbxContentContainerDirective, DbxActionSnackbarDirective, DbxButtonComponent } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxActionContextMapDirective, DbxActionDirective, DbxActionMapSourceDirective, DbxActionMapWorkingDisableDirective, DbxActionHandlerDirective, DbxActionDisabledDirective, DbxActionFromMapDirective, DbxActionButtonDirective, DbxActionValueDirective, completeOnDestroy } from '@dereekb/dbx-core';
import { DocActionExampleToolsComponent } from '../component/action.example.tool.component';
import { DbxActionFormDirective, DbxFormSourceDirective } from '@dereekb/dbx-form';
import { AsyncPipe } from '@angular/common';

@Component({
  templateUrl: './map.component.html',
  standalone: true,
  imports: [
    DbxContentContainerDirective,
    DocFeatureLayoutComponent,
    DocFeatureExampleComponent,
    DbxActionContextMapDirective,
    DocActionExampleToolsComponent,
    DbxActionDirective,
    DbxActionMapSourceDirective,
    DbxActionMapWorkingDisableDirective,
    DbxActionHandlerDirective,
    DbxActionDisabledDirective,
    DbxActionSnackbarDirective,
    DocActionFormExampleFormComponent,
    DbxActionFormDirective,
    DbxFormSourceDirective,
    DbxButtonComponent,
    DbxActionFromMapDirective,
    DbxActionButtonDirective,
    DbxActionValueDirective,
    AsyncPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocActionMapComponent {
  private _value = completeOnDestroy(
    new BehaviorSubject<Maybe<DocActionFormExampleValue>>({
      name: 'test',
      date: new Date(),
      startTime: new Date(),
      endTime: new Date()
    })
  );

  readonly value$ = this._value.asObservable();
  readonly saveThrottleTime = MS_IN_SECOND * 2;

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
