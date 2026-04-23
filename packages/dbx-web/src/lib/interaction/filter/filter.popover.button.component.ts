import { ChangeDetectionStrategy, Component, computed, ElementRef, input, viewChild } from '@angular/core';
import { AbstractFilterPopoverButtonDirective } from './filter.popover.button.directive';
import { type DbxButtonDisplay } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxButtonComponent } from '../../button/button.component';
import { type DbxButtonDisplayStylePair } from '../../button/button';

const DEFAULT_FILTER_POPOVER_BUTTON_DISPLAY_CONTENT: DbxButtonDisplay = {
  icon: 'filter_list'
};

/**
 * Renders an icon button that opens a filter popover when clicked.
 *
 * @example
 * ```html
 * <dbx-filter-popover-button [config]="filterConfig" [buttonDisplay]="{ icon: 'filter_alt' }"></dbx-filter-popover-button>
 * ```
 */
@Component({
  selector: 'dbx-filter-popover-button',
  template: `
    <dbx-button #button (buttonClick)="showFilterPopover()" [buttonDisplay]="buttonDisplaySignal()" [buttonStyle]="buttonStyleSignal()" [disabled]="disabled()"></dbx-button>
  `,
  imports: [DbxButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFilterPopoverButtonComponent<F extends object = object> extends AbstractFilterPopoverButtonDirective<F> {
  readonly buttonElement = viewChild<string, Maybe<ElementRef>>('button', { read: ElementRef });
  readonly disabled = input<Maybe<boolean>>();

  /**
   * @deprecated Use buttonDisplayStyle instead.
   */
  readonly buttonDisplay = input<DbxButtonDisplay, Maybe<DbxButtonDisplay>>(DEFAULT_FILTER_POPOVER_BUTTON_DISPLAY_CONTENT, { transform: (x) => x ?? DEFAULT_FILTER_POPOVER_BUTTON_DISPLAY_CONTENT });
  readonly buttonDisplayStyle = input<Maybe<DbxButtonDisplayStylePair>>();

  readonly buttonDisplaySignal = computed(() => {
    const pairDisplay = this.buttonDisplayStyle()?.display;
    const directDisplay = this.buttonDisplay();

    if (!pairDisplay && !directDisplay) {
      return undefined;
    }

    return { ...pairDisplay, ...directDisplay };
  });

  readonly buttonStyleSignal = computed(() => this.buttonDisplayStyle()?.style);

  showFilterPopover(): void {
    const origin = this.buttonElement()?.nativeElement;
    this.showPopover(origin);
  }
}
