import { NgClass, NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal, viewChild, ViewContainerRef } from '@angular/core';
import { FIELD_SIGNAL_CONTEXT, FieldSignalContext, FieldWrapperContract } from '@ng-forge/dynamic-forms';
import { asObservable, ObservableOrValue, valueFromObservableOrValue } from '@dereekb/rxjs';
import type { DbxForgeStyleWrapper, DbxForgeStyleObject } from './style.wrapper';
import { toSignal } from '@angular/core/rxjs-interop';

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

  readonly classValue = input<ObservableOrValue<string>>('');
  readonly styleValue = input<ObservableOrValue<DbxForgeStyleObject>>({});

  readonly classValue$ = asObservable(this.classValue).pipe(valueFromObservableOrValue());
  readonly styleValue$ = asObservable(this.styleValue).pipe(valueFromObservableOrValue());

  readonly classValueSignal = toSignal(this.classValue$);
  readonly styleValueSignal = toSignal(this.styleValue$);
}
