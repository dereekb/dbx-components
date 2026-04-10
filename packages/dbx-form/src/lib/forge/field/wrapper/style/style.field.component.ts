import { NgClass, NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, signal } from '@angular/core';
import { asObservable } from '@dereekb/rxjs';
import { AbstractForgeWrapperFieldComponent, provideDbxForgeWrapperFieldDirective } from '../wrapper.field';
import { DbxForgeWrapperContentComponent } from '../wrapper.content.component';
import type { DbxForgeStyleFieldProps, DbxForgeStyleObject } from './style.field';

/**
 * Forge wrapper field component that applies dynamic CSS classes and
 * inline styles to a container around child fields.
 *
 * This is the forge equivalent of formly's `DbxFormStyleWrapperComponent`.
 * Supports both static values and reactive observables for class and style
 * properties via `ObservableOrValue`.
 */
@Component({
  selector: 'dbx-forge-style-wrapper-field',
  template: `
    <div class="dbx-form-style-wrapper" [ngClass]="classValueSignal()" [ngStyle]="styleValueSignal()">
      <dbx-forge-wrapper-content />
    </div>
  `,
  providers: provideDbxForgeWrapperFieldDirective(DbxForgeStyleFieldComponent),
  imports: [NgClass, NgStyle, DbxForgeWrapperContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    '[class]': 'className()'
  }
})
export class DbxForgeStyleFieldComponent extends AbstractForgeWrapperFieldComponent<DbxForgeStyleFieldProps> {
  readonly classValueSignal = signal<string>('');
  readonly styleValueSignal = signal<DbxForgeStyleObject>({});

  constructor() {
    super();

    // Bridge classGetter ObservableOrValue to signal
    effect((onCleanup) => {
      const classGetter = this.props()?.classGetter;

      if (classGetter != null) {
        const sub = asObservable(classGetter).subscribe((v) => this.classValueSignal.set(v));
        onCleanup(() => sub.unsubscribe());
      } else {
        this.classValueSignal.set('');
      }
    });

    // Bridge styleGetter ObservableOrValue to signal
    effect((onCleanup) => {
      const styleGetter = this.props()?.styleGetter;

      if (styleGetter != null) {
        const sub = asObservable(styleGetter).subscribe((v) => this.styleValueSignal.set(v));
        onCleanup(() => sub.unsubscribe());
      } else {
        this.styleValueSignal.set({});
      }
    });
  }
}
