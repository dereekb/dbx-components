import { Component } from '@angular/core';
import { DbxPopoverContentComponent } from './popover.content.component';

/**
 * Popover scrollable content wrapper component.
 */
@Component({
  selector: 'dbx-popover-scroll-content',
  template: `
  <div class="dbx-popover-scroll-content" [ngClass]="sizingClasses">
    <ng-content></ng-content>
  </div>
`,
  // TODO: styleUrls: ['./popover.scss']
})
export class DbxPopoverScrollContentComponent {

  get sizingClasses(): string {
    const hasHeader = this.hasHeader;
    const hasControls = this.hasControls;

    const classes: string[] = [];

    if (hasHeader && hasControls) {
      classes.push('popover-has-controls-and-header');
    } else if (hasHeader) {
      classes.push('popover-has-header');
    } else if (hasControls) {
      classes.push('popover-has-controls');
    }

    return classes.join(' ');
  }

  get hasHeader(): boolean {
    return this.appPopoverContentComponent.hasHeader;
  }

  get hasControls(): boolean {
    return this.appPopoverContentComponent.hasControls;
  }

  constructor(readonly appPopoverContentComponent: DbxPopoverContentComponent) {}

}
