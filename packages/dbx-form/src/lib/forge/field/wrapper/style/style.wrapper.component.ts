import { NgClass, NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal, viewChild, ViewContainerRef } from '@angular/core';
import { FIELD_SIGNAL_CONTEXT, FieldSignalContext, FieldWrapperContract } from '@ng-forge/dynamic-forms';
import { asObservable, MaybeObservableOrValue, ObservableOrValue, tapLog, valueFromObservableOrValue } from '@dereekb/rxjs';
import type { DbxForgeStyleWrapper, DbxForgeStyleObject } from './style.wrapper';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

/**
 * Forge wrapper component that applies dynamic CSS classes and
 * inline styles to a container around child fields.
 */
@Component({
  selector: 'dbx-forge-style-wrapper',
  template: `
    <div class="dbx-form-style-wrapper" [ngClass]="classValueSignal()" [ngStyle]="styleValueSignal()">
      <ng-container #fieldComponent></ng-container>
    </div>
  `,
  imports: [NgClass, NgStyle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeStyleWrapperComponent implements FieldWrapperContract {
  readonly fieldComponent = viewChild.required('fieldComponent', { read: ViewContainerRef });

  readonly classGetter = input<MaybeObservableOrValue<string>>();
  readonly styleGetter = input<MaybeObservableOrValue<DbxForgeStyleObject>>();

  readonly classValue$ = toObservable(this.classGetter).pipe(valueFromObservableOrValue(), tapLog('classValue'));
  readonly styleValue$ = toObservable(this.styleGetter).pipe(valueFromObservableOrValue(), tapLog('styleValue'));

  readonly classValueSignal = toSignal(this.classValue$);
  readonly styleValueSignal = toSignal(this.styleValue$);
}
