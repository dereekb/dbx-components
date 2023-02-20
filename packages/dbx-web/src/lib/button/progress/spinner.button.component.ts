import { ChangeDetectionStrategy, Component, ElementRef, ViewChild } from '@angular/core';
import { provideDbxButton } from '@dereekb/dbx-core';
import { AbstractProgressButtonDirective } from './base.progress.button.directive';

@Component({
  selector: 'dbx-spinner-button',
  templateUrl: './spinner.button.component.html',
  styleUrls: ['./spinner.button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxSpinnerButtonComponent extends AbstractProgressButtonDirective {
  @ViewChild('button', { static: true, read: ElementRef })
  readonly buttonRef!: ElementRef<HTMLElement>;

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
