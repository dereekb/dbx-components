import { ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from '@angular/core';
import { AbstractFilterPopoverButtonDirective } from './filter.popover.button.directive';
import { DbxButtonDisplay } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxIconButtonComponent } from '../../button/icon/icon.button.component';

const DEFAULT_FILTER_POPOVER_BUTTON_DISPLAY_CONTENT: DbxButtonDisplay = {
  icon: 'filter_list'
};

@Component({
  selector: 'dbx-filter-popover-button',
  template: `
    <dbx-icon-button #button (buttonClick)="showFilterPopover()" [buttonDisplay]="buttonDisplay()" [disabled]="disabled()"></dbx-icon-button>
  `,
  imports: [DbxIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFilterPopoverButtonComponent<F extends object = object> extends AbstractFilterPopoverButtonDirective<F> {
  readonly buttonElement = viewChild<ElementRef>('button');
  readonly disabled = input<Maybe<boolean>>();
  readonly buttonDisplay = input<Maybe<DbxButtonDisplay>, DbxButtonDisplay>(DEFAULT_FILTER_POPOVER_BUTTON_DISPLAY_CONTENT, { transform: (x) => x ?? DEFAULT_FILTER_POPOVER_BUTTON_DISPLAY_CONTENT });

  showFilterPopover(): void {
    const origin = this.buttonElement();
    this.showPopover(origin);
  }
}
