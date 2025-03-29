import { ChangeDetectionStrategy, Component, ElementRef, ViewChild } from '@angular/core';
import { AbstractProgressButtonDirective } from './base.progress.button.directive';
import { distinctUntilChanged, map, shareReplay } from 'rxjs';
import { spaceSeparatedCssClasses } from '@dereekb/util';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

@Component({
  selector: 'dbx-spinner-button',
  templateUrl: './spinner.button.component.html',
  styleUrls: ['./spinner.button.component.scss', './shared.button.component.scss'],
  standalone: true,
  imports: [MatButton, MatIcon, MatProgressSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxSpinnerButtonComponent extends AbstractProgressButtonDirective {
  @ViewChild('button', { static: true, read: ElementRef })
  readonly buttonRef!: ElementRef<HTMLElement>;

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

  get showText() {
    return !(this.options.fab || this.options.iconOnly);
  }

  calcSpinnerSize() {
    const options = this.options;
    const elem = this.buttonRef?.nativeElement;
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
  }
}
