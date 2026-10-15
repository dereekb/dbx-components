import { Component, inject } from '@angular/core';
import { DbxButtonComponent } from '../../button/button.component';
import { DbxFilterPopoverViewService } from './filter.popover.view';

/**
 * Button that switches a filter popover between its preset and custom filters. Shows the customize text while the presets are shown, and the presets text while the custom filter is shown.
 *
 * Renders nothing unless the popover has both a preset and a custom filter. The filter popover shows one in its header and/or below
 * its filter content (see `DbxFilterComponentConfig.showButtonsInHeader` / `showButtonsBelowContent`); filter content can also
 * place one itself.
 *
 * @example
 * ```html
 * <dbx-preset-filter-list [presets]="presets"></dbx-preset-filter-list>
 * <dbx-filter-popover-switch-button></dbx-filter-popover-switch-button>
 * ```
 */
@Component({
  selector: 'dbx-filter-popover-switch-button',
  template: `
    @if (viewService.canSwitchViewsSignal()) {
      <dbx-button [buttonStyle]="viewService.switchButtonStyleSignal()" [text]="viewService.switchButtonTextSignal()" (buttonClick)="viewService.switchView()"></dbx-button>
    }
  `,
  imports: [DbxButtonComponent]
})
export class DbxFilterPopoverSwitchButtonComponent {
  readonly viewService = inject(DbxFilterPopoverViewService);
}
