import { ChangeDetectionStrategy, Component, computed, ElementRef, viewChild } from '@angular/core';
import { AbstractProgressButtonDirective } from './abstract.progress.button.directive';
import { distinctUntilChanged, map, shareReplay } from 'rxjs';
import { Maybe, spaceSeparatedCssClasses } from '@dereekb/util';
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
  readonly buttonRef = viewChild.required<string, ElementRef<HTMLElement>>('button', { read: ElementRef<HTMLElement> });

  readonly buttonCssArraySignal = computed(() => {
    const config = this.configSignal();
    const classes = [...this.baseCssClassSignal()];

    if (config?.iconOnly) {
      classes.push('mat-mdc-icon-button');
    }

    if (config?.fab) {
      classes.push('dbx-progress-spinner-fab');
    }

    return classes;
  });

  readonly buttonCss$ = toObservable(this.buttonCssArraySignal).pipe(map(spaceSeparatedCssClasses), distinctUntilChanged(), shareReplay(1));

  readonly spinnerSizeSignal = computed(() => {
    const config = this.configSignal();
    const buttonRef = this.buttonRef();

    const elem = buttonRef.nativeElement;
    const height = elem.clientHeight;

    let size: Maybe<number>;

    if (config != null) {
      if (config.iconOnly) {
        if (config.fab) {
          size = 48;
        } else {
          size = height;
        }
      } else {
        size = config.spinnerSize;
      }
    }

    if (!size) {
      const minimumSpinnerSize = 24;
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

  readonly showTextButtonIconSignal = computed(() => {
    const config = this.configSignal();
    const showText = this.showTextSignal();
    return showText && config?.buttonIcon; // shows the button icon with showing the text.
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
    return hasCustomStyle ? { 'dbx-progress-spinner-custom': true } : undefined;
  });
}
