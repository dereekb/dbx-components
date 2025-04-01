import { ChangeDetectionStrategy, Component, computed, ElementRef, signal, ViewChild } from '@angular/core';
import { AbstractProgressButtonDirective } from './abstract.progress.button.directive';
import { BehaviorSubject, combineLatest, distinctUntilChanged, map, shareReplay } from 'rxjs';
import { Maybe, spaceSeparatedCssClasses } from '@dereekb/util';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgClass, NgStyle } from '@angular/common';
import { filterMaybe } from '@dereekb/rxjs';

@Component({
  selector: 'dbx-progress-spinner-button,dbx-spinner-button',
  templateUrl: './spinner.button.component.html',
  styleUrls: ['./spinner.button.component.scss', './shared.button.component.scss'],
  imports: [MatButton, MatIcon, MatProgressSpinner, NgClass, NgStyle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxProgressSpinnerButtonComponent extends AbstractProgressButtonDirective {
  private readonly _buttonRef = new BehaviorSubject<Maybe<ElementRef<HTMLElement>>>(undefined);

  readonly buttonCss$ = this.baseCssClasses$.pipe(
    map((x) => {
      const options = x[0];
      const classes = [...x[1]];

      if (options.iconOnly) {
        classes.push('mat-mdc-icon-button');
      }

      if (options.fab) {
        classes.push('mat-fab');
      }

      return spaceSeparatedCssClasses(classes);
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly spinnerSize$ = combineLatest([this.options$, this._buttonRef.pipe(filterMaybe())]).pipe(
    map(([options, buttonRef]) => {
      const elem = buttonRef.nativeElement;
      const height = elem.clientHeight;

      let size;

      if (options) {
        if (options.fab || options.iconOnly) {
          size = height;
        } else {
          size = options.spinnerSize;
        }
      }

      if (!size) {
        const minimumSpinnerSize = 18;
        const spinnerRatio = options.spinnerRatio ?? 0.33;
        const targetSpinnerSize = height * Math.min(1, spinnerRatio);
        size = Math.min(height, Math.max(minimumSpinnerSize, targetSpinnerSize));
      }

      return size;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly buttonCssSignal = toSignal(this.buttonCss$);
  readonly spinnerSizeSignal = toSignal(this.spinnerSize$);

  readonly showTextSignal = computed(() => {
    const options = this.optionsSignal();
    return !(options?.fab || options?.iconOnly);
  });

  readonly showIconSignal = computed(() => {
    const options = this.optionsSignal();
    return (
      options &&
      options.buttonIcon && // button icon must be defined
      !this.showTextSignal()
    ); // show icon if either fab or iconOnly is true
  });

  readonly customSpinnerStyleSignal = computed(() => {
    const customSpinnerColor = this.optionsSignal()?.customSpinnerColor;
    return customSpinnerColor ? { stroke: customSpinnerColor } : undefined;
  });

  readonly customSpinnerStyleClassSignal = computed(() => {
    const hasCustomStyle = Boolean(this.customSpinnerStyleSignal());
    return hasCustomStyle ? { 'dbx-spinner-custom': true } : undefined;
  });

  @ViewChild('button', { static: true, read: ElementRef })
  set buttonRef(value: ElementRef<HTMLElement>) {
    this._buttonRef.next(value);
  }
}
