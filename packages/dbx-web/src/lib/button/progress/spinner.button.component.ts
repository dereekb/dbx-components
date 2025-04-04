import { ChangeDetectionStrategy, Component, computed, ElementRef, viewChild } from '@angular/core';
import { AbstractProgressButtonDirective } from './abstract.progress.button.directive';
import { distinctUntilChanged, map, shareReplay } from 'rxjs';
import { spaceSeparatedCssClasses } from '@dereekb/util';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NgClass, NgStyle } from '@angular/common';

@Component({
  selector: 'dbx-progress-spinner-button,dbx-spinner-button',
  templateUrl: './spinner.button.component.html',
  styleUrls: ['./spinner.button.component.scss', './shared.button.component.scss'],
  imports: [MatButton, MatIcon, MatProgressSpinner, NgClass, NgStyle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxProgressSpinnerButtonComponent extends AbstractProgressButtonDirective {
  readonly buttonRef = viewChild.required<ElementRef<HTMLElement>>('button');

  readonly buttonCssArraySignal = computed(() => {
    const config = this.configSignal();
    const classes = [...this.baseCssClassesSignal()];

    if (config?.iconOnly) {
      classes.push('mat-mdc-icon-button');
    }

    if (config?.fab) {
      classes.push('mat-fab');
    }

    return classes;
  });

  readonly buttonCss$ = toObservable(this.buttonCssArraySignal).pipe(map(spaceSeparatedCssClasses), distinctUntilChanged(), shareReplay(1));

  readonly spinnerSizeSignal = computed(() => {
    const config = this.configSignal();
    const buttonRef = this.buttonRef();
    const elem = buttonRef.nativeElement;
    const height = elem.clientHeight;

    let size;

    if (config) {
      if (config.fab || config.iconOnly) {
        size = height;
      } else {
        size = config.spinnerSize;
      }
    }

    if (!size) {
      const minimumSpinnerSize = 18;
      const spinnerRatio = config?.spinnerRatio ?? 0.33;
      const targetSpinnerSize = height * Math.min(1, spinnerRatio);
      size = Math.min(height, Math.max(minimumSpinnerSize, targetSpinnerSize));
    }

    return size;
  });

  readonly buttonCssSignal = toSignal(this.buttonCss$);

  readonly showTextSignal = computed(() => {
    const config = this.configSignal();
    return !(config?.fab || config?.iconOnly);
  });

  readonly showIconSignal = computed(() => {
    const config = this.configSignal();
    return (
      config &&
      config.buttonIcon && // button icon must be defined
      !this.showTextSignal()
    ); // show icon if either fab or iconOnly is true
  });

  readonly customSpinnerStyleSignal = computed(() => {
    const customSpinnerColor = this.configSignal()?.customSpinnerColor;
    return customSpinnerColor ? { stroke: customSpinnerColor } : undefined;
  });

  readonly customSpinnerStyleClassSignal = computed(() => {
    const hasCustomStyle = Boolean(this.customSpinnerStyleSignal());
    return hasCustomStyle ? { 'dbx-spinner-custom': true } : undefined;
  });
}
