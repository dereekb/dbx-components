import { Component, computed, ElementRef, input, viewChild } from '@angular/core';
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
 * The popover closes when the filter changes unless `closeOnFilterChange` is false, and closes on a route transition unless
 * `closeOnTransition` (which defaults to `closeOnFilterChange`) is false — so a popover editing a filter that is written to the
 * URL stays open while it is edited. The popover always closes when this button is destroyed, such as when leaving the page.
 * A `dbx-filter-wrapper` without its own Apply button applies its last change before the popover closes on its close button
 * or a click outside.
 *
 * @dbxWebComponent
 * @dbxWebSlug filter-popover-button
 * @dbxWebCategory overlay
 * @dbxWebRelated popover
 * @dbxWebSkillRefs dbx__ref__dbx-component-patterns
 * @dbxWebMinimalExample ```html
 * <dbx-filter-popover-button [config]="filterConfig"></dbx-filter-popover-button>
 * ```
 *
 * @example
 * ```html
 * <dbx-filter-popover-button [config]="filterConfig" [buttonDisplayStyle]="{ display: { icon: 'filter_alt' } }"></dbx-filter-popover-button>
 * ```
 */
@Component({
  selector: 'dbx-filter-popover-button',
  template: `
    <dbx-button #button (buttonClick)="showFilterPopover()" [buttonDisplay]="buttonDisplaySignal()" [buttonStyle]="buttonStyleSignal()" [disabled]="disabled()"></dbx-button>
  `,
  imports: [DbxButtonComponent]
})
export class DbxFilterPopoverButtonComponent<F extends object = object> extends AbstractFilterPopoverButtonDirective<F> {
  readonly buttonElement = viewChild<string, Maybe<ElementRef>>('button', { read: ElementRef });
  readonly disabled = input<Maybe<boolean>>();

  readonly buttonDisplayStyle = input<Maybe<DbxButtonDisplayStylePair>>();

  readonly buttonDisplaySignal = computed(() => this.buttonDisplayStyle()?.display ?? DEFAULT_FILTER_POPOVER_BUTTON_DISPLAY_CONTENT);
  readonly buttonStyleSignal = computed(() => this.buttonDisplayStyle()?.style);

  showFilterPopover(): void {
    const origin = this.buttonElement()?.nativeElement;
    this.showPopover(origin);
  }
}
