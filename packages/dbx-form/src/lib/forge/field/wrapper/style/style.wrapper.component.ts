import { NgClass, NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal, viewChild, ViewContainerRef } from '@angular/core';
import { FieldWrapperContract, WRAPPER_FIELD_CONTEXT, type WrapperFieldContext } from '@ng-forge/dynamic-forms';
import { asObservable } from '@dereekb/rxjs';
import type { DbxForgeStyleWrapper, DbxForgeStyleObject } from './style.wrapper';

/**
 * Forge wrapper component that applies dynamic CSS classes and
 * inline styles to a container around child fields.
 *
 * Implements {@link FieldWrapperContract} and reads configuration from
 * {@link WRAPPER_FIELD_CONTEXT}. Supports both static values and reactive
 * observables for class and style properties via `ObservableOrValue`.
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

  private readonly context = inject<WrapperFieldContext<DbxForgeStyleWrapper>>(WRAPPER_FIELD_CONTEXT);

  readonly classValueSignal = signal<string>('');
  readonly styleValueSignal = signal<DbxForgeStyleObject>({});

  constructor() {
    // Bridge classGetter ObservableOrValue to signal
    effect((onCleanup) => {
      const classGetter = this.context.config.classGetter;

      if (classGetter != null) {
        const sub = asObservable(classGetter).subscribe((v) => this.classValueSignal.set(v));
        onCleanup(() => sub.unsubscribe());
      } else {
        this.classValueSignal.set('');
      }
    });

    // Bridge styleGetter ObservableOrValue to signal
    effect((onCleanup) => {
      const styleGetter = this.context.config.styleGetter;

      if (styleGetter != null) {
        const sub = asObservable(styleGetter).subscribe((v) => this.styleValueSignal.set(v));
        onCleanup(() => sub.unsubscribe());
      } else {
        this.styleValueSignal.set({});
      }
    });
  }
}
